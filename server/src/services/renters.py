from uuid import UUID
from sqlalchemy.orm import Session

from models.renter import Renter
from schemas.renter import RenterCreate, RenterPatch
from services.validators import require_organization


def list_renters(db: Session):
    return db.query(Renter).order_by(Renter.created_at.desc()).all()


def get_renter(db: Session, renter_id: UUID):
    return db.query(Renter).filter(Renter.id == renter_id).first()


def create_renter(db: Session, payload: RenterCreate):
    require_organization(db, payload.organization_id)
    obj = Renter(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def patch_renter(db: Session, obj: Renter, payload: RenterPatch):
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj
