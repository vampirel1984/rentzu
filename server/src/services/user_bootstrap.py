import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from models.organization import Organization
from models.organization_user import OrganizationUser
from models.user import User
from services.passwords import hash_password


def split_name_from_email(email: str):
    local = email.split('@')[0].replace('.', ' ').replace('_', ' ').strip()
    if not local:
        return 'New', 'User'
    parts = [p for p in local.split() if p]
    if len(parts) == 1:
        return parts[0].capitalize(), 'User'
    return parts[0].capitalize(), ' '.join(parts[1:]).title()


def get_or_create_user_for_auth(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.password_hash = hash_password(password)
        db.commit()
        db.refresh(user)
        return user

    first_name, last_name = split_name_from_email(email)
    user = User(
        id=uuid.uuid4(),
        email=email,
        first_name=first_name,
        last_name=last_name,
        password_hash=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_or_create_user_and_org(db: Session, email: str):
    user = db.query(User).filter(User.email == email).first()

    if not user:
        first_name, last_name = split_name_from_email(email)
        user = User(
            id=uuid.uuid4(),
            email=email,
            first_name=first_name,
            last_name=last_name,
        )
        db.add(user)
        db.flush()

    if not user.email_verified_at:
        user.email_verified_at = datetime.now(timezone.utc)

    membership = db.query(OrganizationUser).filter(OrganizationUser.user_id == user.id).first()
    organization = None
    if membership:
        organization = db.query(Organization).filter(Organization.id == membership.organization_id).first()

    if not organization:
        organization = Organization(
            id=uuid.uuid4(),
            name=f'{user.first_name} {user.last_name}'.strip(),
            entity_type='individual',
        )
        db.add(organization)
        db.flush()

    existing_membership = (
        db.query(OrganizationUser)
        .filter(OrganizationUser.organization_id == organization.id)
        .filter(OrganizationUser.user_id == user.id)
        .first()
    )
    if not existing_membership:
        db.add(
            OrganizationUser(
                organization_id=organization.id,
                user_id=user.id,
                role='owner',
            )
        )

    db.commit()
    db.refresh(user)
    db.refresh(organization)
    return user, organization
