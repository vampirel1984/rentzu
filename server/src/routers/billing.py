# Modified by AI on 07/18/2026. Edit #1.
# Plan-tier billing router per pricing_research.md: adds /plans and passes
# plan+interval through checkout.
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.orm import Session

from db import get_db
from dependencies import CurrentUser, get_current_user
from schemas.billing import (
    BillingCheckoutCreate,
    BillingCheckoutRead,
    BillingOverviewRead,
    BillingPlansRead,
    BillingPortalCreate,
    BillingPortalRead,
    BillingSyncUnitsCreate,
    RevenueCatSyncCreate,
)
from services.billing import (
    create_checkout_session,
    create_customer_portal_session,
    get_billing_overview,
    handle_revenuecat_webhook_event,
    handle_stripe_event,
    parse_and_verify_stripe_event,
    plan_catalog,
    sync_revenuecat_entitlement,
    sync_subscription_quantity_to_units,
    verify_revenuecat_webhook_authorization,
)

router = APIRouter()


@router.get('/plans', response_model=BillingPlansRead)
def billing_plans():
    catalog = plan_catalog()
    return {
        'plans': [
            {
                'plan': plan_key,
                'label': entry['label'],
                'monthly_cents_per_unit': entry['monthly_cents_per_unit'],
                'yearly_cents_per_unit': entry['yearly_cents_per_unit'],
                'voice_quota_flat': entry['voice_quota_flat'],
                'voice_quota_per_unit': entry['voice_quota_per_unit'],
                'exports_allowed': entry['exports_allowed'],
                'revenuecat_entitlement_id': entry['revenuecat_entitlement_id'],
            }
            for plan_key, entry in catalog.items()
        ]
    }


@router.get('/overview', response_model=BillingOverviewRead)
def billing_overview(
    organization_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    current_user.require_org_access(organization_id)
    return get_billing_overview(db, organization_id)


@router.post('/checkout-session', response_model=BillingCheckoutRead)
def billing_checkout_session(
    payload: BillingCheckoutCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    current_user.require_org_access(payload.organization_id)
    return create_checkout_session(db, payload.organization_id, payload.plan, payload.billing_interval)


@router.post('/customer-portal', response_model=BillingPortalRead)
def billing_customer_portal(
    payload: BillingPortalCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    current_user.require_org_access(payload.organization_id)
    return create_customer_portal_session(db, payload.organization_id)


@router.post('/sync-subscription-units', response_model=BillingOverviewRead)
def billing_sync_subscription_units(
    payload: BillingSyncUnitsCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    current_user.require_org_access(payload.organization_id)
    return sync_subscription_quantity_to_units(db, payload.organization_id)


@router.post('/webhook')
async def billing_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias='Stripe-Signature'),
    db: Session = Depends(get_db),
):
    payload = await request.body()
    event = parse_and_verify_stripe_event(payload, stripe_signature)
    handle_stripe_event(db, event)
    return {'ok': True}


# Modified by AI on 07/25/2026.
# Native mobile billing via RevenueCat per pricing_research.md's "Native
# mobile billing (RevenueCat)" section.


@router.post('/revenuecat/sync', response_model=BillingOverviewRead)
def billing_revenuecat_sync(
    payload: RevenueCatSyncCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Called by the app right after a purchase/restore completes so the UI
    reflects the new plan immediately, without waiting on webhook delivery."""
    current_user.require_org_access(payload.organization_id)
    return sync_revenuecat_entitlement(
        db,
        payload.organization_id,
        active_entitlement_ids=payload.active_entitlement_ids,
        app_user_id=payload.app_user_id,
        product_id=payload.product_id,
        store=payload.store,
    )


@router.post('/revenuecat/webhook')
async def billing_revenuecat_webhook(
    request: Request,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Server-to-server webhook from RevenueCat — authoritative source for
    renewals/cancellations/expirations that happen while the app isn't open.
    Configure the same shared secret as REVENUECAT_WEBHOOK_AUTHORIZATION in
    the RevenueCat dashboard's webhook "Authorization header value" field."""
    verify_revenuecat_webhook_authorization(authorization)
    payload = await request.json()
    handle_revenuecat_webhook_event(db, payload)
    return {'ok': True}
