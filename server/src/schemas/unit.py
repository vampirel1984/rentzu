from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class UnitBase(BaseModel):
    unit_code: str
    unit_type: Optional[str] = None
    bedroom_count: Optional[Decimal] = None
    bathroom_count: Optional[Decimal] = None
    square_feet: Optional[int] = None
    market_rent: Optional[Decimal] = None
    is_active: bool = True
    notes: Optional[str] = None


class UnitCreate(UnitBase):
    property_id: UUID


class UnitPatch(BaseModel):
    unit_code: Optional[str] = None
    unit_type: Optional[str] = None
    bedroom_count: Optional[Decimal] = None
    bathroom_count: Optional[Decimal] = None
    square_feet: Optional[int] = None
    market_rent: Optional[Decimal] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class UnitRead(UnitCreate):
    id: UUID

    class Config:
        from_attributes = True
