import type { User, Incident } from '@prisma/client';
export const userView = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  emailVerifiedAt: u.emailVerifiedAt,
  theme: u.theme,
  pushEnabled: u.pushEnabled,
  securityEmails: u.securityEmails,
  hasAvatar: !!u.avatar,
});
export const incidentView = (i: Incident) => ({
  id: i.id,
  category: i.category,
  description: i.description,
  occurredAt: i.occurredAt,
  createdAt: i.createdAt,
  latitude: i.latitude,
  longitude: i.longitude,
  hasEvidence: !!i.evidence,
});
export const contactSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  isPrimary: true,
  receivesAlerts: true,
} as const;
export const deliverySelect = {
  id: true,
  channel: true,
  status: true,
  recipientLabel: true,
  createdAt: true,
  errorCode: true,
} as const;
export const locationSelect = {
  id: true,
  latitude: true,
  longitude: true,
  accuracy: true,
  capturedAt: true,
} as const;
export const eventSelect = {
  id: true,
  status: true,
  testMode: true,
  shareLocation: true,
  createdAt: true,
  endedAt: true,
  locations: { select: locationSelect, orderBy: { capturedAt: 'desc' as const }, take: 1 },
  notifications: { select: deliverySelect, orderBy: { createdAt: 'desc' as const } },
} as const;
export const journeySelect = {
  id: true,
  destination: true,
  expectedAt: true,
  status: true,
  shareLocation: true,
  testMode: true,
  contactId: true,
  lastCheckInAt: true,
  createdAt: true,
  locations: { select: locationSelect, orderBy: { capturedAt: 'desc' as const }, take: 1 },
  notifications: { select: deliverySelect },
} as const;
