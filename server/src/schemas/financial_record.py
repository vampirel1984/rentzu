# Modified by AI on 07/18/2026. Edit #1.
from datetime import date
from decimal import Decimal
import re
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


ALLOWED_FINANCIAL_CATEGORY_CODES = (
    'rent',
    'additional_income',
    'legal',
    'utility',
    'cleaning',
    'management',
    'maintenance',
    'repair',
    'other',
    'travel',
    'commission',
    'interest',
    'mortgage',
    'improvement',
    'insurance',
    'tax',
)

FINANCIAL_CATEGORY_ALIASES = {
    'rental_income': 'rent',
    'income': 'additional_income',
    'other_income': 'additional_income',
    'fee': 'additional_income',
    'fees': 'additional_income',
    'late_fee': 'additional_income',
    'late_fees': 'additional_income',
    'pet_fee': 'additional_income',
    'pet_fees': 'additional_income',
    'water': 'utility',
    'utilities': 'utility',
    'electric': 'utility',
    'gas': 'utility',
    'trash': 'utility',
    'internet': 'utility',
    'repairs': 'repair',
    'property_management': 'management',
    'bookkeeping': 'legal',
    'accounting': 'legal',
    'professional': 'legal',
    'capital_improvement': 'improvement',
    'capital_improvements': 'improvement',
    'improvements': 'improvement',
    'property_tax': 'tax',
    'property_taxes': 'tax',
    'taxes': 'tax',
    'mortgage_interest': 'interest',
    'loan_interest': 'interest',
    'mortgage_principal': 'mortgage',
    'principal': 'mortgage',
    'mortgage_payment': 'mortgage',
    'loan_principal': 'mortgage',
    'loan': 'mortgage',
}


def normalize_financial_category_code(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = re.sub(r'[^a-z0-9]+', '_', str(value).strip().lower()).strip('_')
    if not normalized:
        return None
    normalized = FINANCIAL_CATEGORY_ALIASES.get(normalized, normalized)
    if normalized not in ALLOWED_FINANCIAL_CATEGORY_CODES:
        allowed = ', '.join(ALLOWED_FINANCIAL_CATEGORY_CODES)
        raise ValueError(f'Invalid category_code. Allowed values: {allowed}')
    return normalized


class FinancialRecordBase(BaseModel):
    type: str
    amount: Decimal
    currency: str = 'USD'
    record_date: date
    counterparty: Optional[str] = None
    description: str
    property_id: UUID
    unit_id: Optional[UUID] = None
    lease_id: Optional[UUID] = None
    category_code: Optional[str] = None
    sub_type: Optional[str] = None
    notes: Optional[str] = None
    source: str = 'manual'

    @field_validator('category_code')
    @classmethod
    def validate_category_code(cls, value: str | None):
        return normalize_financial_category_code(value)


class FinancialRecordCreate(FinancialRecordBase):
    organization_id: UUID
    extracted_record_id: Optional[UUID] = None
    created_by: Optional[UUID] = None


class FinancialRecordPatch(BaseModel):
    type: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    record_date: Optional[date] = None
    counterparty: Optional[str] = None
    description: Optional[str] = None
    property_id: Optional[UUID] = None
    unit_id: Optional[UUID] = None
    lease_id: Optional[UUID] = None
    category_code: Optional[str] = None
    sub_type: Optional[str] = None
    notes: Optional[str] = None
    source: Optional[str] = None

    @field_validator('category_code')
    @classmethod
    def validate_category_code(cls, value: str | None):
        return normalize_financial_category_code(value)


class FinancialRecordRead(FinancialRecordCreate):
    id: UUID

    class Config:
        from_attributes = True


class FinancialRecordListResponse(BaseModel):
    items: list[FinancialRecordRead]
    total: int
    limit: int
    next_cursor: Optional[str] = None
