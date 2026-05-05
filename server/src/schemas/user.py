from uuid import UUID
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str


class UserCreate(UserBase):
    pass


class UserPatch(BaseModel):
    email: EmailStr | None = None
    first_name: str | None = None
    last_name: str | None = None


class UserRead(UserBase):
    id: UUID

    class Config:
        from_attributes = True
