from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class OrganizationBase(BaseModel):
    name: str
    entity_type: str


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationPatch(BaseModel):
    name: Optional[str] = None
    entity_type: Optional[str] = None


class OrganizationRead(OrganizationBase):
    id: UUID

    class Config:
        from_attributes = True
