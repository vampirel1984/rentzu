from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models.organization_user import OrganizationUser
from schemas.auth import AuthResponse, RequestCodePayload, VerifyCodePayload
from services.auth import request_email_code, verify_email_code
from services.jwt_auth import create_access_token
from services.user_bootstrap import AuthError

router = APIRouter()


@router.post("/request-code", response_model=AuthResponse)
def request_code(payload: RequestCodePayload, db: Session = Depends(get_db)):
    try:
        _record, _code, delivered, delivery_message, user = request_email_code(db, payload.email, payload.password)
    except AuthError:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not delivered:
        # The code is written to the local outbox for recovery, but never returned
        # to the caller - doing so would bypass email verification entirely.
        print(f"[auth.request-code] delivery failed for {payload.email}: {delivery_message}")
        raise HTTPException(
            status_code=503,
            detail="Could not send the verification email. Please try again later.",
        )

    return AuthResponse(
        ok=True,
        message="Verification code sent",
        email=payload.email,
        user_id=str(user.id),
        delivery_mode="smtp",
    )


@router.post("/verify-code", response_model=AuthResponse)
def verify_code(payload: VerifyCodePayload, db: Session = Depends(get_db)):
    result = verify_email_code(db, payload.email, payload.code)
    ok = result[0]
    message = result[1]
    if not ok:
        raise HTTPException(status_code=400, detail=message)

    user = result[2]
    organization = result[3]
    organization_ids = result[4]
    token = create_access_token(
        user_id=str(user.id),
        email=payload.email,
        organization_ids=organization_ids,
    )
    return AuthResponse(
        ok=True,
        message=message,
        email=payload.email,
        user_id=str(user.id),
        organization_id=str(organization.id),
        organization_ids=organization_ids,
        access_token=token,
    )
