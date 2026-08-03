import { postJson } from './api';

export type AuthResponse = {
  ok: boolean;
  message: string;
  email?: string;
  user_id?: string;
  organization_id?: string;
  organization_ids?: string[];
  delivery_mode?: 'smtp' | 'outbox';
  access_token?: string;
};

export async function requestCode(email: string, password: string) {
  return postJson<AuthResponse>('/auth/request-code', { email, password });
}

export async function verifyCode(email: string, code: string) {
  return postJson<AuthResponse>('/auth/verify-code', { email, code });
}
