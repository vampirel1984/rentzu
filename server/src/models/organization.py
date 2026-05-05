from sqlalchemy import Column, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from db import Base


class Organization(Base):
    __tablename__ = 'organizations'

    id = Column(UUID(as_uuid=True), primary_key=True)
    name = Column(Text, nullable=False)
    entity_type = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
