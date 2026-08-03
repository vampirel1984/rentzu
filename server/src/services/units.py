# Modified by AI on 07/24/2026. Edit #1. Added optional property_id filter to list_units so the app can refresh a single property's units after editing.
from uuid import UUID
from sqlalchemy.orm import Session

from models.unit import Unit
from schemas.unit import UnitCreate, UnitPatch
from services.validators import require_property


def list_units(db: Session, property_id: UUID | None = None):
    query = db.query(Unit)
    if property_id:
        query = query.filter(Unit.property_id == property_id)
    return query.order_by(Unit.created_at.desc()).all()


def get_unit(db: Session, unit_id: UUID):
    return db.query(Unit).filter(Unit.id == unit_id).first()


def create_unit(db: Session, payload: UnitCreate):
    require_property(db, payload.property_id)
    obj = Unit(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def patch_unit(db: Session, obj: Unit, payload: UnitPatch):
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj
