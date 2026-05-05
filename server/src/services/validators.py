from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.organization import Organization
from models.property import Property
from models.unit import Unit


def require_organization(db: Session, organization_id):
    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    if not organization:
        raise HTTPException(status_code=400, detail='Organization does not exist')
    return organization


def require_property(db: Session, property_id):
    property_obj = db.query(Property).filter(Property.id == property_id).first()
    if not property_obj:
        raise HTTPException(status_code=400, detail='Property does not exist')
    return property_obj


def require_unit(db: Session, unit_id):
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=400, detail='Unit does not exist')
    return unit


def ensure_property_belongs_to_organization(property_obj: Property, organization_id):
    if property_obj.organization_id != organization_id:
        raise HTTPException(status_code=400, detail='Property does not belong to organization')


def ensure_unit_belongs_to_property(unit: Unit, property_id):
    if unit.property_id != property_id:
        raise HTTPException(status_code=400, detail='Unit does not belong to property')
