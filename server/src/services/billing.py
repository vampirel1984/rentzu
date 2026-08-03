from __future__ import annotations

# Generated/Modified by AI on 07/18/2026. Edit #1.
# Plan-tier billing per pricing_research.md: account-level entitlements,
# per-unit pricing across ALL units (no free-unit carve-out once paid).
import json
import os
from datetime import UTC, datetime, timedelta
from uuid import UUID

import stripe
from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.billing_event import BillingEvent
from models.organization_billing import OrganizationBilling
from models.property import Property
from models.revenuecat_event import RevenueCatEvent

PLAN_FREE = 'free'
PLAN_NORMAL = 'normal'
PLAN_PRO = 'pro'
VALID_PLANS = {PLAN_FREE, PLAN_NORMAL, PLAN_PRO}
VALID_INTERVALS = {'month', 'year'}
VOICE_QUOTA_PERIOD_DAYS = 30

# Modified by AI on 07/25/2026.
# Native mobile billing via RevenueCat, per pricing_research.md's "Native
# mobile billing (RevenueCat)" section. Apple/Google require their own
# in-app-purchase systems for digital subscriptions unlocked inside the app
# (App Store 3.1.1 / Play Billing policy) — Stripe Checkout is web-only.
# RevenueCat wraps StoreKit + Play Billing behind one webhook/SDK. Plan rank
# used to resolve "highest active entitlement wins" when a customer has more
# than one entitlement active.
BILLING_PROVIDER_STRIPE = 'stripe'
BILLING_PROVIDER_REVENUECAT = 'revenuecat'
_PLAN_RANK = {PLAN_FREE: 0, PLAN_NORMAL: 1, PLAN_PRO: 2}
# RevenueCat event types that grant/renew an entitlement vs. ones that end it.
_REVENUECAT_ACTIVE_EVENT_TYPES = {
    'INITIAL_PURCHASE',
    'RENEWAL',
    'PRODUCT_CHANGE',
    'UNCANCELLATION',
    'TRANSFER',
    'NON_RENEWING_PURCHASE',
}
_REVENUECAT_CANCEL_EVENT_TYPES = {'CANCELLATION'}
_REVENUECAT_EXPIRE_EVENT_TYPES = {'EXPIRATION'}


def _env_cents(name: str, default_cents: int) -> int:
    return max(int(os.getenv(name, str(default_cents))), 0)


def _env_int(name: str, default_value: int) -> int:
    return max(int(os.getenv(name, str(default_value))), 0)


def _revenuecat_entitlement_id_for(plan: str) -> str:
    env_name = f'REVENUECAT_ENTITLEMENT_{plan.upper()}'
    return os.getenv(env_name, '').strip()


def plan_catalog() -> dict:
    """Pricing/quota catalog per pricing_research.md. Amounts are display/estimate
    figures; the actual charged amount is whatever the configured Stripe Price
    (web) or App Store/Play Store product (native, via RevenueCat) charges."""
    return {
        PLAN_FREE: {
            'label': 'Free',
            'monthly_cents_per_unit': 0,
            'yearly_cents_per_unit': 0,
            'voice_quota_flat': _env_int('RENTZU_FREE_VOICE_QUOTA', 3),
            'voice_quota_per_unit': 0,
            'exports_allowed': False,
            'revenuecat_entitlement_id': None,
        },
        PLAN_NORMAL: {
            'label': 'Normal',
            'monthly_cents_per_unit': _env_cents('RENTZU_PRICE_NORMAL_MONTHLY_CENTS', 199),
            'yearly_cents_per_unit': _env_cents('RENTZU_PRICE_NORMAL_YEARLY_CENTS', 1999),
            'voice_quota_flat': 0,
            'voice_quota_per_unit': _env_int('RENTZU_VOICE_QUOTA_PER_UNIT_NORMAL', 10),
            'exports_allowed': True,
            'revenuecat_entitlement_id': _revenuecat_entitlement_id_for(PLAN_NORMAL) or None,
        },
        PLAN_PRO: {
            'label': 'Pro',
            'monthly_cents_per_unit': _env_cents('RENTZU_PRICE_PRO_MONTHLY_CENTS', 299),
            'yearly_cents_per_unit': _env_cents('RENTZU_PRICE_PRO_YEARLY_CENTS', 2900),
            'voice_quota_flat': 0,
            'voice_quota_per_unit': _env_int('RENTZU_VOICE_QUOTA_PER_UNIT_PRO', 30),
            'exports_allowed': True,
            'revenuecat_entitlement_id': _revenuecat_entitlement_id_for(PLAN_PRO) or None,
        },
    }


def _interval_from_product_id(product_id: str | None) -> str | None:
    """Derives the billing interval from a store product identifier (e.g.
    'pro_yearly' -> 'year'). RevenueCat webhooks/SDK results identify the
    purchased product but not our interval vocabulary, and without this the
    interval would stay at its default and the Plan card would show monthly
    pricing for a yearly subscription."""
    if not product_id:
        return None
    normalized = product_id.strip().lower()
    if 'year' in normalized or 'annual' in normalized:
        return 'year'
    if 'month' in normalized:
        return 'month'
    return None


def _plan_for_entitlement_id(entitlement_id: str) -> str | None:
    for plan in (PLAN_PRO, PLAN_NORMAL):
        if _revenuecat_entitlement_id_for(plan) == entitlement_id:
            return plan
    return None


def _highest_plan_for_entitlements(active_entitlement_ids: list[str]) -> str:
    """Highest-ranked plan among the given active RevenueCat entitlement ids
    (a customer could technically hold more than one; pick the best)."""
    best = PLAN_FREE
    for entitlement_id in active_entitlement_ids or []:
        plan = _plan_for_entitlement_id(entitlement_id)
        if plan and _PLAN_RANK[plan] > _PLAN_RANK[best]:
            best = plan
    return best


def _stripe_price_id_for(plan: str, interval: str) -> str:
    env_name = f'STRIPE_PRICE_{plan.upper()}_{"MONTHLY" if interval == "month" else "YEARLY"}'
    return os.getenv(env_name, '').strip()


def _stripe_price_reverse_lookup() -> dict[str, tuple[str, str]]:
    mapping: dict[str, tuple[str, str]] = {}
    for plan in (PLAN_NORMAL, PLAN_PRO):
        for interval in ('month', 'year'):
            price_id = _stripe_price_id_for(plan, interval)
            if price_id:
                mapping[price_id] = (plan, interval)
    return mapping


def _stripe_secret_key() -> str:
    return os.getenv('STRIPE_SECRET_KEY', '').strip()


def _max_voice_seconds() -> int:
    return _env_int('RENTZU_MAX_VOICE_SECONDS', 30)


def _success_url() -> str:
    return os.getenv(
        'STRIPE_CHECKOUT_SUCCESS_URL',
        'https://example.com/rentzu/billing/success?session_id={CHECKOUT_SESSION_ID}',
    ).strip()


def _cancel_url() -> str:
    return os.getenv(
        'STRIPE_CHECKOUT_CANCEL_URL',
        'https://example.com/rentzu/billing/cancel',
    ).strip()


def _portal_return_url() -> str:
    return os.getenv(
        'STRIPE_CUSTOMER_PORTAL_RETURN_URL',
        'https://example.com/rentzu/billing',
    ).strip()


def stripe_is_configured() -> bool:
    catalog = plan_catalog()
    has_any_price = any(_stripe_price_id_for(plan, interval) for plan in (PLAN_NORMAL, PLAN_PRO) for interval in ('month', 'year'))
    return bool(_stripe_secret_key() and has_any_price and catalog)


def stripe_publishable_key_configured() -> bool:
    return bool(os.getenv('STRIPE_PUBLISHABLE_KEY', '').strip())


def revenuecat_is_configured() -> bool:
    catalog = plan_catalog()
    return any(catalog[plan]['revenuecat_entitlement_id'] for plan in (PLAN_NORMAL, PLAN_PRO))


def _revenuecat_webhook_authorization() -> str:
    return os.getenv('REVENUECAT_WEBHOOK_AUTHORIZATION', '').strip()


def verify_revenuecat_webhook_authorization(authorization_header: str | None) -> None:
    """RevenueCat lets you set a fixed 'Authorization' header value on the
    webhook it sends; we compare against a server-side secret configured in
    REVENUECAT_WEBHOOK_AUTHORIZATION. If unset, the webhook is rejected (fail
    closed) rather than silently accepting unauthenticated billing events."""
    expected = _revenuecat_webhook_authorization()
    if not expected or authorization_header != expected:
        raise HTTPException(status_code=401, detail='Invalid or missing RevenueCat webhook authorization')


def _configure_stripe() -> None:
    secret = _stripe_secret_key()
    if not secret:
        raise HTTPException(status_code=503, detail='Stripe secret key is not configured')
    stripe.api_key = secret


def get_or_create_billing_row(db: Session, organization_id: UUID) -> OrganizationBilling:
    billing = db.query(OrganizationBilling).filter(OrganizationBilling.organization_id == organization_id).first()
    if billing:
        return billing
    billing = OrganizationBilling(
        organization_id=organization_id,
        subscription_status='free',
        plan=PLAN_FREE,
        billing_interval='month',
        free_unit_count=0,
        amount_per_unit_cents=0,
        voice_quota_period_start=datetime.now(UTC),
        voice_used_this_period=0,
    )
    db.add(billing)
    db.commit()
    db.refresh(billing)
    return billing


def calculate_unit_counts(db: Session, organization_id: UUID) -> int:
    """Total units across the org's active properties. Per pricing_research.md,
    once an account is paid, ALL of its units are billed — there is no
    per-unit free carve-out, so this is the single number used for both
    pricing and voice-quota scaling."""
    properties = (
        db.query(Property)
        .filter(Property.organization_id == organization_id)
        .filter(Property.is_active.is_(True))
        .all()
    )
    return sum(max(int(property_row.total_units or 1), 1) for property_row in properties)


def _amount_per_unit_cents(plan: str, interval: str) -> int:
    catalog = plan_catalog()
    entry = catalog.get(plan, catalog[PLAN_FREE])
    return entry['yearly_cents_per_unit'] if interval == 'year' else entry['monthly_cents_per_unit']


def _maybe_reset_voice_period(billing: OrganizationBilling) -> None:
    now = datetime.now(UTC)
    period_start = billing.voice_quota_period_start
    if period_start is not None and period_start.tzinfo is None:
        period_start = period_start.replace(tzinfo=UTC)
    if period_start is None or now >= period_start + timedelta(days=VOICE_QUOTA_PERIOD_DAYS):
        billing.voice_quota_period_start = now
        billing.voice_used_this_period = 0


def _voice_quota_limit(plan: str, total_units: int) -> int:
    catalog = plan_catalog()
    entry = catalog.get(plan, catalog[PLAN_FREE])
    if plan == PLAN_FREE:
        return entry['voice_quota_flat']
    return entry['voice_quota_per_unit'] * max(total_units, 0)


def get_voice_quota_status(db: Session, organization_id: UUID) -> dict:
    """Voice quota is account-wide: free = flat allowance; paid = per-unit quota × total units."""
    billing = get_or_create_billing_row(db, organization_id)
    _maybe_reset_voice_period(billing)
    total_units = calculate_unit_counts(db, organization_id)
    limit = _voice_quota_limit(billing.plan, total_units)
    db.add(billing)
    db.commit()
    db.refresh(billing)
    used = billing.voice_used_this_period
    return {
        'plan': billing.plan,
        'limit': limit,
        'used': used,
        'remaining': max(limit - used, 0),
        'period_start': billing.voice_quota_period_start,
    }


def consume_voice_quota(db: Session, organization_id: UUID) -> dict:
    """Increments voice usage for a conversion; raises 402 if the account has no quota left."""
    status = get_voice_quota_status(db, organization_id)
    if status['remaining'] <= 0:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Voice quota exceeded ({status['used']}/{status['limit']} used this period). "
                'Upgrade your plan for more voice-to-text conversions.'
            ),
        )
    billing = get_or_create_billing_row(db, organization_id)
    billing.voice_used_this_period += 1
    db.add(billing)
    db.commit()
    db.refresh(billing)
    status['used'] = billing.voice_used_this_period
    status['remaining'] = max(status['limit'] - status['used'], 0)
    return status


def exports_allowed_for_org(db: Session, organization_id: UUID) -> bool:
    billing = get_or_create_billing_row(db, organization_id)
    catalog = plan_catalog()
    return bool(catalog.get(billing.plan, catalog[PLAN_FREE])['exports_allowed'])


def get_billing_overview(db: Session, organization_id: UUID):
    billing = get_or_create_billing_row(db, organization_id)
    total_units = calculate_unit_counts(db, organization_id)
    billed_units = total_units if billing.plan != PLAN_FREE else 0
    amount_per_unit_cents = _amount_per_unit_cents(billing.plan, billing.billing_interval)

    billing.total_unit_count = total_units
    billing.free_unit_count = 0 if billing.plan != PLAN_FREE else total_units
    billing.billed_unit_count = billed_units
    billing.amount_per_unit_cents = amount_per_unit_cents
    db.add(billing)
    db.commit()
    db.refresh(billing)

    estimated_total_cents = billed_units * amount_per_unit_cents
    is_revenuecat_billed = billing.billing_provider == BILLING_PROVIDER_REVENUECAT
    recommended_action = 'none'
    if billing.plan == PLAN_FREE:
        recommended_action = 'choose_plan'
    elif is_revenuecat_billed:
        # Modified by AI on 07/25/2026. Apple/Google, not us, own subscription
        # management for native purchases — send the user to the OS's native
        # "Manage Subscriptions" screen instead of a Stripe portal link.
        recommended_action = 'manage_in_app_store'
    elif billing.stripe_customer_id:
        recommended_action = 'open_portal'

    voice_quota = get_voice_quota_status(db, organization_id)

    return {
        'organization_id': organization_id,
        'plan': billing.plan,
        'billing_interval': billing.billing_interval,
        'billing_provider': billing.billing_provider,
        'total_units': total_units,
        'billed_units': billed_units,
        'amount_per_unit_cents': amount_per_unit_cents,
        'estimated_total_cents': estimated_total_cents,
        'subscription_status': billing.subscription_status or 'free',
        'cancel_at_period_end': bool(billing.cancel_at_period_end),
        'current_period_end': billing.current_period_end,
        # Stripe checkout/portal are web-only per pricing_research.md; never
        # offer them once an account is billed through RevenueCat/app stores.
        'checkout_available': stripe_is_configured() and total_units > 0 and not is_revenuecat_billed,
        'customer_portal_available': stripe_is_configured() and bool(billing.stripe_customer_id) and not is_revenuecat_billed,
        'stripe_configured': stripe_is_configured(),
        'revenuecat_configured': revenuecat_is_configured(),
        'recommended_action': recommended_action,
        'exports_allowed': plan_catalog()[billing.plan]['exports_allowed'] if billing.plan in plan_catalog() else False,
        'voice_quota': voice_quota,
    }


def create_checkout_session(db: Session, organization_id: UUID, plan: str, interval: str):
    if plan not in {PLAN_NORMAL, PLAN_PRO}:
        raise HTTPException(status_code=400, detail=f'Invalid plan "{plan}". Must be "normal" or "pro"')
    if interval not in VALID_INTERVALS:
        raise HTTPException(status_code=400, detail=f'Invalid interval "{interval}". Must be "month" or "year"')

    billing = get_or_create_billing_row(db, organization_id)
    if billing.billing_provider == BILLING_PROVIDER_REVENUECAT and billing.plan != PLAN_FREE:
        raise HTTPException(
            status_code=400,
            detail='This workspace is billed through the App Store/Play Store. Manage the subscription from your device settings instead of Stripe.',
        )
    total_units = calculate_unit_counts(db, organization_id)
    if total_units <= 0:
        raise HTTPException(status_code=400, detail='Add at least one property/unit before subscribing')

    price_id = _stripe_price_id_for(plan, interval)
    if not price_id:
        raise HTTPException(status_code=503, detail=f'Stripe price id is not configured for {plan}/{interval}')

    _configure_stripe()

    session = stripe.checkout.Session.create(
        mode='subscription',
        success_url=_success_url(),
        cancel_url=_cancel_url(),
        client_reference_id=str(organization_id),
        customer=billing.stripe_customer_id or None,
        allow_promotion_codes=True,
        line_items=[{'price': price_id, 'quantity': total_units}],
        subscription_data={
            'metadata': {
                'organization_id': str(organization_id),
                'plan': plan,
                'billing_interval': interval,
                'total_units': str(total_units),
            }
        },
        metadata={
            'organization_id': str(organization_id),
            'plan': plan,
            'billing_interval': interval,
            'total_units': str(total_units),
        },
    )

    billing.stripe_checkout_session_id = session.id
    db.add(billing)
    db.commit()

    return {'checkout_url': session.url, 'session_id': session.id}


def create_customer_portal_session(db: Session, organization_id: UUID):
    billing = get_or_create_billing_row(db, organization_id)
    if not billing.stripe_customer_id:
        raise HTTPException(status_code=400, detail='No Stripe customer exists for this workspace yet')

    _configure_stripe()
    session = stripe.billing_portal.Session.create(customer=billing.stripe_customer_id, return_url=_portal_return_url())
    return {'portal_url': session.url}


def sync_subscription_quantity_to_units(db: Session, organization_id: UUID):
    """Keeps the Stripe subscription quantity equal to the org's total unit count.
    Call this after adding/removing a property or unit on a paid account so
    price scales with portfolio size (prorated by Stripe)."""
    billing = get_or_create_billing_row(db, organization_id)
    if not billing.stripe_subscription_id:
        return get_billing_overview(db, organization_id)

    _configure_stripe()
    subscription = stripe.Subscription.retrieve(billing.stripe_subscription_id, expand=['items.data.price'])
    items = subscription.get('items', {}).get('data', [])
    if not items:
        return get_billing_overview(db, organization_id)

    total_units = calculate_unit_counts(db, organization_id)
    if total_units <= 0:
        raise HTTPException(status_code=400, detail='No units remain on this workspace. Cancel this subscription in Stripe Customer Portal instead of syncing quantity to zero')

    stripe.Subscription.modify(
        billing.stripe_subscription_id,
        items=[{'id': items[0]['id'], 'quantity': total_units}],
        metadata={
            'organization_id': str(organization_id),
            'plan': billing.plan,
            'billing_interval': billing.billing_interval,
            'total_units': str(total_units),
        },
        proration_behavior='create_prorations',
    )
    return get_billing_overview(db, organization_id)


def _billing_by_customer_or_subscription(db: Session, *, customer_id: str | None = None, subscription_id: str | None = None):
    query = db.query(OrganizationBilling)
    if subscription_id:
        billing = query.filter(OrganizationBilling.stripe_subscription_id == subscription_id).first()
        if billing:
            return billing
    if customer_id:
        return query.filter(OrganizationBilling.stripe_customer_id == customer_id).first()
    return None


def _to_datetime(timestamp: int | None):
    if not timestamp:
        return None
    return datetime.fromtimestamp(timestamp, tz=UTC)


def _apply_subscription_snapshot(db: Session, organization_id: UUID, subscription):
    billing = get_or_create_billing_row(db, organization_id)
    items = subscription.get('items', {}).get('data', []) if subscription else []
    first_item = items[0] if items else None
    price = first_item.get('price') if first_item else None
    price_id = price.get('id') if price else None

    metadata = subscription.get('metadata', {}) or {}
    plan, interval = (metadata.get('plan'), metadata.get('billing_interval'))
    if not plan or plan not in VALID_PLANS or not interval or interval not in VALID_INTERVALS:
        reverse = _stripe_price_reverse_lookup()
        looked_up = reverse.get(price_id) if price_id else None
        if looked_up:
            plan, interval = looked_up

    status = subscription.get('status') or billing.subscription_status or 'free'
    billing.stripe_customer_id = subscription.get('customer') or billing.stripe_customer_id
    billing.stripe_subscription_id = subscription.get('id') or billing.stripe_subscription_id
    billing.stripe_price_id = price_id or billing.stripe_price_id
    billing.stripe_product_id = price.get('product') if price else billing.stripe_product_id
    billing.subscription_status = status
    billing.cancel_at_period_end = bool(subscription.get('cancel_at_period_end'))
    billing.current_period_end = _to_datetime(subscription.get('current_period_end'))

    if status in {'active', 'trialing'} and plan in {PLAN_NORMAL, PLAN_PRO}:
        billing.plan = plan
        billing.billing_interval = interval
    elif status in {'canceled', 'unpaid', 'incomplete_expired'}:
        billing.plan = PLAN_FREE
        billing.billing_interval = 'month'

    total_units = calculate_unit_counts(db, organization_id)
    billing.total_unit_count = total_units
    billing.billed_unit_count = total_units if billing.plan != PLAN_FREE else 0
    billing.free_unit_count = total_units if billing.plan == PLAN_FREE else 0
    billing.amount_per_unit_cents = _amount_per_unit_cents(billing.plan, billing.billing_interval)
    db.add(billing)
    db.commit()
    db.refresh(billing)
    return billing


def _event_timestamp(event: dict, data_object: dict):
    return _to_datetime(event.get('created')) or _to_datetime(data_object.get('created'))


def _upsert_billing_event(
    db: Session,
    *,
    event: dict,
    organization_id: UUID,
    data_object: dict,
    status: str | None = None,
    paid: bool | None = None,
):
    stripe_event_id = event.get('id')
    if not stripe_event_id:
        return

    items = data_object.get('lines', {}).get('data', []) if isinstance(data_object, dict) else []
    first_line = items[0] if items else {}
    price = first_line.get('price') or data_object.get('price') or {}

    row = db.query(BillingEvent).filter(BillingEvent.stripe_event_id == stripe_event_id).first()
    if not row:
        row = BillingEvent(
            organization_id=organization_id,
            stripe_event_id=stripe_event_id,
            stripe_event_type=event.get('type', ''),
        )

    row.organization_id = organization_id
    row.stripe_event_type = event.get('type', '')
    row.stripe_customer_id = data_object.get('customer') or row.stripe_customer_id
    row.stripe_subscription_id = data_object.get('subscription') or row.stripe_subscription_id
    row.stripe_invoice_id = data_object.get('id') if str(event.get('type', '')).startswith('invoice.') else (data_object.get('invoice') or row.stripe_invoice_id)
    row.stripe_payment_intent_id = data_object.get('payment_intent') or row.stripe_payment_intent_id
    row.stripe_checkout_session_id = data_object.get('id') if event.get('type') == 'checkout.session.completed' else row.stripe_checkout_session_id
    row.stripe_price_id = price.get('id') if isinstance(price, dict) else row.stripe_price_id
    row.stripe_product_id = price.get('product') if isinstance(price, dict) else row.stripe_product_id
    row.amount_cents = data_object.get('amount_paid') or data_object.get('amount_due') or data_object.get('amount_total') or row.amount_cents
    row.currency = data_object.get('currency') or row.currency
    row.status = status or data_object.get('status') or row.status
    row.paid = paid if paid is not None else bool(data_object.get('paid', row.paid))
    row.occurred_at = _event_timestamp(event, data_object)
    row.raw_payload = json.dumps(event, ensure_ascii=False)
    db.add(row)
    db.commit()


def handle_stripe_event(db: Session, event: dict):
    event_type = event.get('type', '')
    data_object = event.get('data', {}).get('object', {})

    if event_type == 'checkout.session.completed':
        organization_id = data_object.get('client_reference_id') or data_object.get('metadata', {}).get('organization_id')
        if organization_id:
            org_uuid = UUID(organization_id)
            billing = get_or_create_billing_row(db, org_uuid)
            billing.stripe_customer_id = data_object.get('customer') or billing.stripe_customer_id
            billing.stripe_subscription_id = data_object.get('subscription') or billing.stripe_subscription_id
            billing.stripe_checkout_session_id = data_object.get('id') or billing.stripe_checkout_session_id
            checkout_metadata = data_object.get('metadata', {}) or {}
            checkout_plan = checkout_metadata.get('plan')
            checkout_interval = checkout_metadata.get('billing_interval')
            if checkout_plan in {PLAN_NORMAL, PLAN_PRO} and checkout_interval in VALID_INTERVALS:
                billing.plan = checkout_plan
                billing.billing_interval = checkout_interval
            if billing.subscription_status in {'free', '', None}:
                billing.subscription_status = 'checkout_completed'
            db.add(billing)
            db.commit()
            _upsert_billing_event(db, event=event, organization_id=org_uuid, data_object=data_object, status='checkout_completed', paid=False)
        return

    if event_type.startswith('customer.subscription.'):
        metadata = data_object.get('metadata', {}) or {}
        organization_id = metadata.get('organization_id')
        if organization_id:
            org_uuid = UUID(organization_id)
            _apply_subscription_snapshot(db, org_uuid, data_object)
            _upsert_billing_event(db, event=event, organization_id=org_uuid, data_object=data_object, status=data_object.get('status'), paid=data_object.get('status') in {'active', 'trialing'})
            return

        billing = _billing_by_customer_or_subscription(
            db,
            customer_id=data_object.get('customer'),
            subscription_id=data_object.get('id'),
        )
        if billing:
            _apply_subscription_snapshot(db, billing.organization_id, data_object)
            _upsert_billing_event(db, event=event, organization_id=billing.organization_id, data_object=data_object, status=data_object.get('status'), paid=data_object.get('status') in {'active', 'trialing'})
        return

    if event_type == 'invoice.payment_failed':
        billing = _billing_by_customer_or_subscription(
            db,
            customer_id=data_object.get('customer'),
            subscription_id=data_object.get('subscription'),
        )
        if billing:
            billing.subscription_status = 'past_due'
            db.add(billing)
            db.commit()
            _upsert_billing_event(db, event=event, organization_id=billing.organization_id, data_object=data_object, status='payment_failed', paid=False)
        return

    if event_type == 'invoice.paid':
        billing = _billing_by_customer_or_subscription(
            db,
            customer_id=data_object.get('customer'),
            subscription_id=data_object.get('subscription'),
        )
        if billing:
            if billing.subscription_status not in {'active', 'trialing'}:
                billing.subscription_status = 'active'
                db.add(billing)
                db.commit()
            _upsert_billing_event(db, event=event, organization_id=billing.organization_id, data_object=data_object, status='paid', paid=True)


def parse_and_verify_stripe_event(payload: bytes, signature: str | None):
    webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET', '').strip()
    if not webhook_secret:
        raise HTTPException(status_code=503, detail='Stripe webhook secret is not configured')
    if not signature:
        raise HTTPException(status_code=400, detail='Missing Stripe-Signature header')
    _configure_stripe()
    try:
        return stripe.Webhook.construct_event(payload=payload, sig_header=signature, secret=webhook_secret)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f'Invalid Stripe payload: {exc}')
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(status_code=400, detail=f'Invalid Stripe signature: {exc}')


# Modified by AI on 07/25/2026.
# Native mobile billing via RevenueCat (see plan_catalog()/verify_revenuecat_
# webhook_authorization() above and pricing_research.md's "Native mobile
# billing (RevenueCat)" section). The RevenueCat "app user id" IS the
# organization_id (the app calls Purchases.configure({ appUserID: organizationId })),
# so resolving the org from a webhook/sync call is a direct UUID parse — no
# separate alias table needed.


def _org_id_from_app_user_id(db: Session, app_user_id: str | None) -> UUID | None:
    if not app_user_id:
        return None
    try:
        return UUID(app_user_id)
    except ValueError:
        # Fallback for the rare case app_user_id isn't a UUID (e.g. RevenueCat
        # anonymous id before the app configured a custom appUserID).
        billing = db.query(OrganizationBilling).filter(OrganizationBilling.revenuecat_app_user_id == app_user_id).first()
        return billing.organization_id if billing else None


def apply_revenuecat_entitlement_state(
    db: Session,
    organization_id: UUID,
    *,
    active_entitlement_ids: list[str],
    app_user_id: str | None = None,
    product_id: str | None = None,
    store: str | None = None,
    cancel_at_period_end: bool | None = None,
):
    """Single source of truth for turning a RevenueCat entitlement snapshot
    into our plan/entitlement state. Called both by the webhook handler
    (server-to-server, authoritative for renewals/expirations) and by the
    app's post-purchase/restore sync call (so the UI updates immediately
    instead of waiting on webhook delivery)."""
    billing = get_or_create_billing_row(db, organization_id)
    plan = _highest_plan_for_entitlements(active_entitlement_ids)

    billing.billing_provider = BILLING_PROVIDER_REVENUECAT
    billing.plan = plan
    resolved_interval = _interval_from_product_id(product_id)
    billing.billing_interval = resolved_interval or billing.billing_interval or 'month'
    billing.subscription_status = 'active' if plan != PLAN_FREE else 'free'
    if app_user_id:
        billing.revenuecat_app_user_id = app_user_id
    if product_id:
        billing.revenuecat_product_id = product_id
    if store:
        billing.revenuecat_store = store
    catalog = plan_catalog()
    billing.revenuecat_entitlement_id = catalog.get(plan, catalog[PLAN_FREE])['revenuecat_entitlement_id']
    if cancel_at_period_end is not None:
        billing.cancel_at_period_end = cancel_at_period_end
    elif plan == PLAN_FREE:
        billing.cancel_at_period_end = False

    total_units = calculate_unit_counts(db, organization_id)
    billing.total_unit_count = total_units
    billing.billed_unit_count = total_units if plan != PLAN_FREE else 0
    billing.free_unit_count = total_units if plan == PLAN_FREE else 0
    billing.amount_per_unit_cents = _amount_per_unit_cents(plan, billing.billing_interval)
    db.add(billing)
    db.commit()
    db.refresh(billing)

    return get_billing_overview(db, organization_id)


def sync_revenuecat_entitlement(
    db: Session,
    organization_id: UUID,
    *,
    active_entitlement_ids: list[str],
    app_user_id: str | None = None,
    product_id: str | None = None,
    store: str | None = None,
):
    """Client-driven sync, called right after a purchase/restore completes on
    device so the app reflects the new plan immediately. Trusts the app's
    local RevenueCat SDK result (which itself validated the receipt with
    Apple/Google); the webhook remains the authoritative reconciliation path
    for renewals/cancellations that happen while the app isn't open."""
    return apply_revenuecat_entitlement_state(
        db,
        organization_id,
        active_entitlement_ids=active_entitlement_ids,
        app_user_id=app_user_id,
        product_id=product_id,
        store=store,
    )


def handle_revenuecat_webhook_event(db: Session, payload: dict) -> None:
    """Processes a RevenueCat webhook delivery. Payload shape:
    {"api_version": "1.0", "event": {"type": ..., "app_user_id": ...,
    "entitlement_ids": [...], "product_id": ..., "store": ..., "id": ...}}.
    See https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields.
    """
    event = payload.get('event', payload) or {}
    event_id = event.get('id')
    event_type = event.get('type')
    app_user_id = event.get('app_user_id')
    organization_id = _org_id_from_app_user_id(db, app_user_id)

    if event_id:
        # De-dupe: RevenueCat docs note the same event may be delivered more
        # than once. Skip re-processing (but still 200 the request).
        existing = db.query(RevenueCatEvent).filter(RevenueCatEvent.revenuecat_event_id == event_id).first()
        if existing:
            return

    if organization_id is None:
        # Unknown app_user_id (e.g. a test event, or a purchase made before
        # the app configured a custom appUserID) — nothing to apply, but
        # still record it if we can associate a raw payload for later review.
        return

    entitlement_ids = event.get('entitlement_ids') or ([event.get('entitlement_id')] if event.get('entitlement_id') else [])
    product_id = event.get('product_id')
    store = event.get('store')

    if event_type in _REVENUECAT_ACTIVE_EVENT_TYPES:
        apply_revenuecat_entitlement_state(
            db,
            organization_id,
            active_entitlement_ids=entitlement_ids,
            app_user_id=app_user_id,
            product_id=product_id,
            store=store,
            cancel_at_period_end=False,
        )
    elif event_type in _REVENUECAT_CANCEL_EVENT_TYPES:
        # Cancellation just stops auto-renew; the entitlement stays active
        # until it actually expires, so keep the current plan.
        billing = get_or_create_billing_row(db, organization_id)
        billing.cancel_at_period_end = True
        db.add(billing)
        db.commit()
    elif event_type in _REVENUECAT_EXPIRE_EVENT_TYPES:
        apply_revenuecat_entitlement_state(
            db,
            organization_id,
            active_entitlement_ids=[],
            app_user_id=app_user_id,
            product_id=product_id,
            store=store,
            cancel_at_period_end=False,
        )
    # BILLING_ISSUE and other event types: no plan change, just log below.

    if event_id:
        row = RevenueCatEvent(
            organization_id=organization_id,
            revenuecat_event_id=event_id,
            revenuecat_event_type=event_type or 'unknown',
            app_user_id=app_user_id,
            product_id=product_id,
            entitlement_ids=','.join(entitlement_ids) if entitlement_ids else None,
            period_type=event.get('period_type'),
            store=store,
            occurred_at=_to_datetime(event.get('event_timestamp_ms', 0) // 1000 if event.get('event_timestamp_ms') else None),
            raw_payload=json.dumps(payload),
        )
        db.add(row)
        db.commit()
