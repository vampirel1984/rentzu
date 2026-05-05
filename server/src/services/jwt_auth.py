from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

import jwt

logger = logging.getLogger(__name__)

JWT_SECRET = os.getenv('JWT_SECRET', '')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_DAYS = int(os.getenv('JWT_EXPIRY_DAYS', '7'))

_DEV_FALLBACK_SECRET = 'rentzu-dev-secret-do-not-use-in-production'


def _get_secret() -> str:
    if JWT_SECRET:
        return JWT_SECRET
    logger.warning(
        'JWT_SECRET is not set — using insecure dev fallback. '
        'Set JWT_SECRET env var before deploying to production.'
    )
    return _DEV_FALLBACK_SECRET


def create_access_token(
    user_id: str,
    email: str,
    organization_ids: list[str],
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        'sub': user_id,
        'email': email,
        'org_ids': organization_ids,
        'iat': now,
        'exp': now + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, _get_secret(), algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, _get_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise ValueError('Token has expired')
    except jwt.InvalidTokenError as exc:
        raise ValueError(f'Invalid token: {exc}')
