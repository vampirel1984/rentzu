from __future__ import annotations

import logging

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models.organization_user import OrganizationUser
from models.user import User
from services.jwt_auth import decode_access_token

logger = logging.getLogger(__name__)


class CurrentUser:
    def __init__(self, user: User, organization_ids: list[str]):
        self.user = user
        self.id = user.id
        self.email = user.email
        self.organization_ids = organization_ids

    def require_org_access(self, organization_id) -> None:
        if str(organization_id) not in self.organization_ids:
            raise HTTPException(status_code=403, detail='You do not have access to this organization')


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if not authorization or not authorization.startswith('Bearer '):
        logger.warning('[AUTH] Missing or invalid Authorization header: %r', authorization)
        raise HTTPException(status_code=401, detail='Missing or invalid Authorization header')

    token = authorization.removeprefix('Bearer ').strip()
    try:
        payload = decode_access_token(token)
    except ValueError as exc:
        logger.warning('[AUTH] Token decode failed: %s', exc)
        raise HTTPException(status_code=401, detail=str(exc))

    user_id = payload.get('sub')
    if not user_id:
        logger.warning('[AUTH] Invalid token payload, missing sub: %s', payload)
        raise HTTPException(status_code=401, detail='Invalid token payload')

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.warning('[AUTH] User not found for token sub=%s', user_id)
        raise HTTPException(status_code=401, detail='User not found')

    org_ids = [
        str(row.organization_id)
        for row in db.query(OrganizationUser).filter(OrganizationUser.user_id == user.id).all()
    ]

    return CurrentUser(user=user, organization_ids=org_ids)
