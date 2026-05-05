from sqlalchemy import Column, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from db import Base


class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"

    id = Column(UUID(as_uuid=True), primary_key=True)
    email = Column(Text, nullable=False, index=True)
    code = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    verified_at = Column(DateTime(timezone=True))
