export type UserRole = 'USER' | 'CONTACT' | 'ADMIN';
export type EmergencyState = 'CREATED' | 'COUNTDOWN' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED';
export type JourneyState = 'PLANNED' | 'ACTIVE' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED';
export type TimerState = 'RUNNING' | 'GRACE' | 'CONFIRMED' | 'ESCALATED' | 'CANCELLED';
export type NotificationChannel = 'PUSH' | 'SMS' | 'EMAIL';

export interface User {
  id: string;
  fullName: string;
  firstName: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  city?: string;
}

export interface TrustedContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  verified: boolean;
  priority: number;
  receives: string[];
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
}

export interface EmergencyEvent {
  id: string;
  status: EmergencyState;
  userId: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  resolvedAt?: string;
  location?: LocationPoint;
  shareToken?: string;
  contactCount: number;
  deliveryState: 'PENDING' | 'PARTIAL' | 'DELIVERED' | 'FAILED';
  source: 'SOS' | 'SILENT_SOS' | 'TIMER' | 'JOURNEY';
}

export interface SafetyJourney {
  id: string;
  title: string;
  origin: string;
  destination: string;
  expectedArrival: string;
  status: JourneyState;
  progress: number;
  distanceRemaining?: string;
  eta?: string;
  contactIds: string[];
  createdAt: string;
}

export interface SafetyTimer {
  id: string;
  durationMinutes: number;
  label: string;
  expiresAt: string;
  status: TimerState;
}

export interface SafetyResource {
  id: string;
  name: string;
  type: 'POLICE' | 'HOSPITAL' | 'PHARMACY' | 'SHELTER' | 'OTHER';
  address: string;
  phone?: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  verified: boolean;
}
