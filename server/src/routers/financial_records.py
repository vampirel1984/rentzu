from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db import get_db
from dependencies import CurrentUser, get_current_user
from schemas.financial_record import FinancialRecordCreate, FinancialRecordListResponse, FinancialRecordPatch, FinancialRecordRead
from services.financial_records import create_financial_record, get_financial_record, list_financial_records, patch_financial_record

router = APIRouter()


@router.get('', response_model=FinancialRecordListResponse)
def financial_records_index(
    organization_id: UUID | None = Query(default=None),
    property_id: UUID | None = Query(default=None),
    limit: int = Query(default=5, ge=1, le=100),
    cursor: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if organization_id:
        current_user.require_org_access(organization_id)
    return list_financial_records(db, organization_id=organization_id, property_id=property_id, limit=limit, cursor=cursor)


@router.get('/{record_id}', response_model=FinancialRecordRead)
def financial_records_show(
    record_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    obj = get_financial_record(db, record_id)
    if not obj:
        raise HTTPException(status_code=404, detail='Financial record not found')
    return obj


@router.post('', response_model=FinancialRecordRead)
def financial_records_create(
    payload: FinancialRecordCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    current_user.require_org_access(payload.organization_id)
    return create_financial_record(db, payload)


@router.patch('/{record_id}', response_model=FinancialRecordRead)
def financial_records_patch(
    record_id: UUID,
    payload: FinancialRecordPatch,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    obj = get_financial_record(db, record_id)
    if not obj:
        raise HTTPException(status_code=404, detail='Financial record not found')
    return patch_financial_record(db, obj, payload)


@router.delete('/{record_id}')
def financial_records_delete(
    record_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    obj = get_financial_record(db, record_id)
    if not obj:
        raise HTTPException(status_code=404, detail='Financial record not found')
    db.delete(obj)
    db.commit()
    return {'ok': True}
