import { getJson, patchJson, postJson } from './api';

export type PropertyUnit = {
  id: string;
  property_id: string;
  unit_code: string;
  tenant_name?: string | null;
  unit_type?: string | null;
  bedroom_count?: string | number | null;
  bathroom_count?: string | number | null;
  square_feet?: number | null;
  market_rent?: string | number | null;
  is_active: boolean;
  notes?: string | null;
};

export type Property = {
  id: string;
  organization_id: string;
  name: string;
  property_type: string;
  address_line_1: string;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  total_units: number;
  units?: PropertyUnit[];
  is_active: boolean;
  notes?: string | null;
};

export type PropertyFormPayload = {
  organization_id: string;
  name: string;
  property_type: string;
  address_line_1: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  total_units: number;
  is_active: boolean;
  notes?: string;
};

export type PropertyTaxReport = {
  property_id: string;
  property_name: string;
  organization_id: string;
  year: number;
  record_count: number;
  income_total: string;
  expense_total: string;
  net_total: string;
  deductible_expense_total: string;
  category_totals: { category_code: string; amount: string }[];
  monthly_totals: { month: string; income: string; expense: string; net: string }[];
};

export type PropertyPortfolioSummary = {
  organization_id: string;
  year: number;
  property_count: number;
  income_total: string;
  expense_total: string;
  net_total: string;
  properties: {
    property_id: string;
    property_name: string;
    property_type: string;
    city?: string | null;
    state?: string | null;
    total_units: number;
    record_count: number;
    income_total: string;
    expense_total: string;
    net_total: string;
  }[];
};

export async function listProperties(organizationId: string) {
  return getJson<Property[]>(`/properties?organization_id=${organizationId}`);
}

export async function createProperty(payload: PropertyFormPayload) {
  return postJson<Property>('/properties', payload);
}

export async function updateProperty(propertyId: string, payload: Partial<PropertyFormPayload>) {
  return patchJson<Property>(`/properties/${propertyId}`, payload);
}

export async function getPropertyTaxReport(propertyId: string, year: number, unitId?: string) {
  let query = `/properties/${propertyId}/tax-report?year=${year}`;
  if (unitId) {
    query += `&unit_id=${unitId}`;
  }
  return getJson<PropertyTaxReport>(query);
}

export async function getPortfolioSummary(organizationId: string, year: number) {
  return getJson<PropertyPortfolioSummary>(`/properties/portfolio-summary?organization_id=${organizationId}&year=${year}`);
}
