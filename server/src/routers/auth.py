from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models.organization_user import OrganizationUser
from schemas.auth import AuthResponse, RequestCodePayload, VerifyCodePayload
from services.auth import create_dev_session, request_email_code, verify_email_code
from services.jwt_auth import create_access_token

router = APIRouter()


@router.post("/request-code", response_model=AuthResponse)
def request_code(payload: RequestCodePayload, db: Session = Depends(get_db)):
    _record, code, delivered, delivery_message, user = request_email_code(db, payload.email, payload.password)
    message = "Verification code sent" if delivered else delivery_message

    org_ids = [
        str(row.organization_id)
        for row in db.query(OrganizationUser).filter(OrganizationUser.user_id == user.id).all()
    ]

    return AuthResponse(
        ok=True,
        message=message,
        email=payload.email,
        user_id=str(user.id),
        debug_code=None if delivered else code,
        delivery_mode="smtp" if delivered else "outbox",
    )


@router.post("/dev-session", response_model=AuthResponse)
def dev_session(payload: RequestCodePayload, db: Session = Depends(get_db)):
    user, organization, organization_ids = create_dev_session(db, payload.email, payload.password)
    token = create_access_token(
        user_id=str(user.id),
        email=payload.email,
        organization_ids=organization_ids,
    )
    return AuthResponse(
        ok=True,
        message="Local dev session ready",
        email=payload.email,
        user_id=str(user.id),
        organization_id=str(organization.id),
        organization_ids=organization_ids,
        access_token=token,
    )


@router.post("/verify-code", response_model=AuthResponse)
def verify_code(payload: VerifyCodePayload, db: Session = Depends(get_db)):
    print(f"[auth.verify-code] email={payload.email!r} code={payload.code!r} len={len(payload.code)}")
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
