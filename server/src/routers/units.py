# Modified by AI on 07/24/2026. Edit #1. Added optional property_id query filter to the units index endpoint.
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db import get_db
from dependencies import CurrentUser, get_current_user
from schemas.unit import UnitCreate, UnitPatch, UnitRead
from services.units import create_unit, get_unit, list_units, patch_unit

router = APIRouter()


@router.get('', response_model=list[UnitRead])
def units_index(
    property_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return list_units(db, property_id=property_id)


@router.get('/{unit_id}', response_model=UnitRead)
def units_show(
    unit_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    obj = get_unit(db, unit_id)
    if not obj:
        raise HTTPException(status_code=404, detail='Unit not found')
    return obj


@router.post('', response_model=UnitRead)
def units_create(
    payload: UnitCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return create_unit(db, payload)


@router.patch('/{unit_id}', response_model=UnitRead)
def units_patch(
    unit_id: UUID,
    payload: UnitPatch,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    obj = get_unit(db, unit_id)
    if not obj:
        raise HTTPException(status_code=404, detail='Unit not found')
    return patch_unit(db, obj, payload)
