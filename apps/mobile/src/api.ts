import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const metroHost = (Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost)?.split(':')[0];
  return metroHost ? `http://${metroHost}:4000/api/v1` : 'http://localhost:4000/api/v1';
}

const API_URL = resolveApiUrl();
const ACCESS = 'abhaya.mobile.access';
const REFRESH = 'abhaya.mobile.refresh';
// Browser previews keep tokens only in memory. Native devices use SecureStore.
const previewTokens = new Map<string, string>();
const tokenStore = Platform.OS === 'web' ? {
  getItemAsync: async (key: string) => previewTokens.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { previewTokens.set(key, value); },
  deleteItemAsync: async (key: string) => { previewTokens.delete(key); },
} : SecureStore;

let authGeneration = 0;
let tokenWrite = Promise.resolve();
export async function setTokens(access: string, refresh: string, expectedGeneration = authGeneration) {
  tokenWrite = tokenWrite.catch(() => undefined).then(async () => {
    if (expectedGeneration !== authGeneration) throw new ApiError('Please sign in again.', 401);
    await tokenStore.setItemAsync(ACCESS, access); await tokenStore.setItemAsync(REFRESH, refresh);
  });
  return tokenWrite;
}
export async function clearTokens() {
  authGeneration += 1;
  tokenWrite = tokenWrite.catch(() => undefined).then(async () => { await tokenStore.deleteItemAsync(ACCESS); await tokenStore.deleteItemAsync(REFRESH); });
  return tokenWrite;
}
export async function getAccess() { return tokenStore.getItemAsync(ACCESS); }
export async function logout() {
  // Finish a pending rotation before revoking this device's current session.
  await refreshing?.catch(() => undefined);
  const refreshToken = await tokenStore.getItemAsync(REFRESH);
  try {
    if (refreshToken) await apiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }, false);
  } finally { await clearTokens(); }
}

export class ApiError extends Error {
  constructor(message: string, public status = 0) { super(message); this.name = 'ApiError'; }
}

let refreshing: Promise<void> | null = null;
async function refreshTokens() {
  const generation = authGeneration;
  const token = await tokenStore.getItemAsync(REFRESH);
  if (!token) throw new ApiError('Please sign in again.', 401);
  const result = await apiRequest<{ accessToken: string; refreshToken: string }>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: token }) }, false);
  await setTokens(result.accessToken, result.refreshToken, generation);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const access = await getAccess();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (access) headers.set('Authorization', `Bearer ${access}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response: Response;
  let payload: { ok: boolean; data?: T; error?: { message: string } };
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, signal: controller.signal });
    payload = await response.json();
  } catch {
    throw new ApiError('Can’t reach your safety space. Keep your phone and demo computer on the same network, then try again.');
  } finally { clearTimeout(timeout); }
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    if (!refreshing) refreshing = refreshTokens().finally(() => { refreshing = null; });
    await refreshing;
    return apiRequest<T>(path, init, false);
  }
  if (!response.ok || !payload.ok) throw new ApiError(payload.error?.message ?? 'Request failed. Please try again.', response.status);
  return payload.data as T;
}
