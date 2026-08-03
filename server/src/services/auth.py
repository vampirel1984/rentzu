import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from models.email_verification_code import EmailVerificationCode
from services.email_delivery import send_verification_email
from models.organization_user import OrganizationUser
from services.user_bootstrap import AuthError, authenticate_or_register, get_or_create_user_and_org

# A 6-digit code is brute-forceable given unlimited guesses, so lock it after
# this many failures. The user can request a fresh code.
MAX_VERIFICATION_ATTEMPTS = 5


def request_email_code(db: Session, email: str, password: str):
    code = f"{secrets.randbelow(1000000):06d}"
    now = datetime.now(timezone.utc)
    user, _created = authenticate_or_register(db, email, password)

    # Supersede any earlier pending codes so only the newest one can be used.
    (
        db.query(EmailVerificationCode)
        .filter(EmailVerificationCode.email == email)
        .filter(EmailVerificationCode.status == "pending")
        .update({"status": "superseded"}, synchronize_session=False)
    )

    record = EmailVerificationCode(
        id=uuid.uuid4(),
        email=email,
        code=code,
        status="pending",
        expires_at=now + timedelta(minutes=10),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    delivered, delivery_message = send_verification_email(email, code)
    return record, code, delivered, delivery_message, user


def verify_email_code(db: Session, email: str, code: str):
    record = (
        db.query(EmailVerificationCode)
        .filter(EmailVerificationCode.email == email)
        .filter(EmailVerificationCode.status == "pending")
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )

    if not record:
        return False, "No pending verification code found"

    now = datetime.now(timezone.utc)
    if record.expires_at < now:
        record.status = "expired"
        db.commit()
        return False, "Verification code expired"

    if not hmac.compare_digest(record.code, code):
        record.attempts = (record.attempts or 0) + 1
        if record.attempts >= MAX_VERIFICATION_ATTEMPTS:
            record.status = "locked"
            db.commit()
            return False, "Too many incorrect attempts. Request a new verification code."
        db.commit()
        return False, "Invalid verification code"

    record.status = "verified"
    record.verified_at = now
    db.commit()

    user, organization = get_or_create_user_and_org(db, email)
    organization_ids = [str(row.organization_id) for row in db.query(OrganizationUser).filter(OrganizationUser.user_id == user.id).all()]
    return True, "Email verified successfully", user, organization, organization_ids
