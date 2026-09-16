import bcrypt from 'bcryptjs';
import { addHours, addMinutes, id, now } from '../utils.js';
import type { DbState, UserRecord } from '../types.js';

const settings = () => ({
  sosCountdown: 5,
  journeyTimeoutMinutes: 10,
  deviationSensitivity: 'medium' as const,
  checkInGraceMinutes: 5,
  publicLinkHours: 24,
  notificationPreferences: { push: true, sms: true, email: true },
  privacy: { locationSharing: false, evidenceRetentionDays: 30, historyRetentionDays: 180 },
  escalation: { notifyContacts: true, includeLastKnownLocation: true },
});

export async function seedState(): Promise<DbState> {
  const created = now();
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const adminHash = await bcrypt.hash('Admin123!', 12);
  const userId = 'demo-user-001';
  const mayaId = 'demo-user-002';
  const adminId = 'demo-admin-001';
  const user: UserRecord = { id: userId, fullName: 'Ananya Rao', email: 'demo@abhaya.app', phone: '+91 98765 43210', passwordHash, role: 'USER', city: 'Hyderabad', settings: settings(), createdAt: created, updatedAt: created };
  const maya: UserRecord = { id: mayaId, fullName: 'Maya Iyer', email: 'maya@abhaya.app', phone: '+91 90000 11007', passwordHash, role: 'CONTACT', city: 'Hyderabad', settings: settings(), createdAt: created, updatedAt: created };
  const admin: UserRecord = { id: adminId, fullName: 'ABHAYA Operations', email: 'admin@abhaya.app', phone: '+91 90000 00000', passwordHash: adminHash, role: 'ADMIN', city: 'Hyderabad', settings: settings(), createdAt: created, updatedAt: created };
  const contactOne = { id: 'contact-001', ownerId: userId, name: 'Maya Iyer', phone: '+91 90000 11007', email: 'maya@abhaya.app', relationship: 'Sister', verified: true, priority: 1, receives: ['EMERGENCY', 'JOURNEY', 'TIMER', 'CHECK_IN'] as const, createdAt: created, updatedAt: created };
  const contactTwo = { id: 'contact-002', ownerId: userId, name: 'Rohan Rao', phone: '+91 90000 22007', email: 'rohan@abhaya.app', relationship: 'Friend', verified: true, priority: 2, receives: ['EMERGENCY', 'TIMER'] as const, createdAt: created, updatedAt: created };
  const contactThree = { id: 'contact-003', ownerId: userId, name: 'Nisha Kapoor', phone: '+91 90000 33007', email: 'nisha@abhaya.app', relationship: 'Colleague', verified: false, priority: 3, receives: ['EMERGENCY'] as const, createdAt: created, updatedAt: created };
  const contactFour = { id: 'contact-004', ownerId: userId, name: 'Aarav Rao', phone: '+91 90000 44007', email: 'aarav@abhaya.app', relationship: 'Brother', verified: true, priority: 4, receives: ['EMERGENCY', 'CHECK_IN'] as const, createdAt: created, updatedAt: created };
  const contactFive = { id: 'contact-005', ownerId: userId, name: 'Sana Ali', phone: '+91 90000 55007', email: 'sana@abhaya.app', relationship: 'Friend', verified: true, priority: 5, receives: ['JOURNEY', 'TIMER'] as const, createdAt: created, updatedAt: created };
  const journeyA = { id: 'journey-001', userId, title: 'Home from studio', origin: 'Banjara Hills', destination: 'Gachibowli', expectedArrival: addMinutes(new Date(), 28), status: 'ACTIVE' as const, progress: 62, distanceRemainingKm: 5.4, eta: '12 min', contactIds: [contactOne.id, contactTwo.id], locationSessionId: 'loc-session-001', lastLocation: { latitude: 17.4239, longitude: 78.4071, accuracy: 18, timestamp: new Date(Date.now() - 90_000).toISOString() }, createdAt: new Date(Date.now() - 26 * 60_000).toISOString(), updatedAt: created };
  const journeyB = { id: 'journey-002', userId: mayaId, title: 'Late shift', origin: 'Madhapur', destination: 'Kondapur', expectedArrival: addMinutes(new Date(), 46), status: 'ACTIVE' as const, progress: 41, distanceRemainingKm: 3.2, eta: '18 min', contactIds: [], locationSessionId: 'loc-session-002', lastLocation: { latitude: 17.4494, longitude: 78.3915, accuracy: 24, timestamp: new Date(Date.now() - 180_000).toISOString() }, createdAt: new Date(Date.now() - 21 * 60_000).toISOString(), updatedAt: created };
  const journeyC = { id: 'journey-003', userId, title: 'Airport drop', origin: 'Jubilee Hills', destination: 'RGIA Airport', expectedArrival: addMinutes(new Date(), 70), status: 'ACTIVE' as const, progress: 8, distanceRemainingKm: 29.5, eta: '52 min', contactIds: [contactOne.id], locationSessionId: 'loc-session-003', createdAt: created, updatedAt: created };
  const emergencyOne = { id: 'emergency-001', userId: mayaId, status: 'RESOLVED' as const, source: 'SOS' as const, deliveryState: 'DELIVERED' as const, activatedAt: new Date(Date.now() - 2 * 86400000).toISOString(), resolvedAt: new Date(Date.now() - 2 * 86400000 + 17 * 60_000).toISOString(), createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 2 * 86400000 + 17 * 60_000).toISOString(), location: { latitude: 17.4156, longitude: 78.4347, accuracy: 12, timestamp: new Date(Date.now() - 2 * 86400000).toISOString() } };
  const emergencyTwo = { id: 'emergency-002', userId, status: 'CANCELLED' as const, source: 'SILENT_SOS' as const, deliveryState: 'DELIVERED' as const, activatedAt: new Date(Date.now() - 8 * 86400000).toISOString(), createdAt: new Date(Date.now() - 8 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 8 * 86400000 + 2 * 60_000).toISOString(), location: { latitude: 17.4325, longitude: 78.407, accuracy: 20, timestamp: new Date(Date.now() - 8 * 86400000).toISOString() } };
  return {
    version: 1,
    users: [user, maya, admin],
    devices: [{ id: 'device-001', userId, label: 'Chrome on this device', platform: 'WEB', lastSeenAt: created, createdAt: created }],
    sessions: [],
    contacts: [contactOne, contactTwo, contactThree, contactFour, contactFive],
    invitations: [],
    emergencies: [emergencyOne, emergencyTwo],
    emergencyStatusHistory: [
      { id: id(), emergencyId: emergencyOne.id, to: 'CREATED', createdAt: emergencyOne.createdAt },
      { id: id(), emergencyId: emergencyOne.id, from: 'CREATED', to: 'ACTIVE', createdAt: emergencyOne.activatedAt! },
      { id: id(), emergencyId: emergencyOne.id, from: 'ACTIVE', to: 'RESOLVED', createdAt: emergencyOne.resolvedAt! },
    ],
    journeys: [journeyA, journeyB, journeyC],
    timers: [{ id: 'timer-001', userId, label: 'Walk home check-in', durationMinutes: 15, expiresAt: addMinutes(new Date(), 9), status: 'RUNNING', createdAt: new Date(Date.now() - 6 * 60_000).toISOString(), updatedAt: created }],
    checkIns: [{ id: 'checkin-001', userId, journeyId: journeyA.id, message: 'Reached the metro safely', location: journeyA.lastLocation, createdAt: new Date(Date.now() - 12 * 60_000).toISOString() }],
    notifications: [
      { id: 'notification-001', userId, type: 'JOURNEY_STARTED', title: 'Journey started', body: 'Maya can see your trip to Gachibowli.', channel: 'PUSH', status: 'DELIVERED', relatedType: 'JOURNEY', relatedId: journeyA.id, createdAt: new Date(Date.now() - 24 * 60_000).toISOString(), deliveredAt: new Date(Date.now() - 24 * 60_000).toISOString() },
      { id: 'notification-002', userId, type: 'CHECK_IN', title: 'You are doing great', body: 'Your last check-in was 12 minutes ago.', channel: 'PUSH', status: 'DELIVERED', createdAt: new Date(Date.now() - 12 * 60_000).toISOString(), deliveredAt: new Date(Date.now() - 12 * 60_000).toISOString() },
    ],
    evidence: [],
    shareLinks: [],
    resources: [
      { id: 'resource-001', name: 'Banjara Hills Police Station', type: 'POLICE', address: 'Road No. 12, Banjara Hills', phone: '100', latitude: 17.4122, longitude: 78.4482, verified: true, createdAt: created, updatedAt: created },
      { id: 'resource-002', name: 'Apollo Hospitals Jubilee Hills', type: 'HOSPITAL', address: 'Film Nagar, Jubilee Hills', phone: '040 2360 7777', latitude: 17.4239, longitude: 78.4071, verified: true, createdAt: created, updatedAt: created },
      { id: 'resource-003', name: 'MedPlus Pharmacy', type: 'PHARMACY', address: 'Road No. 36, Jubilee Hills', phone: '040 4011 2200', latitude: 17.4318, longitude: 78.4078, verified: true, createdAt: created, updatedAt: created },
      { id: 'resource-004', name: 'Sakhi One Stop Centre', type: 'SHELTER', address: 'Nampally, Hyderabad', phone: '181', latitude: 17.385, longitude: 78.473, verified: true, createdAt: created, updatedAt: created },
    ],
    audits: [],
  };
}
