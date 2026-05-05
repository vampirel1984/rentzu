from pydantic import BaseModel, EmailStr


class RequestCodePayload(BaseModel):
    email: EmailStr
    password: str


class VerifyCodePayload(BaseModel):
    email: EmailStr
    code: str


class AuthResponse(BaseModel):
    ok: bool
    message: str
    email: str | None = None
    user_id: str | None = None
    organization_id: str | None = None
    organization_ids: list[str] | None = None
    debug_code: str | None = None
    delivery_mode: str | None = None
    access_token: str | None = None
