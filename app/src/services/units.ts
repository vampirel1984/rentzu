import { getJson, patchJson, postJson } from './api';
import { PropertyUnit } from './properties';

export type UnitPatchPayload = {
  unit_code?: string;
  tenant_name?: string | null;
  unit_type?: string;
  market_rent?: number;
  is_active?: boolean;
  notes?: string;
};

export type UnitCreatePayload = UnitPatchPayload & {
  property_id: string;
  unit_code: string;
};

export async function listUnits(propertyId: string) {
  return getJson<PropertyUnit[]>(`/units?property_id=${propertyId}`);
}

export async function createUnit(payload: UnitCreatePayload) {
  return postJson<PropertyUnit>('/units', payload);
}

export async function updateUnit(unitId: string, payload: UnitPatchPayload) {
  return patchJson<PropertyUnit>(`/units/${unitId}`, payload);
}
