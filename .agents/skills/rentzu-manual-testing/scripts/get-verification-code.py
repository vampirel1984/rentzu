"""Print the newest pending email verification code for a Rentzu account.

Local development helper for the manual-testing skill. Reads straight from
PostgreSQL, so it requires DB access on this machine - it is deliberately NOT
an API endpoint, because exposing verification codes over the network would
defeat email verification entirely.

Usage:
    python get-verification-code.py <email>
"""

import os
import sys

REPO_ROOT = r"D:\apps\rentzu"
SERVER_SRC = os.path.join(REPO_ROOT, "server", "src")

sys.path.insert(0, SERVER_SRC)

from dotenv import load_dotenv

load_dotenv(os.path.join(REPO_ROOT, ".env"))

from db import SessionLocal
from models.email_verification_code import EmailVerificationCode


def main() -> int:
    if len(sys.argv) < 2:
        print("ERROR: expected an email argument", file=sys.stderr)
        return 2

    email = sys.argv[1]
    db = SessionLocal()
    try:
        record = (
            db.query(EmailVerificationCode)
            .filter(EmailVerificationCode.email == email)
            .filter(EmailVerificationCode.status == "pending")
            .order_by(EmailVerificationCode.created_at.desc())
            .first()
        )
    finally:
        db.close()

    if not record:
        print(f"ERROR: no pending verification code for {email}", file=sys.stderr)
        return 1

    print(record.code)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
