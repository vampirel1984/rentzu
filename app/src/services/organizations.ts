import { getJson, patchJson, postJson } from './api';

export type Organization = {
  id: string;
  name: string;
  entity_type: string;
};

export async function listOrganizations(userId: string) {
  return getJson<Organization[]>(`/organizations?user_id=${userId}`);
}

export async function createOrganization(userId: string, payload: { name: string; entity_type: string }) {
  return postJson<Organization>(`/organizations?user_id=${userId}`, payload);
}

export async function updateOrganization(userId: string, organizationId: string, payload: Partial<{ name: string; entity_type: string }>) {
  return patchJson<Organization>(`/organizations/${organizationId}?user_id=${userId}`, payload);
}
