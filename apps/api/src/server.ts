import http from 'node:http';
import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from './config.js';
import { JsonStore, PostgresStore } from './db/store.js';
import { AppError, badRequest, conflict, errorHandler, forbidden, notFound, unauthorized } from './errors.js';
import { addHours, addMinutes, asNumber, distanceKm, extendDeadline, hashToken, id, now, randomToken, safeUser } from './utils.js';
import { authRequired, comparePassword, hashPassword, issueTokens, publicUser, rolesRequired, rotateRefreshToken, type AuthRequest } from './auth.js';
import { parseBody, emailSchema, locationSchema, phoneSchema } from './validation.js';
import { NotificationService } from './notifications.js';
import type { EmergencyRecord, EmergencyState, JourneyRecord, Role, UserRecord } from './types.js';
import { publicShare } from './public-share.js';

const store = await (config.databaseMode === 'postgres' && config.databaseUrl ? new PostgresStore(config.databaseUrl) : new JsonStore()).init();
const notifications = new NotificationService(store);
const app = express();
const server = http.createServer(app);
const sockets = new Set<{ socket: WebSocket; userId: string; role: Role }>();
const resetTokens = new Map<string, { userId: string; expiresAt: string }>();
const otpChallenges = new Map<string, { userId?: string; codeHash: string; expiresAt: string; attempts: number }>();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (origin, callback) => {
  const arenaPreview = Boolean(origin && config.demoMode && origin.endsWith('.e2b.app'));
  if (!origin || config.corsOrigins.includes(origin) || config.corsOrigins.includes('*') || arenaPreview) return callback(null, true);
  return callback(new Error('CORS origin not allowed'));
}, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: config.rateLimitWindowMs, limit: config.rateLimitMax, standardHeaders: 'draft-7', legacyHeaders: false, message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' } } }));
app.use((req, _res, next) => {
  const started = Date.now();
  next();
  const duration = Date.now() - started;
  if (req.path !== '/health' && req.path !== '/ready') console.info(JSON.stringify({ method: req.method, path: req.path, status: 'received', duration }));
});

const auth = authRequired(store);
const asyncRoute = (handler: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(handler(req as AuthRequest, res, next)).catch(next);
const send = (res: Response, data: unknown, status = 200) => res.status(status).json({ ok: true, data });
const userFrom = (req: AuthRequest) => {
  if (!req.user) throw unauthorized();
  return req.user;
};
const audit = async (actorId: string | undefined, action: string, entityType: string, entityId?: string, metadata?: Record<string, unknown>, ipAddress?: string) => {
  store.data.audits.unshift({ id: id(), actorId, action, entityType, entityId, metadata, ipAddress, createdAt: now() });
  await store.persist();
};
const broadcast = (userId: string | undefined, payload: Record<string, unknown>) => {
  for (const client of sockets) {
    if (client.socket.readyState !== WebSocket.OPEN) continue;
    if (client.role === 'ADMIN' || !userId || client.userId === userId) client.socket.send(JSON.stringify({ type: 'safety.event', payload }));
  }
};

function transitionEmergency(emergency: EmergencyRecord, to: EmergencyState, actorId?: string, reason?: string) {
  if (emergency.status === to) return;
  const allowed: Record<EmergencyState, EmergencyState[]> = {
    CREATED: ['COUNTDOWN', 'ACTIVE', 'CANCELLED'],
    COUNTDOWN: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['ACKNOWLEDGED', 'RESOLVED', 'CANCELLED'],
    ACKNOWLEDGED: ['RESOLVED', 'CANCELLED', 'ACTIVE'],
    RESOLVED: [],
    CANCELLED: [],
  };
  if (!allowed[emergency.status].includes(to)) throw conflict(`Cannot move an emergency from ${emergency.status} to ${to}.`);
  const from = emergency.status;
  emergency.status = to;
  emergency.updatedAt = now();
  if (to === 'ACTIVE' && !emergency.activatedAt) emergency.activatedAt = now();
  if (to === 'RESOLVED' || to === 'CANCELLED') emergency.resolvedAt = now();
  store.data.emergencyStatusHistory.unshift({ id: id(), emergencyId: emergency.id, from, to, actorId, reason, createdAt: now() });
}

function emergencyView(emergency: EmergencyRecord, currentUserId?: string) {
  const owner = store.data.users.find((item) => item.id === emergency.userId);
  const recipients = store.data.contacts.filter((item) => item.ownerId === emergency.userId && item.verified);
  return {
    ...emergency,
    user: owner ? { id: owner.id, firstName: owner.fullName.split(' ')[0], fullName: owner.fullName } : undefined,
    contactCount: recipients.length,
    canManage: currentUserId === emergency.userId,
    shareActive: Boolean(emergency.shareTokenHash && emergency.shareExpiresAt && emergency.shareExpiresAt > now() && !emergency.shareRevokedAt),
  };
}

const signUpSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: emailSchema,
  phone: phoneSchema,
  password: z.string().min(10).max(128).regex(/[A-Z]/, 'Password needs an uppercase letter').regex(/[a-z]/, 'Password needs a lowercase letter').regex(/[0-9]/, 'Password needs a number'),
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });

app.get('/health', (_req, res) => send(res, { status: 'ok', service: 'abhaya-api', timestamp: now(), demoMode: config.demoMode, database: config.databaseMode }));
app.get('/ready', (_req, res) => send(res, { status: 'ready', store: Boolean(store.data), notificationProvider: 'mock-or-configured' }));

const api = express.Router();

// Authentication
const authRouter = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: 'draft-7', legacyHeaders: false, message: { ok: false, error: { code: 'AUTH_RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' } } });
authRouter.use(authLimiter);
authRouter.post('/signup', asyncRoute(async (req, res) => {
  const body = parseBody(signUpSchema, req);
  if (store.data.users.some((user) => user.email === body.email)) throw conflict('An account with that email already exists.');
  if (store.data.users.some((user) => user.phone === body.phone)) throw conflict('An account with that phone number already exists.');
  const timestamp = now();
  const user: UserRecord = { id: id(), fullName: body.fullName, email: body.email, phone: body.phone, passwordHash: await hashPassword(body.password), role: 'USER', city: 'Hyderabad', settings: { sosCountdown: 5, journeyTimeoutMinutes: 10, deviationSensitivity: 'medium', checkInGraceMinutes: 5, publicLinkHours: 24, notificationPreferences: { push: true, sms: true, email: true }, privacy: { locationSharing: false, evidenceRetentionDays: 30, historyRetentionDays: 180 }, escalation: { notifyContacts: true, includeLastKnownLocation: true } }, createdAt: timestamp, updatedAt: timestamp };
  store.data.users.push(user);
  await store.persist();
  const tokens = await issueTokens(store, user, req);
  await audit(user.id, 'USER_SIGNED_UP', 'USER', user.id, undefined, req.ip);
  send(res, { user: publicUser(user), ...tokens }, 201);
}));
authRouter.post('/login', asyncRoute(async (req, res) => {
  const body = parseBody(loginSchema, req);
  const user = store.data.users.find((item) => item.email === body.email);
  if (!user || !(await comparePassword(body.password, user.passwordHash))) throw unauthorized('Email or password is incorrect.');
  const tokens = await issueTokens(store, user, req);
  await audit(user.id, 'USER_LOGGED_IN', 'USER', user.id, undefined, req.ip);
  send(res, { user: publicUser(user), ...tokens });
}));
authRouter.post('/otp/request', asyncRoute(async (req, res) => {
  const body = parseBody(z.object({ identifier: z.string().trim().min(7).max(160) }), req);
  const identifier = body.identifier.toLowerCase();
  const user = store.data.users.find((item) => item.email === identifier || item.phone === body.identifier);
  const code = crypto.randomInt(100000, 1000000).toString();
  otpChallenges.set(hashToken(identifier), { userId: user?.id, codeHash: hashToken(code), expiresAt: addMinutes(new Date(), 10), attempts: 0 });
  if (user) await notifications.enqueue({ userId: user.id, type: 'OTP_REQUESTED', title: 'Your ABHAYA verification code', body: 'A one-time verification code was requested.', channel: 'EMAIL' });
  send(res, { accepted: true, ...(config.demoMode ? { devCode: code } : {}) });
}));
authRouter.post('/otp/verify', asyncRoute(async (req, res) => {
  const body = parseBody(z.object({ identifier: z.string().trim().min(7).max(160), code: z.string().regex(/^\d{6}$/) }), req);
  const identifier = body.identifier.toLowerCase();
  const challenge = otpChallenges.get(hashToken(identifier));
  if (!challenge || challenge.expiresAt < now() || challenge.attempts >= 5) throw unauthorized('That verification code is invalid or expired.');
  challenge.attempts += 1;
  if (challenge.codeHash !== hashToken(body.code)) throw unauthorized('That verification code is invalid or expired.');
  otpChallenges.delete(hashToken(identifier));
  const user = challenge.userId ? store.data.users.find((item) => item.id === challenge.userId) : undefined;
  if (!user) { send(res, { verified: true }); return; }
  const tokens = await issueTokens(store, user, req);
  send(res, { verified: true, user: publicUser(user), ...tokens });
}));
authRouter.post('/refresh', asyncRoute(async (req, res) => {
  const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : req.cookies?.abhaya_refresh;
  if (!refreshToken) throw unauthorized('Refresh token is required.');
  send(res, await rotateRefreshToken(store, refreshToken, req));
}));
authRouter.post('/logout', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const token = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
  for (const session of store.data.sessions.filter((item) => item.userId === user.id && (!token || item.refreshTokenHash === hashToken(token)))) session.revokedAt = now();
  await store.persist();
  await audit(user.id, 'USER_LOGGED_OUT', 'SESSION', undefined, undefined, req.ip);
  send(res, { loggedOut: true });
}));
authRouter.get('/me', auth, asyncRoute(async (req, res) => send(res, { user: publicUser(userFrom(req)) })));
authRouter.post('/forgot-password', asyncRoute(async (req, res) => {
  const body = parseBody(z.object({ email: emailSchema }), req);
  const user = store.data.users.find((item) => item.email === body.email);
  const response: { accepted: boolean; devToken?: string } = { accepted: true };
  if (user) {
    const token = randomToken(24);
    resetTokens.set(hashToken(token), { userId: user.id, expiresAt: addMinutes(new Date(), 20) });
    if (config.demoMode) response.devToken = token;
    await notifications.enqueue({ userId: user.id, type: 'PASSWORD_RESET', title: 'Reset your ABHAYA password', body: 'A password reset was requested for your account.', channel: 'EMAIL' });
  }
  send(res, response);
}));
authRouter.post('/reset-password', asyncRoute(async (req, res) => {
  const body = parseBody(z.object({ token: z.string().min(20), password: signUpSchema.shape.password }), req);
  const entry = resetTokens.get(hashToken(body.token));
  if (!entry || entry.expiresAt < now()) throw badRequest('That reset link is invalid or expired.');
  const user = store.data.users.find((item) => item.id === entry.userId);
  if (!user) throw badRequest('That reset link is invalid or expired.');
  user.passwordHash = await hashPassword(body.password);
  user.updatedAt = now();
  resetTokens.delete(hashToken(body.token));
  await store.persist();
  send(res, { reset: true });
}));
api.use('/auth', authRouter);

// Profile, sessions, and settings
api.get('/users/me', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  send(res, { user: { ...publicUser(user), settings: user.settings, createdAt: user.createdAt } });
}));
api.patch('/users/me', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const body = parseBody(z.object({ fullName: z.string().trim().min(2).max(100).optional(), phone: phoneSchema.optional(), city: z.string().trim().max(80).optional(), avatar: z.string().max(500).optional() }), req);
  if (body.phone && store.data.users.some((item) => item.phone === body.phone && item.id !== user.id)) throw conflict('That phone number is already in use.');
  Object.assign(user, body, { updatedAt: now() });
  await store.persist();
  send(res, { user: { ...publicUser(user), settings: user.settings } });
}));
api.patch('/users/me/settings', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const body = parseBody(z.object({ sosCountdown: z.number().int().min(0).max(30).optional(), journeyTimeoutMinutes: z.number().int().min(1).max(120).optional(), deviationSensitivity: z.enum(['low', 'medium', 'high']).optional(), checkInGraceMinutes: z.number().int().min(1).max(30).optional(), publicLinkHours: z.number().int().min(1).max(168).optional(), notificationPreferences: z.object({ push: z.boolean(), sms: z.boolean(), email: z.boolean() }).optional(), privacy: z.object({ locationSharing: z.boolean(), evidenceRetentionDays: z.number().int().min(1).max(365).optional(), historyRetentionDays: z.number().int().min(1).max(730).optional() }).optional(), escalation: z.object({ notifyContacts: z.boolean(), includeLastKnownLocation: z.boolean() }).optional() }), req);
  if (body.notificationPreferences) user.settings.notificationPreferences = body.notificationPreferences;
  if (body.privacy) user.settings.privacy = { ...user.settings.privacy, ...body.privacy };
  if (body.escalation) user.settings.escalation = body.escalation;
  user.settings = { ...user.settings, ...body, notificationPreferences: user.settings.notificationPreferences, privacy: user.settings.privacy, escalation: user.settings.escalation };
  user.updatedAt = now();
  await store.persist();
  await audit(user.id, 'SETTINGS_UPDATED', 'USER', user.id);
  send(res, { settings: user.settings });
}));
api.get('/users/me/sessions', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  send(res, { sessions: store.data.sessions.filter((item) => item.userId === user.id && !item.revokedAt && item.expiresAt > now()).map(({ refreshTokenHash: _hash, ...session }) => session) });
}));
api.delete('/users/me/sessions/:sessionId', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const session = store.data.sessions.find((item) => item.id === req.params.sessionId && item.userId === user.id);
  if (!session) throw notFound('Session not found.');
  session.revokedAt = now();
  await store.persist();
  send(res, { revoked: true });
}));

// Trusted circle
api.get('/trusted-contacts', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  send(res, { contacts: store.data.contacts.filter((item) => item.ownerId === user.id).sort((a, b) => a.priority - b.priority) });
}));
api.post('/trusted-contacts', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const body = parseBody(z.object({ name: z.string().trim().min(2).max(100), phone: phoneSchema, email: emailSchema.optional(), relationship: z.string().trim().min(2).max(50), receives: z.array(z.enum(['EMERGENCY', 'JOURNEY', 'TIMER', 'CHECK_IN'])).min(1).default(['EMERGENCY']) }), req);
  const priorities = store.data.contacts.filter((item) => item.ownerId === user.id).map((item) => item.priority);
  const contact = { id: id(), ownerId: user.id, ...body, verified: false, priority: priorities.length ? Math.max(...priorities) + 1 : 1, createdAt: now(), updatedAt: now() };
  store.data.contacts.push(contact);
  await store.persist();
  const inviteToken = randomToken(24);
  store.data.invitations.push({ id: id(), ownerId: user.id, contactId: contact.id, email: contact.email, phone: contact.phone, tokenHash: hashToken(inviteToken), status: 'PENDING', expiresAt: addHours(new Date(), 72), createdAt: now() });
  await store.persist();
  await notifications.enqueue({ userId: user.id, type: 'CONTACT_INVITED', title: 'Trusted contact invitation ready', body: `${contact.name} can be verified after accepting the invitation.`, channel: 'PUSH', relatedType: 'CONTACT', relatedId: contact.id });
  send(res, { contact, invitation: config.demoMode ? { token: inviteToken, expiresAt: addHours(new Date(), 72) } : undefined }, 201);
}));
api.patch('/trusted-contacts/:contactId', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const contact = store.data.contacts.find((item) => item.id === req.params.contactId && item.ownerId === user.id);
  if (!contact) throw notFound('Trusted contact not found.');
  const body = parseBody(z.object({ name: z.string().trim().min(2).max(100).optional(), phone: phoneSchema.optional(), email: emailSchema.optional(), relationship: z.string().trim().min(2).max(50).optional(), verified: z.boolean().optional(), priority: z.number().int().min(1).max(50).optional(), receives: z.array(z.enum(['EMERGENCY', 'JOURNEY', 'TIMER', 'CHECK_IN'])).min(1).optional() }), req);
  Object.assign(contact, body, { updatedAt: now() });
  await store.persist();
  send(res, { contact });
}));
api.delete('/trusted-contacts/:contactId', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const before = store.data.contacts.length;
  store.data.contacts = store.data.contacts.filter((item) => !(item.id === req.params.contactId && item.ownerId === user.id));
  if (before === store.data.contacts.length) throw notFound('Trusted contact not found.');
  await store.persist();
  send(res, { deleted: true });
}));
api.post('/trusted-contacts/:contactId/test', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const contact = store.data.contacts.find((item) => item.id === req.params.contactId && item.ownerId === user.id);
  if (!contact) throw notFound('Trusted contact not found.');
  const notification = await notifications.enqueue({ recipientId: contact.id, type: 'CONTACT_TEST', title: 'ABHAYA test alert', body: `${user.fullName} sent a test notification. No emergency was created.`, channel: 'PUSH', relatedType: 'CONTACT', relatedId: contact.id });
  send(res, { notification, note: 'Demo provider recorded this locally. Configure FCM, SMS, or email credentials for delivery.' });
}));
api.post('/trusted-contacts/invitations/:token/accept', asyncRoute(async (req, res) => {
  const invitation = store.data.invitations.find((item) => item.tokenHash === hashToken(String(req.params.token)) && item.status === 'PENDING' && item.expiresAt > now());
  if (!invitation || !invitation.contactId) throw badRequest('That invitation is invalid or expired.');
  invitation.status = 'ACCEPTED';
  const contact = store.data.contacts.find((item) => item.id === invitation.contactId);
  if (contact) contact.verified = true;
  await store.persist();
  send(res, { accepted: true });
}));

// Emergency workflow
api.get('/emergency/active', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const events = store.data.emergencies.filter((item) => item.userId === user.id && ['CREATED', 'COUNTDOWN', 'ACTIVE', 'ACKNOWLEDGED'].includes(item.status)).map((item) => emergencyView(item, user.id));
  send(res, { emergency: events[0] ?? null });
}));
api.get('/emergency/history', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  send(res, { emergencies: store.data.emergencies.filter((item) => item.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => emergencyView(item, user.id)) });
}));
api.post('/emergency', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const body = parseBody(z.object({ source: z.enum(['SOS', 'SILENT_SOS', 'TIMER', 'JOURNEY']).default('SOS'), location: locationSchema.optional(), note: z.string().max(500).optional(), countdown: z.boolean().default(false) }), req);
  const existing = store.data.emergencies.find((item) => item.userId === user.id && ['CREATED', 'COUNTDOWN', 'ACTIVE', 'ACKNOWLEDGED'].includes(item.status));
  if (existing) throw conflict('An emergency session is already active.');
  const timestamp = now();
  const emergency: EmergencyRecord = { id: id(), userId: user.id, source: body.source, status: body.countdown ? 'COUNTDOWN' : 'ACTIVE', location: body.location, lastLocationAt: body.location?.timestamp, deliveryState: 'PENDING', activatedAt: body.countdown ? undefined : timestamp, createdAt: timestamp, updatedAt: timestamp, note: body.note };
  store.data.emergencies.unshift(emergency);
  store.data.emergencyStatusHistory.unshift({ id: id(), emergencyId: emergency.id, to: emergency.status, actorId: user.id, createdAt: timestamp });
  await store.persist();
  const contactNotifications = await notifications.notifyUserAndContacts(user.id, { type: 'SOS_ACTIVATED', title: `Emergency alert from ${user.fullName.split(' ')[0]}`, body: `Status: ${emergency.status}. Last known location is available in the secure link.`, channel: 'PUSH', relatedType: 'EMERGENCY', relatedId: emergency.id });
  emergency.deliveryState = contactNotifications.length === 0 ? 'FAILED' : contactNotifications.every((item) => ['SENT', 'DELIVERED'].includes(item.status)) ? 'DELIVERED' : 'PARTIAL';
  const token = randomToken(32);
  const link = { id: id(), ownerId: user.id, emergencyId: emergency.id, tokenHash: hashToken(token), expiresAt: addHours(new Date(), user.settings.publicLinkHours || config.publicLinkTtlHours), createdAt: now() };
  store.data.shareLinks.push(link);
  emergency.shareTokenHash = link.tokenHash;
  emergency.shareExpiresAt = link.expiresAt;
  await store.persist();
  await audit(user.id, 'EMERGENCY_CREATED', 'EMERGENCY', emergency.id, { source: emergency.source });
  broadcast(user.id, { kind: 'emergency.updated', emergency: emergencyView(emergency, user.id) });
  send(res, { emergency: emergencyView(emergency, user.id), shareUrl: `/emergency/${token}`, notifications: contactNotifications.map((item) => ({ id: item.id, recipientId: item.recipientId, status: item.status })) }, 201);
}));
api.post('/emergency/:emergencyId/cancel', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const emergency = store.data.emergencies.find((item) => item.id === req.params.emergencyId && item.userId === user.id);
  if (!emergency) throw notFound('Emergency session not found.');
  transitionEmergency(emergency, 'CANCELLED', user.id, 'User cancelled');
  emergency.shareRevokedAt = now();
  await store.persist();
  await notifications.notifyUserAndContacts(user.id, { type: 'EMERGENCY_RESOLVED', title: 'Emergency cancelled', body: `${user.fullName.split(' ')[0]} cancelled the emergency alert.`, channel: 'PUSH', relatedType: 'EMERGENCY', relatedId: emergency.id });
  broadcast(user.id, { kind: 'emergency.updated', emergency: emergencyView(emergency, user.id) });
  send(res, { emergency: emergencyView(emergency, user.id) });
}));
api.post('/emergency/:emergencyId/resolve', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const emergency = store.data.emergencies.find((item) => item.id === req.params.emergencyId && item.userId === user.id);
  if (!emergency) throw notFound('Emergency session not found.');
  transitionEmergency(emergency, 'RESOLVED', user.id, 'User marked safe');
  emergency.shareRevokedAt = now();
  await store.persist();
  await notifications.notifyUserAndContacts(user.id, { type: 'EMERGENCY_RESOLVED', title: 'Marked safe', body: `${user.fullName.split(' ')[0]} has marked themselves safe.`, channel: 'PUSH', relatedType: 'EMERGENCY', relatedId: emergency.id });
  await audit(user.id, 'EMERGENCY_RESOLVED', 'EMERGENCY', emergency.id);
  broadcast(user.id, { kind: 'emergency.updated', emergency: emergencyView(emergency, user.id) });
  send(res, { emergency: emergencyView(emergency, user.id) });
}));
api.post('/emergency/:emergencyId/acknowledge', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const emergency = store.data.emergencies.find((item) => item.id === req.params.emergencyId);
  if (!emergency) throw notFound('Emergency session not found.');
  const isOwner = emergency.userId === user.id;
  const contact = store.data.contacts.find((item) => item.ownerId === emergency.userId && item.id === req.body?.contactId);
  if (!isOwner && user.role !== 'ADMIN' && !contact) throw forbidden();
  if (['ACTIVE', 'CREATED', 'COUNTDOWN'].includes(emergency.status)) transitionEmergency(emergency, 'ACKNOWLEDGED', user.id, 'Alert acknowledged');
  await store.persist();
  broadcast(emergency.userId, { kind: 'emergency.updated', emergency: emergencyView(emergency, emergency.userId) });
  send(res, { emergency: emergencyView(emergency, user.id) });
}));
api.post('/emergency/:emergencyId/location', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const emergency = store.data.emergencies.find((item) => item.id === req.params.emergencyId && item.userId === user.id);
  if (!emergency) throw notFound('Emergency session not found.');
  const location = parseBody(locationSchema, req);
  if (['RESOLVED', 'CANCELLED'].includes(emergency.status)) throw conflict('Location sharing has ended for this emergency.');
  emergency.location = location;
  emergency.lastLocationAt = location.timestamp;
  emergency.updatedAt = now();
  await store.persist();
  broadcast(user.id, { kind: 'location.updated', emergencyId: emergency.id, location });
  send(res, { location });
}));
api.post('/emergency/:emergencyId/share/revoke', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const emergency = store.data.emergencies.find((item) => item.id === req.params.emergencyId && item.userId === user.id);
  if (!emergency) throw notFound('Emergency session not found.');
  emergency.shareRevokedAt = now();
  await store.persist();
  send(res, { revoked: true });
}));

// Location session endpoint supports mobile clients and journey tracking.
api.post('/location/update', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const body = parseBody(z.object({ sessionType: z.enum(['EMERGENCY', 'JOURNEY']), sessionId: z.string().min(1), location: locationSchema }), req);
  if (body.sessionType === 'EMERGENCY') {
    const emergency = store.data.emergencies.find((item) => item.id === body.sessionId && item.userId === user.id);
    if (!emergency) throw notFound('Emergency location session not found.');
    emergency.location = body.location;
    emergency.lastLocationAt = body.location.timestamp;
    emergency.updatedAt = now();
  } else {
    const journey = store.data.journeys.find((item) => item.id === body.sessionId && item.userId === user.id);
    if (!journey) throw notFound('Journey location session not found.');
    if (journey.status !== 'ACTIVE') throw conflict('This journey is not actively sharing location.');
    journey.lastLocation = body.location;
    journey.updatedAt = now();
  }
  await store.persist();
  broadcast(user.id, { kind: 'location.updated', sessionType: body.sessionType, sessionId: body.sessionId, location: body.location });
  send(res, { accepted: true, location: body.location });
}));

// Safe journeys
api.get('/journeys', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  send(res, { journeys: store.data.journeys.filter((item) => item.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
}));
api.post('/journeys', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const body = parseBody(z.object({ title: z.string().trim().min(2).max(80), origin: z.string().trim().min(2).max(160), destination: z.string().trim().min(2).max(160), expectedArrival: z.string().datetime(), contactIds: z.array(z.string()).default([]) }), req);
  const ownedContacts = new Set(store.data.contacts.filter((item) => item.ownerId === user.id).map((item) => item.id));
  if (body.contactIds.some((contactId) => !ownedContacts.has(contactId))) throw badRequest('One or more contacts are not in your trusted circle.');
  const timestamp = now();
  const journey: JourneyRecord = { id: id(), userId: user.id, title: body.title, origin: body.origin, destination: body.destination, expectedArrival: body.expectedArrival, status: 'PLANNED', progress: 0, contactIds: body.contactIds, locationSessionId: id(), createdAt: timestamp, updatedAt: timestamp };
  store.data.journeys.unshift(journey);
  await store.persist();
  send(res, { journey }, 201);
}));
api.post('/journeys/:journeyId/start', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const journey = store.data.journeys.find((item) => item.id === req.params.journeyId && item.userId === user.id);
  if (!journey) throw notFound('Journey not found.');
  if (journey.status !== 'PLANNED') throw conflict('Only planned journeys can be started.');
  journey.status = 'ACTIVE';
  journey.updatedAt = now();
  await store.persist();
  for (const contactId of journey.contactIds) await notifications.enqueue({ recipientId: contactId, type: 'JOURNEY_STARTED', title: `${user.fullName.split(' ')[0]} started a journey`, body: `${journey.origin} → ${journey.destination}.`, channel: 'PUSH', relatedType: 'JOURNEY', relatedId: journey.id });
  broadcast(user.id, { kind: 'journey.updated', journey });
  send(res, { journey });
}));
api.post('/journeys/:journeyId/check-in', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const journey = store.data.journeys.find((item) => item.id === req.params.journeyId && item.userId === user.id);
  if (!journey) throw notFound('Journey not found.');
  const body = parseBody(z.object({ message: z.string().max(300).optional(), location: locationSchema.optional() }), req);
  const checkIn = { id: id(), userId: user.id, journeyId: journey.id, message: body.message ?? 'I am safe', location: body.location ?? journey.lastLocation, createdAt: now() };
  store.data.checkIns.unshift(checkIn);
  journey.anomaly = journey.anomaly ? { ...journey.anomaly, acknowledged: true } : undefined;
  await store.persist();
  await notifications.notifyUserAndContacts(user.id, { type: 'CHECK_IN', title: `${user.fullName.split(' ')[0]} checked in`, body: checkIn.message ?? 'I am safe', channel: 'PUSH', relatedType: 'JOURNEY', relatedId: journey.id });
  send(res, { checkIn });
}));
api.post('/journeys/:journeyId/extend', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const journey = store.data.journeys.find((item) => item.id === req.params.journeyId && item.userId === user.id);
  if (!journey) throw notFound('Journey not found.');
  const body = parseBody(z.object({ minutes: z.number().int().min(5).max(180) }), req);
  journey.expectedArrival = extendDeadline(journey.expectedArrival, body.minutes);
  journey.status = 'ACTIVE';
  journey.anomaly = undefined;
  journey.updatedAt = now();
  await store.persist();
  send(res, { journey });
}));
api.post('/journeys/:journeyId/end', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const journey = store.data.journeys.find((item) => item.id === req.params.journeyId && item.userId === user.id);
  if (!journey) throw notFound('Journey not found.');
  journey.status = 'COMPLETED';
  journey.progress = 100;
  journey.completedAt = now();
  journey.updatedAt = now();
  await store.persist();
  await notifications.notifyUserAndContacts(user.id, { type: 'JOURNEY_COMPLETED', title: 'Journey completed safely', body: `${user.fullName.split(' ')[0]} reached ${journey.destination}.`, channel: 'PUSH', relatedType: 'JOURNEY', relatedId: journey.id });
  broadcast(user.id, { kind: 'journey.updated', journey });
  send(res, { journey });
}));
api.post('/journeys/:journeyId/simulate-deviation', auth, rolesRequired('ADMIN'), asyncRoute(async (req, res) => {
  const journey = store.data.journeys.find((item) => item.id === req.params.journeyId);
  if (!journey) throw notFound('Journey not found.');
  journey.anomaly = { type: 'DEVIATION', detectedAt: now() };
  journey.status = 'ACTIVE';
  await store.persist();
  await notifications.notifyUserAndContacts(journey.userId, { type: 'JOURNEY_DEVIATION', title: 'Please confirm you are safe', body: 'ABHAYA noticed a possible route deviation. This is not an emergency classification.', channel: 'PUSH', relatedType: 'JOURNEY', relatedId: journey.id });
  broadcast(journey.userId, { kind: 'journey.anomaly', journey });
  send(res, { journey, note: 'Demo anomaly created. User confirmation is required before escalation.' });
}));

// Safety timers
api.get('/timers', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  send(res, { timers: store.data.timers.filter((item) => item.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
}));
api.post('/timers', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const body = parseBody(z.object({ durationMinutes: z.number().int().min(1).max(1440), label: z.string().trim().min(2).max(80).default('Check on me') }), req);
  const timer = { id: id(), userId: user.id, label: body.label, durationMinutes: body.durationMinutes, expiresAt: addMinutes(new Date(), body.durationMinutes), status: 'RUNNING' as const, createdAt: now(), updatedAt: now() };
  store.data.timers.unshift(timer);
  await store.persist();
  send(res, { timer }, 201);
}));
api.post('/timers/:timerId/confirm', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const timer = store.data.timers.find((item) => item.id === req.params.timerId && item.userId === user.id);
  if (!timer) throw notFound('Safety timer not found.');
  timer.status = 'CONFIRMED';
  timer.updatedAt = now();
  await store.persist();
  await notifications.notifyUserAndContacts(user.id, { type: 'TIMER_CONFIRMED', title: 'Safety check-in received', body: `${user.fullName.split(' ')[0]} confirmed they are safe.`, channel: 'PUSH', relatedType: 'TIMER', relatedId: timer.id });
  send(res, { timer });
}));
api.post('/timers/:timerId/extend', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const timer = store.data.timers.find((item) => item.id === req.params.timerId && item.userId === user.id);
  if (!timer) throw notFound('Safety timer not found.');
  const body = parseBody(z.object({ minutes: z.number().int().min(1).max(1440) }), req);
  timer.expiresAt = extendDeadline(timer.expiresAt, body.minutes);
  timer.graceUntil = undefined;
  timer.status = 'RUNNING';
  timer.updatedAt = now();
  await store.persist();
  send(res, { timer });
}));
api.post('/timers/:timerId/cancel', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const timer = store.data.timers.find((item) => item.id === req.params.timerId && item.userId === user.id);
  if (!timer) throw notFound('Safety timer not found.');
  timer.status = 'CANCELLED';
  timer.updatedAt = now();
  await store.persist();
  send(res, { timer });
}));
api.post('/timers/:timerId/simulate-expiry', auth, rolesRequired('ADMIN'), asyncRoute(async (req, res) => {
  const timer = store.data.timers.find((item) => item.id === req.params.timerId);
  if (!timer) throw notFound('Safety timer not found.');
  timer.status = 'GRACE';
  timer.graceUntil = addMinutes(new Date(), 5);
  timer.updatedAt = now();
  await store.persist();
  await notifications.notifyUserAndContacts(timer.userId, { type: 'TIMER_EXPIRED', title: 'Please confirm you are safe', body: 'Your safety timer expired. You have a grace period to check in.', channel: 'PUSH', relatedType: 'TIMER', relatedId: timer.id });
  send(res, { timer, note: 'Grace period started; no emergency was automatically created.' });
}));

// Check-ins, notifications, resources, history
api.post('/check-ins', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const body = parseBody(z.object({ emergencyId: z.string().optional(), journeyId: z.string().optional(), timerId: z.string().optional(), message: z.string().max(300).optional(), location: locationSchema.optional() }), req);
  for (const idToCheck of [body.emergencyId, body.journeyId, body.timerId].filter(Boolean)) {
    const owns = store.data.emergencies.some((item) => item.id === idToCheck && item.userId === user.id) || store.data.journeys.some((item) => item.id === idToCheck && item.userId === user.id) || store.data.timers.some((item) => item.id === idToCheck && item.userId === user.id);
    if (!owns) throw forbidden();
  }
  const checkIn = { id: id(), userId: user.id, ...body, createdAt: now() };
  store.data.checkIns.unshift(checkIn);
  await store.persist();
  await notifications.notifyUserAndContacts(user.id, { type: 'CHECK_IN', title: `${user.fullName.split(' ')[0]} is safe`, body: body.message ?? 'I am Safe', channel: 'PUSH', relatedType: 'CHECK_IN', relatedId: checkIn.id });
  send(res, { checkIn }, 201);
}));
api.get('/check-ins', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  send(res, { checkIns: store.data.checkIns.filter((item) => item.userId === user.id).slice(0, 50) });
}));
api.get('/notifications', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const ownContactIds = new Set(store.data.contacts.filter((item) => item.ownerId === user.id).map((item) => item.id));
  send(res, { notifications: store.data.notifications.filter((item) => item.userId === user.id || (item.recipientId && ownContactIds.has(item.recipientId))).slice(0, 50) });
}));
api.get('/resources', auth, asyncRoute(async (req, res) => {
  const lat = typeof req.query.lat === 'string' ? asNumber(req.query.lat, 17.4239) : 17.4239;
  const lng = typeof req.query.lng === 'string' ? asNumber(req.query.lng, 78.4071) : 78.4071;
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const resources = store.data.resources.filter((item) => !type || item.type === type).map((item) => ({ ...item, distanceKm: distanceKm({ latitude: lat, longitude: lng }, item) })).sort((a, b) => a.distanceKm - b.distanceKm);
  send(res, { resources, center: { latitude: lat, longitude: lng } });
}));
api.get('/history', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  send(res, { emergencies: store.data.emergencies.filter((item) => item.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), journeys: store.data.journeys.filter((item) => item.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), timers: store.data.timers.filter((item) => item.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), checkIns: store.data.checkIns.filter((item) => item.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50), evidence: store.data.evidence.filter((item) => item.userId === user.id) });
}));

// Evidence session metadata. Raw media belongs in S3-compatible storage in production.
api.post('/evidence/sessions', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const body = parseBody(z.object({ emergencyId: z.string().optional(), type: z.enum(['AUDIO', 'VIDEO']), fileName: z.string().trim().min(1).max(200), mimeType: z.string().regex(/^(audio|video)\//), sizeBytes: z.number().int().positive().max(config.evidenceMaxBytes) }), req);
  if (body.emergencyId && !store.data.emergencies.some((item) => item.id === body.emergencyId && item.userId === user.id)) throw forbidden();
  const record = { id: id(), userId: user.id, emergencyId: body.emergencyId, type: body.type, fileName: body.fileName, mimeType: body.mimeType, sizeBytes: body.sizeBytes, status: 'UPLOADING' as const, retentionUntil: addHours(new Date(), user.settings.privacy.evidenceRetentionDays * 24), createdAt: now() };
  store.data.evidence.unshift(record);
  await store.persist();
  send(res, { evidence: record, upload: { mode: 'presigned-url-required', message: 'Configure S3 credentials to receive a presigned upload URL. No media bytes are stored by the demo API.' } }, 201);
}));
api.post('/evidence/:evidenceId/complete', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const record = store.data.evidence.find((item) => item.id === req.params.evidenceId && item.userId === user.id);
  if (!record) throw notFound('Evidence session not found.');
  record.status = 'READY';
  await store.persist();
  send(res, { evidence: record });
}));
api.delete('/evidence/:evidenceId', auth, asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const record = store.data.evidence.find((item) => item.id === req.params.evidenceId && item.userId === user.id);
  if (!record) throw notFound('Evidence session not found.');
  record.status = 'DELETED';
  await store.persist();
  send(res, { deleted: true });
}));

// Temporary public emergency / journey share link. Only minimal information is returned.
app.get('/emergency/:token', asyncRoute(async (req, res) => {
  const link = store.data.shareLinks.find((item) => item.tokenHash === hashToken(String(req.params.token)) && !item.revokedAt && item.expiresAt > now());
  if (!link) throw new AppError(410, 'LINK_EXPIRED', 'This safety link has expired or been revoked.');
  const user = store.data.users.find((item) => item.id === link.ownerId);
  if (!user) throw notFound('Safety link owner not found.');
  const emergency = link.emergencyId ? store.data.emergencies.find((item) => item.id === link.emergencyId) : undefined;
  const journey = link.journeyId ? store.data.journeys.find((item) => item.id === link.journeyId) : undefined;
  send(res, { firstName: user.fullName.split(' ')[0], status: emergency?.status ?? journey?.status ?? 'UNKNOWN', lastKnownLocation: emergency?.location ?? journey?.lastLocation, timestamp: emergency?.lastLocationAt ?? journey?.lastLocation?.timestamp ?? link.createdAt, expiresAt: link.expiresAt, safe: emergency?.status === 'RESOLVED' || journey?.status === 'COMPLETED' });
}));

api.get('/public/share/:token', asyncRoute(async (req, res) => {
  send(res, publicShare(store, String(req.params.token)));
}));

// Admin dashboard
const admin = express.Router();
admin.use(auth, rolesRequired('ADMIN'));
admin.get('/overview', asyncRoute(async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const activeEmergencies = store.data.emergencies.filter((item) => ['CREATED', 'COUNTDOWN', 'ACTIVE', 'ACKNOWLEDGED'].includes(item.status));
  const deliveries = store.data.notifications.filter((item) => item.createdAt.startsWith(today));
  send(res, { stats: { totalUsers: store.data.users.filter((item) => item.role === 'USER').length, activeEmergencies: activeEmergencies.length, activeJourneys: store.data.journeys.filter((item) => item.status === 'ACTIVE').length, emergenciesToday: store.data.emergencies.filter((item) => item.createdAt.startsWith(today)).length, resolvedIncidents: store.data.emergencies.filter((item) => item.status === 'RESOLVED').length, cancelledIncidents: store.data.emergencies.filter((item) => item.status === 'CANCELLED').length, notificationDeliverySuccess: deliveries.length ? Math.round((deliveries.filter((item) => ['SENT', 'DELIVERED'].includes(item.status)).length / deliveries.length) * 100) : 100, systemErrors: 0 }, activeEmergencies: activeEmergencies.map((item) => emergencyView(item)), recentAudit: store.data.audits.slice(0, 12) });
}));
admin.get('/users', asyncRoute(async (_req, res) => send(res, { users: store.data.users.map((item) => ({ ...safeUser(item), createdAt: item.createdAt, settings: item.settings })) })));
admin.get('/emergencies', asyncRoute(async (_req, res) => send(res, { emergencies: store.data.emergencies.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => emergencyView(item)) })));
admin.get('/journeys', asyncRoute(async (_req, res) => send(res, { journeys: store.data.journeys.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })));
admin.get('/notifications', asyncRoute(async (_req, res) => send(res, { notifications: store.data.notifications.slice(0, 100) })));
admin.get('/audits', asyncRoute(async (_req, res) => send(res, { audits: store.data.audits.slice(0, 100) })));
admin.get('/resources', asyncRoute(async (_req, res) => send(res, { resources: store.data.resources })));
admin.post('/resources', asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const body = parseBody(z.object({ name: z.string().trim().min(2).max(140), type: z.enum(['POLICE', 'HOSPITAL', 'PHARMACY', 'SHELTER', 'OTHER']), address: z.string().trim().min(3).max(240), phone: phoneSchema.optional(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), verified: z.boolean().default(false) }), req);
  const resource = { id: id(), ...body, createdAt: now(), updatedAt: now() };
  store.data.resources.push(resource);
  await store.persist();
  await audit(user.id, 'RESOURCE_CREATED', 'RESOURCE', resource.id, { name: resource.name }, req.ip);
  send(res, { resource }, 201);
}));
admin.post('/emergencies/:emergencyId/resolve', asyncRoute(async (req, res) => {
  const user = userFrom(req);
  const emergency = store.data.emergencies.find((item) => item.id === req.params.emergencyId);
  if (!emergency) throw notFound('Emergency not found.');
  if (!['RESOLVED', 'CANCELLED'].includes(emergency.status)) transitionEmergency(emergency, 'RESOLVED', user.id, 'Admin resolution');
  await store.persist();
  await audit(user.id, 'ADMIN_RESOLVED_EMERGENCY', 'EMERGENCY', emergency.id, undefined, req.ip);
  broadcast(emergency.userId, { kind: 'emergency.updated', emergency: emergencyView(emergency, emergency.userId) });
  send(res, { emergency });
}));
api.use('/admin', admin);

// Demo-only operational controls are isolated, guarded, and never mounted in production.
if (config.demoMode && config.nodeEnv !== 'production') {
  api.post('/demo/reset', auth, rolesRequired('ADMIN'), asyncRoute(async (_req, res) => { await store.reset(); send(res, { reset: true }); }));
  api.get('/demo/credentials', (_req, res) => send(res, { user: { email: 'demo@abhaya.app', password: 'Password123!' }, admin: { email: 'admin@abhaya.app', password: 'Admin123!' } }));
}

app.use('/api/v1', api);
app.use((_req, _res, next) => next(notFound()));
app.use(errorHandler);

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (socket, request) => {
  try {
    const url = new URL(request.url ?? '/ws', `http://${request.headers.host ?? 'localhost'}`);
    const token = url.searchParams.get('token');
    if (!token) { socket.close(1008, 'Authentication required'); return; }
    const payload = jwt.verify(token, config.accessSecret) as { sub: string; role: Role; type: string };
    if (payload.type !== 'access' || !store.data.users.some((item) => item.id === payload.sub)) { socket.close(1008, 'Invalid token'); return; }
    const client = { socket, userId: payload.sub, role: payload.role };
    sockets.add(client);
    socket.send(JSON.stringify({ type: 'connected', payload: { realtime: true, userId: payload.sub } }));
    socket.on('close', () => sockets.delete(client));
    socket.on('error', () => sockets.delete(client));
  } catch { socket.close(1008, 'Invalid token'); }
});

server.listen(config.port, '0.0.0.0', () => console.log(`ABHAYA API listening on 0.0.0.0:${config.port} · ${config.demoMode ? 'demo' : 'production'} mode`));
