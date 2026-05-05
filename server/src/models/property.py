from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from db import Base


class Property(Base):
    __tablename__ = 'properties'

    id = Column(UUID(as_uuid=True), primary_key=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    name = Column(Text, nullable=False)
    property_type = Column(Text, nullable=False)
    address_line_1 = Column(Text, nullable=False)
    address_line_2 = Column(Text)
    city = Column(Text)
    state = Column(Text)
    postal_code = Column(Text)
    country = Column(Text)
    total_units = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
