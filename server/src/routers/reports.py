"""Report download endpoints – Schedule E PDF and Property Expense PDF."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from db import get_db
from dependencies import CurrentUser, get_current_user
from models.organization import Organization
from services.reports import generate_property_expense_pdf, generate_schedule_e_pdf

router = APIRouter()


def _get_org_name(db: Session, organization_id: UUID) -> str:
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    return org.name if org else 'Portfolio'


@router.get('/schedule-e')
def download_schedule_e(
    organization_id: UUID = Query(...),
    year: int = Query(default_factory=lambda: datetime.utcnow().year),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Download Schedule E Summary as PDF."""
    current_user.require_org_access(organization_id)
    org_name = _get_org_name(db, organization_id)

    try:
        pdf_bytes = generate_schedule_e_pdf(db, organization_id, year, org_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Failed to generate Schedule E PDF: {exc}')

    filename = f'Schedule_E_Summary_{org_name}_{year}.pdf'
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@router.get('/property-expense')
def download_property_expense(
    organization_id: UUID = Query(...),
    year: int = Query(default_factory=lambda: datetime.utcnow().year),
    property_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Download Property Expense Summary as PDF."""
    current_user.require_org_access(organization_id)
    org_name = _get_org_name(db, organization_id)

    try:
        pdf_bytes = generate_property_expense_pdf(db, organization_id, year, org_name, property_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Failed to generate Property Expense PDF: {exc}')

    filename = f'Property_Expense_Summary_{org_name}_{year}.pdf'
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )
