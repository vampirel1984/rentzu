from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from db import Base


class OrganizationBilling(Base):
    __tablename__ = 'organization_billing'

    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id', ondelete='CASCADE'), primary_key=True)
    stripe_customer_id = Column(Text)
    stripe_subscription_id = Column(Text)
    stripe_price_id = Column(Text)
    stripe_product_id = Column(Text)
    stripe_checkout_session_id = Column(Text)
    subscription_status = Column(Text, nullable=False, default='free')
    total_unit_count = Column(Integer, nullable=False, default=0)
    free_unit_count = Column(Integer, nullable=False, default=1)
    billed_unit_count = Column(Integer, nullable=False, default=0)
    amount_per_unit_cents = Column(Integer, nullable=False, default=99)
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    current_period_end = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
