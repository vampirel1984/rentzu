from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from db import Base


class BillingEvent(Base):
    __tablename__ = 'billing_events'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True)
    stripe_event_id = Column(Text, unique=True, nullable=False)
    stripe_event_type = Column(Text, nullable=False)
    stripe_customer_id = Column(Text)
    stripe_subscription_id = Column(Text)
    stripe_invoice_id = Column(Text)
    stripe_payment_intent_id = Column(Text)
    stripe_checkout_session_id = Column(Text)
    stripe_price_id = Column(Text)
    stripe_product_id = Column(Text)
    amount_cents = Column(Integer)
    currency = Column(Text)
    status = Column(Text)
    paid = Column(Boolean, nullable=False, default=False)
    occurred_at = Column(DateTime(timezone=True))
    raw_payload = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
