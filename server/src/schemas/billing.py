from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class BillingOverviewRead(BaseModel):
    organization_id: UUID
    total_units: int
    free_units: int
    billable_units: int
    amount_per_unit_cents: int
    estimated_monthly_total_cents: int
    currency: str = 'usd'
    subscription_status: str
    cancel_at_period_end: bool = False
    current_period_end: datetime | None = None
    checkout_available: bool
    customer_portal_available: bool
    stripe_configured: bool
    recommended_action: str


class BillingCheckoutCreate(BaseModel):
    organization_id: UUID


class BillingCheckoutRead(BaseModel):
    checkout_url: str
    session_id: str


class BillingPortalCreate(BaseModel):
    organization_id: UUID


class BillingPortalRead(BaseModel):
    portal_url: str
