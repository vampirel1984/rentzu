import { deleteJson, getJson, patchJson, postJson } from './api';

export type FinancialRecord = {
  id: string;
  organization_id: string;
  type: string;
  amount: string;
  currency: string;
  record_date: string;
  counterparty?: string | null;
  description: string;
  property_id: string;
  unit_id?: string | null;
  lease_id?: string | null;
  category_code?: string | null;
  sub_type?: string | null;
  notes?: string | null;
  source: string;
  created_by?: string | null;
};

export type FinancialRecordPayload = {
  organization_id: string;
  type: string;
  amount: number;
  currency: string;
  record_date: string;
  counterparty?: string;
  description: string;
  property_id: string;
  unit_id?: string;
  category_code?: string;
  sub_type?: string;
  notes?: string;
  source: string;
  created_by?: string;
};

export type FinancialRecordListResponse = {
  items: FinancialRecord[];
  total: number;
  limit: number;
  next_cursor?: string | null;
};

export async function listFinancialRecords(
  organizationId: string,
  propertyId?: string,
  limit = 5,
  cursor?: string,
  unitId?: string,
) {
  let query = `/financial-records?organization_id=${organizationId}&limit=${limit}`;
  if (propertyId) {
    query += `&property_id=${propertyId}`;
  }
  if (unitId) {
    query += `&unit_id=${unitId}`;
  }
  if (cursor) {
    query += `&cursor=${encodeURIComponent(cursor)}`;
  }
  return getJson<FinancialRecordListResponse>(query);
}

export async function createFinancialRecord(payload: FinancialRecordPayload) {
  return postJson<FinancialRecord>('/financial-records', payload);
}

export async function updateFinancialRecord(recordId: string, payload: Partial<FinancialRecordPayload>) {
  return patchJson<FinancialRecord>(`/financial-records/${recordId}`, payload);
}

export async function deleteFinancialRecord(recordId: string) {
  return deleteJson<{ ok: boolean }>(`/financial-records/${recordId}`);
}
