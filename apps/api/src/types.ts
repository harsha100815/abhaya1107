export type Role = 'USER' | 'CONTACT' | 'ADMIN';
export type EmergencyState = 'CREATED' | 'COUNTDOWN' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED';
export type JourneyState = 'PLANNED' | 'ACTIVE' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED';
export type TimerState = 'RUNNING' | 'GRACE' | 'CONFIRMED' | 'ESCALATED' | 'CANCELLED';
export type DeliveryState = 'PENDING' | 'PARTIAL' | 'DELIVERED' | 'FAILED';
export type Channel = 'PUSH' | 'SMS' | 'EMAIL';

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: Role;
  avatar?: string;
  city?: string;
  bio?: string;
  settings: UserSettings;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  sosCountdown: number;
  journeyTimeoutMinutes: number;
  deviationSensitivity: 'low' | 'medium' | 'high';
  checkInGraceMinutes: number;
  publicLinkHours: number;
  notificationPreferences: { push: boolean; sms: boolean; email: boolean };
  privacy: { locationSharing: boolean; evidenceRetentionDays: number; historyRetentionDays: number };
  escalation: { notifyContacts: boolean; includeLastKnownLocation: boolean };
}

export interface UserDevice {
  id: string;
  userId: string;
  label: string;
  platform: 'WEB' | 'ANDROID' | 'IOS';
  lastSeenAt: string;
  pushToken?: string;
  createdAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
}

export interface ContactRecord {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  verified: boolean;
  priority: number;
  receives: readonly ('EMERGENCY' | 'JOURNEY' | 'TIMER' | 'CHECK_IN')[];
  createdAt: string;
  updatedAt: string;
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

export interface EmergencyRecord {
  id: string;
  userId: string;
  status: EmergencyState;
  source: 'SOS' | 'SILENT_SOS' | 'TIMER' | 'JOURNEY';
  location?: LocationPoint;
  lastLocationAt?: string;
  shareTokenHash?: string;
  shareExpiresAt?: string;
  shareRevokedAt?: string;
  deliveryState: DeliveryState;
  activatedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  note?: string;
}

export interface EmergencyStatusRecord {
  id: string;
  emergencyId: string;
  from?: EmergencyState;
  to: EmergencyState;
  actorId?: string;
  reason?: string;
  createdAt: string;
}

export interface JourneyRecord {
  id: string;
  userId: string;
  title: string;
  origin: string;
  destination: string;
  expectedArrival: string;
  status: JourneyState;
  progress: number;
  distanceRemainingKm?: number;
  eta?: string;
  contactIds: string[];
  locationSessionId: string;
  lastLocation?: LocationPoint;
  anomaly?: { type: 'DEVIATION' | 'STOP' | 'OVERDUE' | 'LOCATION_LOST'; detectedAt: string; acknowledged?: boolean };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TimerRecord {
  id: string;
  userId: string;
  label: string;
  durationMinutes: number;
  expiresAt: string;
  graceUntil?: string;
  status: TimerState;
  createdAt: string;
  updatedAt: string;
}

export interface CheckInRecord {
  id: string;
  userId: string;
  emergencyId?: string;
  journeyId?: string;
  timerId?: string;
  message?: string;
  location?: LocationPoint;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId?: string;
  recipientId?: string;
  type: string;
  title: string;
  body: string;
  channel: Channel;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
  relatedType?: string;
  relatedId?: string;
  createdAt: string;
  deliveredAt?: string;
  error?: string;
}

export interface EvidenceRecord {
  id: string;
  userId: string;
  emergencyId?: string;
  type: 'AUDIO' | 'VIDEO';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'UPLOADING' | 'READY' | 'FAILED' | 'DELETED';
  retentionUntil: string;
  createdAt: string;
}

export interface ShareLinkRecord {
  id: string;
  ownerId: string;
  emergencyId?: string;
  journeyId?: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
}

export interface SafetyResourceRecord {
  id: string;
  name: string;
  type: 'POLICE' | 'HOSPITAL' | 'PHARMACY' | 'SHELTER' | 'OTHER';
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ContactInvitationRecord {
  id: string;
  ownerId: string;
  contactId?: string;
  email?: string;
  phone?: string;
  tokenHash: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
}

export interface DbState {
  version: number;
  users: UserRecord[];
  devices: UserDevice[];
  sessions: SessionRecord[];
  contacts: ContactRecord[];
  invitations: ContactInvitationRecord[];
  emergencies: EmergencyRecord[];
  emergencyStatusHistory: EmergencyStatusRecord[];
  journeys: JourneyRecord[];
  timers: TimerRecord[];
  checkIns: CheckInRecord[];
  notifications: NotificationRecord[];
  evidence: EvidenceRecord[];
  shareLinks: ShareLinkRecord[];
  resources: SafetyResourceRecord[];
  audits: AuditLogRecord[];
}
