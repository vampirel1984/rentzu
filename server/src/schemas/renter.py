from datetime import date
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class RenterBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class RenterCreate(RenterBase):
    organization_id: UUID


class RenterPatch(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class RenterRead(RenterCreate):
    id: UUID

    class Config:
        from_attributes = True
