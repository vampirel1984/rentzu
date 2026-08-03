from __future__ import annotations

import hashlib
import hmac
import os
import secrets

_ITERATIONS = 200000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), _ITERATIONS)
    return f'{salt}${digest.hex()}'


def verify_password(password: str, stored_hash: str | None) -> bool:
    """Constant-time check of a plaintext password against a stored salt$digest value."""
    if not stored_hash:
        return False

    salt, separator, expected = stored_hash.partition('$')
    if not separator or not salt or not expected:
        return False

    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), _ITERATIONS)
    return hmac.compare_digest(digest.hex(), expected)
