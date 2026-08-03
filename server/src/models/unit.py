# Modified by AI on 07/24/2026. Edit #1. Added tenant_name column so each unit can store the current renter's name entered from the app's per-unit settings.
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from db import Base


class Unit(Base):
    __tablename__ = 'units'

    id = Column(UUID(as_uuid=True), primary_key=True)
    property_id = Column(UUID(as_uuid=True), ForeignKey('properties.id', ondelete='CASCADE'), nullable=False)
    unit_code = Column(Text, nullable=False)
    tenant_name = Column(Text)
    unit_type = Column(Text)
    bedroom_count = Column(Numeric(4, 1))
    bathroom_count = Column(Numeric(4, 1))
    square_feet = Column(Integer)
    market_rent = Column(Numeric(12, 2))
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
