from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from uuid import UUID

import stripe
from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.billing_event import BillingEvent
from models.organization_billing import OrganizationBilling
from models.property import Property


def _billing_free_units() -> int:
    return max(int(os.getenv('RENTZU_BILLING_FREE_UNITS', '1')), 0)


def _billing_unit_price_cents() -> int:
    return max(int(os.getenv('RENTZU_BILLING_PRICE_PER_EXTRA_UNIT_CENTS', '99')), 0)


def _stripe_secret_key() -> str:
    return os.getenv('STRIPE_SECRET_KEY', '').strip()


def _stripe_price_id() -> str:
    return os.getenv('STRIPE_PRICE_EXTRA_UNIT_MONTHLY', '').strip()


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
    return bool(_stripe_secret_key() and _stripe_price_id())


def stripe_publishable_key_configured() -> bool:
    return bool(os.getenv('STRIPE_PUBLISHABLE_KEY', '').strip())


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
        free_unit_count=_billing_free_units(),
        amount_per_unit_cents=_billing_unit_price_cents(),
    )
    db.add(billing)
    db.commit()
    db.refresh(billing)
    return billing


def calculate_unit_counts(db: Session, organization_id: UUID) -> tuple[int, int, int]:
    properties = (
        db.query(Property)
        .filter(Property.organization_id == organization_id)
        .filter(Property.is_active.is_(True))
        .all()
    )
    total_units = sum(max(int(property_row.total_units or 1), 1) for property_row in properties)
    free_units = _billing_free_units()
    billable_units = max(total_units - free_units, 0)
    return total_units, free_units, billable_units


def get_billing_overview(db: Session, organization_id: UUID):
    billing = get_or_create_billing_row(db, organization_id)
    total_units, free_units, billable_units = calculate_unit_counts(db, organization_id)
    billing.total_unit_count = total_units
    billing.free_unit_count = free_units
    billing.billed_unit_count = billable_units
    billing.amount_per_unit_cents = _billing_unit_price_cents()
    if billable_units == 0 and billing.subscription_status in {'free', 'incomplete', 'incomplete_expired', 'canceled', 'unpaid', 'past_due'}:
        billing.subscription_status = 'free'
    db.add(billing)
    db.commit()
    db.refresh(billing)

    estimated_monthly_total_cents = billable_units * billing.amount_per_unit_cents
    recommended_action = 'none'
    if billable_units > 0 and billing.subscription_status not in {'active', 'trialing'}:
        recommended_action = 'start_checkout'
    elif billing.stripe_customer_id:
        recommended_action = 'open_portal'

    return {
        'organization_id': organization_id,
        'total_units': total_units,
        'free_units': free_units,
        'billable_units': billable_units,
        'amount_per_unit_cents': billing.amount_per_unit_cents,
        'estimated_monthly_total_cents': estimated_monthly_total_cents,
        'subscription_status': billing.subscription_status or 'free',
        'cancel_at_period_end': bool(billing.cancel_at_period_end),
        'current_period_end': billing.current_period_end,
        'checkout_available': stripe_is_configured() and billable_units > 0 and billing.subscription_status not in {'active', 'trialing'},
        'customer_portal_available': stripe_is_configured() and bool(billing.stripe_customer_id),
        'stripe_configured': stripe_is_configured(),
        'recommended_action': recommended_action,
    }


def create_checkout_session(db: Session, organization_id: UUID):
    billing = get_or_create_billing_row(db, organization_id)
    total_units, free_units, billable_units = calculate_unit_counts(db, organization_id)
    billing.total_unit_count = total_units
    billing.free_unit_count = free_units
    billing.billed_unit_count = billable_units
    billing.amount_per_unit_cents = _billing_unit_price_cents()

    if billable_units <= 0:
        raise HTTPException(status_code=400, detail='This workspace is still free, there are no billable extra units yet')

    price_id = _stripe_price_id()
    if not price_id:
        raise HTTPException(status_code=503, detail='Stripe price id is not configured')

    _configure_stripe()

    session = stripe.checkout.Session.create(
        mode='subscription',
        success_url=_success_url(),
        cancel_url=_cancel_url(),
        client_reference_id=str(organization_id),
        customer=billing.stripe_customer_id or None,
        allow_promotion_codes=True,
        line_items=[{'price': price_id, 'quantity': billable_units}],
        subscription_data={
            'metadata': {
                'organization_id': str(organization_id),
                'billable_units': str(billable_units),
                'free_units': str(free_units),
                'total_units': str(total_units),
            }
        },
        metadata={
            'organization_id': str(organization_id),
            'billable_units': str(billable_units),
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
    billing = get_or_create_billing_row(db, organization_id)
    if not billing.stripe_subscription_id:
        return get_billing_overview(db, organization_id)

    _configure_stripe()
    subscription = stripe.Subscription.retrieve(billing.stripe_subscription_id, expand=['items.data.price'])
    items = subscription.get('items', {}).get('data', [])
    if not items:
        return get_billing_overview(db, organization_id)

    total_units, free_units, billable_units = calculate_unit_counts(db, organization_id)
    if billable_units <= 0:
        raise HTTPException(status_code=400, detail='No billable extra units remain. Cancel this subscription in Stripe Customer Portal instead of syncing quantity to zero')

    stripe.Subscription.modify(
        billing.stripe_subscription_id,
        items=[{'id': items[0]['id'], 'quantity': max(billable_units, 1)}],
        metadata={
            'organization_id': str(organization_id),
            'billable_units': str(billable_units),
            'free_units': str(free_units),
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

    billing.stripe_customer_id = subscription.get('customer') or billing.stripe_customer_id
    billing.stripe_subscription_id = subscription.get('id') or billing.stripe_subscription_id
    billing.stripe_price_id = price.get('id') if price else billing.stripe_price_id
    billing.stripe_product_id = price.get('product') if price else billing.stripe_product_id
    billing.subscription_status = subscription.get('status') or billing.subscription_status or 'free'
    billing.cancel_at_period_end = bool(subscription.get('cancel_at_period_end'))
    billing.current_period_end = _to_datetime(subscription.get('current_period_end'))
    billing.total_unit_count, billing.free_unit_count, billing.billed_unit_count = calculate_unit_counts(db, organization_id)
    billing.amount_per_unit_cents = _billing_unit_price_cents()
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
