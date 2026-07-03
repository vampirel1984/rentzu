from uuid import UUID
from typing import Literal
from pydantic import BaseModel, EmailStr

# Supported app languages. Modified by AI on 07/03/2026. Edit #1.
LanguagePreference = Literal['en', 'zh']


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
    language_preference: LanguagePreference | None = None


class UserRead(UserBase):
    id: UUID
    language_preference: LanguagePreference = 'en'

    class Config:
        from_attributes = True
