export type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; details?: unknown } };

const TOKEN_KEY = 'abhaya_access_token';
const REFRESH_KEY = 'abhaya_refresh_token';

export const tokens = {
  get access() { return localStorage.getItem(TOKEN_KEY); },
  get refresh() { return localStorage.getItem(REFRESH_KEY); },
  set(access: string, refresh: string) { localStorage.setItem(TOKEN_KEY, access); localStorage.setItem(REFRESH_KEY, refresh); },
  clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); },
};

export class ApiError extends Error {
  code: string;
  constructor(message: string, code = 'API_ERROR') { super(message); this.name = 'ApiError'; this.code = code; }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const access = tokens.access;
  if (access) headers.set('Authorization', `Bearer ${access}`);
  const response = await fetch(`/api/v1${path}`, { ...options, headers, credentials: 'include' });
  const payload = await response.json().catch(() => ({ ok: false, error: { code: 'INVALID_RESPONSE', message: 'The server returned an invalid response.' } })) as ApiEnvelope<T>;
  if (response.status === 401 && retry && tokens.refresh && !path.includes('/auth/')) {
    try {
      const refreshed = await request<{ accessToken: string; refreshToken: string }>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: tokens.refresh }) }, false);
      tokens.set(refreshed.accessToken, refreshed.refreshToken);
      return request<T>(path, options, false);
    } catch { tokens.clear(); window.dispatchEvent(new Event('abhaya:logout')); }
  }
  if (!response.ok || !payload.ok) {
    const error = 'error' in payload ? payload.error : { code: 'HTTP_ERROR', message: 'Request failed.' };
    throw new ApiError(error.message, error.code);
  }
  return payload.data;
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  login: (body: { email: string; password: string }) => request<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', json(body)),
  signup: (body: { fullName: string; email: string; phone: string; password: string }) => request<{ user: User; accessToken: string; refreshToken: string }>('/auth/signup', json(body)),
  logout: () => request<{ loggedOut: boolean }>('/auth/logout', { ...json({ refreshToken: tokens.refresh }) }),
  forgotPassword: (email: string) => request<{ accepted: boolean; devToken?: string }>('/auth/forgot-password', json({ email })),
  me: () => request<{ user: User }>('/auth/me'),
  profile: () => request<{ user: User & { settings: Settings } }>('/users/me'),
  updateProfile: (body: Partial<Pick<User, 'fullName' | 'phone' | 'city' | 'avatar'>>) => request<{ user: User }>('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  updateSettings: (body: Partial<Settings>) => request<{ settings: Settings }>('/users/me/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  contacts: () => request<{ contacts: Contact[] }>('/trusted-contacts'),
  addContact: (body: Partial<Contact>) => request<{ contact: Contact; invitation?: { token: string } }>('/trusted-contacts', json(body)),
  updateContact: (id: string, body: Partial<Contact>) => request<{ contact: Contact }>(`/trusted-contacts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteContact: (id: string) => request<{ deleted: boolean }>(`/trusted-contacts/${id}`, { method: 'DELETE' }),
  testContact: (id: string) => request<{ notification: Notification }>(`/trusted-contacts/${id}/test`, json({})),
  activeEmergency: () => request<{ emergency: Emergency | null }>('/emergency/active'),
  emergencyHistory: () => request<{ emergencies: Emergency[] }>('/emergency/history'),
  createEmergency: (body: { source: 'SOS' | 'SILENT_SOS' | 'TIMER' | 'JOURNEY'; location?: LocationPoint; countdown?: boolean }) => request<{ emergency: Emergency; shareUrl: string; notifications: Notification[] }>('/emergency', json(body)),
  cancelEmergency: (id: string) => request<{ emergency: Emergency }>(`/emergency/${id}/cancel`, json({})),
  resolveEmergency: (id: string) => request<{ emergency: Emergency }>(`/emergency/${id}/resolve`, json({})),
  acknowledgeEmergency: (id: string) => request<{ emergency: Emergency }>(`/emergency/${id}/acknowledge`, json({})),
  emergencyLocation: (id: string, location: LocationPoint) => request<{ location: LocationPoint }>(`/emergency/${id}/location`, json(location)),
  journeys: () => request<{ journeys: Journey[] }>('/journeys'),
  createJourney: (body: { title: string; origin: string; destination: string; expectedArrival: string; contactIds: string[] }) => request<{ journey: Journey }>('/journeys', json(body)),
  startJourney: (id: string) => request<{ journey: Journey }>(`/journeys/${id}/start`, json({})),
  endJourney: (id: string) => request<{ journey: Journey }>(`/journeys/${id}/end`, json({})),
  checkInJourney: (id: string, body: { message?: string; location?: LocationPoint }) => request<{ checkIn: CheckIn }>(`/journeys/${id}/check-in`, json(body)),
  extendJourney: (id: string, minutes: number) => request<{ journey: Journey }>(`/journeys/${id}/extend`, json({ minutes })),
  timers: () => request<{ timers: SafetyTimer[] }>('/timers'),
  createTimer: (body: { durationMinutes: number; label: string }) => request<{ timer: SafetyTimer }>('/timers', json(body)),
  confirmTimer: (id: string) => request<{ timer: SafetyTimer }>(`/timers/${id}/confirm`, json({})),
  extendTimer: (id: string, minutes: number) => request<{ timer: SafetyTimer }>(`/timers/${id}/extend`, json({ minutes })),
  cancelTimer: (id: string) => request<{ timer: SafetyTimer }>(`/timers/${id}/cancel`, json({})),
  checkIns: () => request<{ checkIns: CheckIn[] }>('/check-ins'),
  createCheckIn: (body: { emergencyId?: string; journeyId?: string; timerId?: string; message?: string; location?: LocationPoint }) => request<{ checkIn: CheckIn }>('/check-ins', json(body)),
  notifications: () => request<{ notifications: Notification[] }>('/notifications'),
  resources: (coords?: { lat: number; lng: number }) => request<{ resources: Resource[] }>(`/resources${coords ? `?lat=${coords.lat}&lng=${coords.lng}` : ''}`),
  history: () => request<History>('/history'),
  createEvidenceSession: (body: { emergencyId?: string; type: 'AUDIO' | 'VIDEO'; fileName: string; mimeType: string; sizeBytes: number }) => request<{ evidence: { id: string; status: string }; upload: { mode: string; message: string } }>('/evidence/sessions', json(body)),
  completeEvidence: (id: string) => request<{ evidence: { id: string; status: string } }>(`/evidence/${id}/complete`, json({})),
  publicShare: (token: string) => request<PublicShare>(`/public/share/${token}`),
  adminOverview: () => request<AdminOverview>('/admin/overview'),
  adminUsers: () => request<{ users: User[] }>('/admin/users'),
  adminEmergencies: () => request<{ emergencies: Emergency[] }>('/admin/emergencies'),
  adminResources: () => request<{ resources: Resource[] }>('/admin/resources'),
  adminAudits: () => request<{ audits: Audit[] }>('/admin/audits'),
  adminResolve: (id: string) => request<{ emergency: Emergency }>(`/admin/emergencies/${id}/resolve`, json({})),
};

export interface User { id: string; fullName: string; firstName: string; email: string; phone: string; role: 'USER' | 'CONTACT' | 'ADMIN'; city?: string; avatar?: string; settings?: Settings; createdAt: string; }
export interface Settings { sosCountdown: number; journeyTimeoutMinutes: number; deviationSensitivity: 'low' | 'medium' | 'high'; checkInGraceMinutes: number; publicLinkHours: number; notificationPreferences: { push: boolean; sms: boolean; email: boolean }; privacy: { locationSharing: boolean; evidenceRetentionDays: number; historyRetentionDays: number }; escalation: { notifyContacts: boolean; includeLastKnownLocation: boolean }; }
export interface Contact { id: string; name: string; phone: string; email?: string; relationship: string; verified: boolean; priority: number; receives: string[]; }
export interface LocationPoint { latitude: number; longitude: number; accuracy?: number; speed?: number; heading?: number; timestamp: string; }
export interface Emergency { id: string; status: 'CREATED' | 'COUNTDOWN' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED'; source: string; createdAt: string; updatedAt: string; activatedAt?: string; resolvedAt?: string; location?: LocationPoint; lastLocationAt?: string; contactCount: number; deliveryState: 'PENDING' | 'PARTIAL' | 'DELIVERED' | 'FAILED'; shareActive?: boolean; user?: { firstName: string; fullName: string }; }
export interface Journey { id: string; title: string; origin: string; destination: string; expectedArrival: string; status: 'PLANNED' | 'ACTIVE' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED'; progress: number; distanceRemainingKm?: number; eta?: string; contactIds: string[]; lastLocation?: LocationPoint; anomaly?: { type: string; detectedAt: string; acknowledged?: boolean }; createdAt: string; }
export interface SafetyTimer { id: string; label: string; durationMinutes: number; expiresAt: string; graceUntil?: string; status: 'RUNNING' | 'GRACE' | 'CONFIRMED' | 'ESCALATED' | 'CANCELLED'; createdAt: string; }
export interface CheckIn { id: string; message?: string; createdAt: string; journeyId?: string; timerId?: string; emergencyId?: string; }
export interface Notification { id: string; type: string; title: string; body: string; status: string; createdAt: string; deliveredAt?: string; }
export interface Resource { id: string; name: string; type: 'POLICE' | 'HOSPITAL' | 'PHARMACY' | 'SHELTER' | 'OTHER'; address: string; phone?: string; distanceKm: number; latitude: number; longitude: number; verified: boolean; }
export interface History { emergencies: Emergency[]; journeys: Journey[]; timers: SafetyTimer[]; checkIns: CheckIn[]; evidence: { id: string; type: string; status: string; createdAt: string }[]; }
export interface Audit { id: string; action: string; entityType: string; createdAt: string; actorId?: string; }
export interface AdminOverview { stats: { totalUsers: number; activeEmergencies: number; activeJourneys: number; emergenciesToday: number; resolvedIncidents: number; cancelledIncidents: number; notificationDeliverySuccess: number; systemErrors: number }; activeEmergencies: Emergency[]; recentAudit: Audit[]; }
export interface PublicShare { firstName: string; status: string; lastKnownLocation?: LocationPoint; timestamp: string; expiresAt: string; safe: boolean; }
