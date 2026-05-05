from sqlalchemy import Column, Date, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from db import Base


class FinancialRecord(Base):
    __tablename__ = 'financial_records'

    id = Column(UUID(as_uuid=True), primary_key=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    extracted_record_id = Column(UUID(as_uuid=True))
    type = Column(Text, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(Text, nullable=False, default='USD')
    record_date = Column(Date, nullable=False)
    counterparty = Column(Text)
    description = Column(Text, nullable=False)
    property_id = Column(UUID(as_uuid=True), ForeignKey('properties.id', ondelete='CASCADE'), nullable=False)
    unit_id = Column(UUID(as_uuid=True), ForeignKey('units.id', ondelete='SET NULL'))
    lease_id = Column(UUID(as_uuid=True))
    category_code = Column(Text)
    sub_type = Column(Text)
    notes = Column(Text)
    source = Column(Text, nullable=False, default='manual')
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
