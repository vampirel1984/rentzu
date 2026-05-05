from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel

from schemas.unit import UnitRead


class PropertyBase(BaseModel):
    name: str
    property_type: str
    address_line_1: str
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = 'US'
    total_units: int = 1
    is_active: bool = True
    notes: Optional[str] = None


class PropertyCreate(PropertyBase):
    organization_id: UUID


class PropertyPatch(BaseModel):
    name: Optional[str] = None
    property_type: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    total_units: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class PropertyRead(PropertyCreate):
    id: UUID
    units: list[UnitRead] = []

    class Config:
        from_attributes = True


class PropertyCategoryTotal(BaseModel):
    category_code: str
    amount: Decimal


class PropertyMonthlyTotal(BaseModel):
    month: str
    income: Decimal
    expense: Decimal
    net: Decimal


class PropertyTaxReportRead(BaseModel):
    property_id: UUID
    property_name: str
    organization_id: UUID
    year: int
    record_count: int
    income_total: Decimal
    expense_total: Decimal
    net_total: Decimal
    deductible_expense_total: Decimal
    category_totals: list[PropertyCategoryTotal]
    monthly_totals: list[PropertyMonthlyTotal]


class PropertyPortfolioSummaryItem(BaseModel):
    property_id: UUID
    property_name: str
    property_type: str
    city: str | None = None
    state: str | None = None
    total_units: int
    record_count: int
    income_total: Decimal
    expense_total: Decimal
    net_total: Decimal


class PropertyPortfolioSummaryRead(BaseModel):
    organization_id: UUID
    year: int
    property_count: int
    income_total: Decimal
    expense_total: Decimal
    net_total: Decimal
    properties: list[PropertyPortfolioSummaryItem]
