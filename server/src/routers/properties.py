from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db import get_db
from dependencies import CurrentUser, get_current_user
from schemas.property import (
    PropertyCreate,
    PropertyPatch,
    PropertyPortfolioSummaryRead,
    PropertyRead,
    PropertyTaxReportRead,
)
from services.properties import (
    build_portfolio_summary,
    build_property_tax_report,
    create_property,
    get_property,
    get_property_row,
    list_properties,
    patch_property,
)

router = APIRouter()


@router.get('/portfolio-summary', response_model=PropertyPortfolioSummaryRead)
def portfolio_summary(
    organization_id: UUID = Query(...),
    year: int = Query(default=datetime.utcnow().year),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    current_user.require_org_access(organization_id)
    return build_portfolio_summary(db, organization_id=organization_id, year=year)


@router.get('', response_model=list[PropertyRead])
def properties_index(
    organization_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if organization_id:
        current_user.require_org_access(organization_id)
    return list_properties(db, organization_id=organization_id)


@router.get('/{property_id}', response_model=PropertyRead)
def properties_show(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    obj = get_property(db, property_id)
    if not obj:
        raise HTTPException(status_code=404, detail='Property not found')
    return obj


@router.get('/{property_id}/tax-report', response_model=PropertyTaxReportRead)
def property_tax_report(
    property_id: UUID,
    year: int = Query(default=datetime.utcnow().year),
    unit_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    obj = get_property_row(db, property_id)
    if not obj:
        raise HTTPException(status_code=404, detail='Property not found')
    return build_property_tax_report(db, obj, year, unit_id=unit_id)


@router.post('', response_model=PropertyRead)
def properties_create(
    payload: PropertyCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    current_user.require_org_access(payload.organization_id)
    return create_property(db, payload)


@router.patch('/{property_id}', response_model=PropertyRead)
def properties_patch(
    property_id: UUID,
    payload: PropertyPatch,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    obj = get_property_row(db, property_id)
    if not obj:
        raise HTTPException(status_code=404, detail='Property not found')
    return patch_property(db, obj, payload)
