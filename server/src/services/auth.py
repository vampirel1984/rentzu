import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from models.email_verification_code import EmailVerificationCode
from services.email_delivery import send_verification_email
from models.organization_user import OrganizationUser
from services.user_bootstrap import get_or_create_user_and_org, get_or_create_user_for_auth


def create_dev_session(db: Session, email: str, password: str):
    user = get_or_create_user_for_auth(db, email, password)
    user, organization = get_or_create_user_and_org(db, email)
    organization_ids = [str(row.organization_id) for row in db.query(OrganizationUser).filter(OrganizationUser.user_id == user.id).all()]
    return user, organization, organization_ids




def request_email_code(db: Session, email: str, password: str):
    code = os.environ.get('RENTZU_FIXED_VERIFICATION_CODE') or f"{random.randint(0, 999999):06d}"
    now = datetime.now(timezone.utc)
    user = get_or_create_user_for_auth(db, email, password)

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

    if record.code != code:
        return False, "Invalid verification code"

    record.status = "verified"
    record.verified_at = now
    db.commit()

    user, organization = get_or_create_user_and_org(db, email)
    organization_ids = [str(row.organization_id) for row in db.query(OrganizationUser).filter(OrganizationUser.user_id == user.id).all()]
    return True, "Email verified successfully", user, organization, organization_ids
