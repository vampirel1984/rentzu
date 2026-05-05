import { Linking } from 'react-native';

import { getJson, postJson } from './api';

export type BillingOverview = {
  organization_id: string;
  total_units: number;
  free_units: number;
  billable_units: number;
  amount_per_unit_cents: number;
  estimated_monthly_total_cents: number;
  currency: string;
  subscription_status: string;
  cancel_at_period_end: boolean;
  current_period_end?: string | null;
  checkout_available: boolean;
  customer_portal_available: boolean;
  stripe_configured: boolean;
  recommended_action: string;
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

export async function createBillingCheckoutSession(organizationId: string) {
  return postJson<CheckoutSessionResponse>('/billing/checkout-session', { organization_id: organizationId });
}

export async function createBillingPortalSession(organizationId: string) {
  return postJson<PortalSessionResponse>('/billing/customer-portal', { organization_id: organizationId });
}

export async function syncBillingSubscriptionUnits(organizationId: string) {
  return postJson<BillingOverview>('/billing/sync-subscription-units', { organization_id: organizationId });
}

export async function openBillingCheckout(organizationId: string) {
  const session = await createBillingCheckoutSession(organizationId);
  await Linking.openURL(session.checkout_url);
  return session;
}

export async function openBillingPortal(organizationId: string) {
  const session = await createBillingPortalSession(organizationId);
  await Linking.openURL(session.portal_url);
  return session;
}
