import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY_TOKEN = 'rentzu_access_token';
const STORAGE_KEY_SESSION = 'rentzu_session';

let _accessToken: string | null = null;

export type StoredSession = {
  userId: string;
  email: string;
  organizationId: string;
  organizationIds: string[];
};

// --- Token management ---

export function setAccessToken(token: string | null) {
  _accessToken = token;
  if (token) {
    SecureStore.setItemAsync(STORAGE_KEY_TOKEN, token).catch(() => {});
  } else {
    SecureStore.deleteItemAsync(STORAGE_KEY_TOKEN).catch(() => {});
  }
}

export function getAccessToken(): string | null {
  return _accessToken;
}

// --- Session persistence ---

export async function saveSession(session: StoredSession): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY_SESSION, JSON.stringify(session));
  } catch {}
}

export async function loadSession(): Promise<{ token: string; session: StoredSession } | null> {
  try {
    const token = await SecureStore.getItemAsync(STORAGE_KEY_TOKEN);
    const sessionJson = await SecureStore.getItemAsync(STORAGE_KEY_SESSION);
    if (!token || !sessionJson) return null;

    const session: StoredSession = JSON.parse(sessionJson);
    if (!session.userId || !session.email) return null;

    // Restore the in-memory token
    _accessToken = token;
    return { token, session };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  _accessToken = null;
  await SecureStore.deleteItemAsync(STORAGE_KEY_TOKEN).catch(() => {});
  await SecureStore.deleteItemAsync(STORAGE_KEY_SESSION).catch(() => {});
}

// --- HTTP helpers ---

// Set EXPO_PUBLIC_API_BASE_URL to point builds at a reachable backend. The
// 10.0.2.2 fallback is the Android emulator's alias for the host machine's
// localhost and only works for local development.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8000';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }
  return headers;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = (data as any)?.detail;
    let message = (data as any)?.message || 'Request failed';
    if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail)) {
      // FastAPI validation errors: a list of {loc, msg, type} objects.
      message = detail.map((item) => item?.msg || JSON.stringify(item)).join('; ') || message;
    } else if (detail && typeof detail === 'object') {
      message = (detail as any).msg || JSON.stringify(detail);
    }
    throw new Error(message);
  }
  return data as T;
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: authHeaders(),
  });
  return parseResponse<T>(response);
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });

  return parseResponse<T>(response);
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });

  return parseResponse<T>(response);
}

export async function deleteJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as any).detail || (data as any).message || 'Delete failed');
  }
  return data as T;
}
