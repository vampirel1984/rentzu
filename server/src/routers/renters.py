from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from dependencies import CurrentUser, get_current_user
from schemas.renter import RenterCreate, RenterPatch, RenterRead
from services.renters import create_renter, get_renter, list_renters, patch_renter

router = APIRouter()


@router.get('', response_model=list[RenterRead])
def renters_index(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return list_renters(db)


@router.get('/{renter_id}', response_model=RenterRead)
def renters_show(
    renter_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    obj = get_renter(db, renter_id)
    if not obj:
        raise HTTPException(status_code=404, detail='Renter not found')
    return obj


@router.post('', response_model=RenterRead)
def renters_create(
    payload: RenterCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return create_renter(db, payload)


@router.patch('/{renter_id}', response_model=RenterRead)
def renters_patch(
    renter_id: UUID,
    payload: RenterPatch,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    obj = get_renter(db, renter_id)
    if not obj:
        raise HTTPException(status_code=404, detail='Renter not found')
    return patch_renter(db, obj, payload)
