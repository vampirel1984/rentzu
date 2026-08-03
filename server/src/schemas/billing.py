# Modified by AI on 07/18/2026. Edit #1.
# Plan-tier billing schemas per pricing_research.md.
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class VoiceQuotaRead(BaseModel):
    plan: str
    limit: int
    used: int
    remaining: int
    period_start: datetime | None = None


class BillingOverviewRead(BaseModel):
    organization_id: UUID
    plan: str
    billing_interval: str
    billing_provider: str = 'stripe'
    total_units: int
    billed_units: int
    amount_per_unit_cents: int
    estimated_total_cents: int
    currency: str = 'usd'
    subscription_status: str
    cancel_at_period_end: bool = False
    current_period_end: datetime | None = None
    checkout_available: bool
    customer_portal_available: bool
    stripe_configured: bool
    revenuecat_configured: bool = False
    recommended_action: str
    exports_allowed: bool
    voice_quota: VoiceQuotaRead


class PlanOptionRead(BaseModel):
    plan: str
    label: str
    monthly_cents_per_unit: int
    yearly_cents_per_unit: int
    voice_quota_flat: int
    voice_quota_per_unit: int
    exports_allowed: bool
    revenuecat_entitlement_id: str | None = None


class BillingPlansRead(BaseModel):
    plans: list[PlanOptionRead]


class BillingCheckoutCreate(BaseModel):
    organization_id: UUID
    plan: str
    billing_interval: str = 'month'


class BillingCheckoutRead(BaseModel):
    checkout_url: str
    session_id: str


class BillingPortalCreate(BaseModel):
    organization_id: UUID


class BillingPortalRead(BaseModel):
    portal_url: str


class BillingSyncUnitsCreate(BaseModel):
    organization_id: UUID


class RevenueCatSyncCreate(BaseModel):
    """Sent by the app right after a purchase/restore completes on-device."""
    organization_id: UUID
    app_user_id: str
    active_entitlement_ids: list[str] = []
    product_id: str | None = None
    store: str | None = None
