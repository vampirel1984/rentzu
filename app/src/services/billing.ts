import { Linking } from 'react-native';

import { getJson, postJson } from './api';

// Modified by AI on 07/18/2026. Edit #1.
// Plan-tier billing client per pricing_research.md.
export type VoiceQuota = {
  plan: string;
  limit: number;
  used: number;
  remaining: number;
  period_start?: string | null;
};

export type BillingOverview = {
  organization_id: string;
  plan: 'free' | 'normal' | 'pro';
  billing_interval: 'month' | 'year';
  billing_provider: 'stripe' | 'revenuecat';
  total_units: number;
  billed_units: number;
  amount_per_unit_cents: number;
  estimated_total_cents: number;
  currency: string;
  subscription_status: string;
  cancel_at_period_end: boolean;
  current_period_end?: string | null;
  checkout_available: boolean;
  customer_portal_available: boolean;
  stripe_configured: boolean;
  revenuecat_configured: boolean;
  recommended_action: string;
  exports_allowed: boolean;
  voice_quota: VoiceQuota;
};

export type PlanOption = {
  plan: 'free' | 'normal' | 'pro';
  label: string;
  monthly_cents_per_unit: number;
  yearly_cents_per_unit: number;
  voice_quota_flat: number;
  voice_quota_per_unit: number;
  exports_allowed: boolean;
  revenuecat_entitlement_id: string | null;
};

type CheckoutSessionResponse = {
  checkout_url: string;
  session_id: string;
};

type PortalSessionResponse = {
  portal_url: string;
};

export async function getBillingOverview(organizationId: string) {
  return getJson<BillingOverview>(`/billing/overview?organization_id=${organizationId}`);
}

export async function listBillingPlans() {
  return getJson<{ plans: PlanOption[] }>('/billing/plans');
}

export async function createBillingCheckoutSession(
  organizationId: string,
  plan: 'normal' | 'pro',
  billingInterval: 'month' | 'year' = 'month',
) {
  return postJson<CheckoutSessionResponse>('/billing/checkout-session', {
    organization_id: organizationId,
    plan,
    billing_interval: billingInterval,
  });
}

export async function createBillingPortalSession(organizationId: string) {
  return postJson<PortalSessionResponse>('/billing/customer-portal', { organization_id: organizationId });
}

export async function syncBillingSubscriptionUnits(organizationId: string) {
  return postJson<BillingOverview>('/billing/sync-subscription-units', { organization_id: organizationId });
}

export async function openBillingCheckout(
  organizationId: string,
  plan: 'normal' | 'pro',
  billingInterval: 'month' | 'year' = 'month',
) {
  const session = await createBillingCheckoutSession(organizationId, plan, billingInterval);
  await Linking.openURL(session.checkout_url);
  return session;
}

export async function openBillingPortal(organizationId: string) {
  const session = await createBillingPortalSession(organizationId);
  await Linking.openURL(session.portal_url);
  return session;
}

// Modified by AI on 07/25/2026.
// Native mobile billing via RevenueCat per pricing_research.md's "Native
// mobile billing (RevenueCat)" section. Called right after a purchase or
// restore completes on-device so the UI reflects the new plan immediately.
export async function syncRevenueCatEntitlement(
  organizationId: string,
  appUserId: string,
  activeEntitlementIds: string[],
  productId?: string,
  store?: string,
) {
  return postJson<BillingOverview>('/billing/revenuecat/sync', {
    organization_id: organizationId,
    app_user_id: appUserId,
    active_entitlement_ids: activeEntitlementIds,
    product_id: productId,
    store,
  });
}

