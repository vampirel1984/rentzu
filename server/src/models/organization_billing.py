from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from db import Base


class OrganizationBilling(Base):
    __tablename__ = 'organization_billing'

    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id', ondelete='CASCADE'), primary_key=True)
    # Modified by AI on 07/25/2026.
    # 'stripe' = billed via Stripe Checkout (web); 'revenuecat' = billed via
    # native App Store/Play Store in-app purchase, synced through RevenueCat.
    # See pricing_research.md "Native mobile billing (RevenueCat)".
    billing_provider = Column(Text, nullable=False, default='stripe')
    revenuecat_app_user_id = Column(Text)
    revenuecat_entitlement_id = Column(Text)
    revenuecat_product_id = Column(Text)
    revenuecat_store = Column(Text)
    stripe_customer_id = Column(Text)
    stripe_subscription_id = Column(Text)
    stripe_price_id = Column(Text)
    stripe_product_id = Column(Text)
    stripe_checkout_session_id = Column(Text)
    subscription_status = Column(Text, nullable=False, default='free')
    # Modified by AI on 07/18/2026. Edit #1.
    # Plan tiers per pricing_research.md: 'free' | 'normal' | 'pro'. Billing is
    # account-level — once paid, every unit in the org is billed (no per-unit
    # cherry-picking) and 'billing_interval' selects 'month' vs 'year' pricing.
    plan = Column(Text, nullable=False, default='free')
    billing_interval = Column(Text, nullable=False, default='month')
    total_unit_count = Column(Integer, nullable=False, default=0)
    free_unit_count = Column(Integer, nullable=False, default=1)
    billed_unit_count = Column(Integer, nullable=False, default=0)
    amount_per_unit_cents = Column(Integer, nullable=False, default=99)
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    current_period_end = Column(DateTime(timezone=True))
    # Voice-to-text quota tracking (account-wide, resets monthly). Free tier
    # gets a flat allowance; paid tiers scale with unit count.
    voice_quota_period_start = Column(DateTime(timezone=True))
    voice_used_this_period = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

