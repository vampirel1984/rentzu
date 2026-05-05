from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.orm import Session

from db import get_db
from dependencies import CurrentUser, get_current_user
from schemas.billing import (
    BillingCheckoutCreate,
    BillingCheckoutRead,
    BillingOverviewRead,
    BillingPortalCreate,
    BillingPortalRead,
)
from services.billing import (
    create_checkout_session,
    create_customer_portal_session,
    get_billing_overview,
    handle_stripe_event,
    parse_and_verify_stripe_event,
    sync_subscription_quantity_to_units,
)

router = APIRouter()


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
    return create_checkout_session(db, payload.organization_id)


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
    payload: BillingCheckoutCreate,
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
