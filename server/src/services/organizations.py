import uuid
from uuid import UUID
from sqlalchemy.orm import Session

from models.organization import Organization
from models.organization_user import OrganizationUser


def list_organizations_for_user(db: Session, user_id: UUID):
    return (
        db.query(Organization)
        .join(OrganizationUser, OrganizationUser.organization_id == Organization.id)
        .filter(OrganizationUser.user_id == user_id)
        .order_by(Organization.created_at.asc())
        .all()
    )


def create_organization(db: Session, user_id: UUID, name: str, entity_type: str):
    organization = Organization(
        id=uuid.uuid4(),
        name=name,
        entity_type=entity_type,
    )
    db.add(organization)
    db.flush()

    membership = OrganizationUser(
        organization_id=organization.id,
        user_id=user_id,
        role='owner',
    )
    db.add(membership)
    db.commit()
    db.refresh(organization)
    return organization


def patch_organization(db: Session, organization: Organization, *, name: str | None = None, entity_type: str | None = None):
    if name is not None:
        organization.name = name
    if entity_type is not None:
        organization.entity_type = entity_type
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


def get_organization_for_user(db: Session, organization_id: UUID, user_id: UUID):
    return (
        db.query(Organization)
        .join(OrganizationUser, OrganizationUser.organization_id == Organization.id)
        .filter(Organization.id == organization_id)
        .filter(OrganizationUser.user_id == user_id)
        .first()
    )
