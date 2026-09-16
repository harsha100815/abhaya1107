import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import { unauthorized, forbidden, AppError } from './errors.js';
import { hashToken, now, randomToken, id, addHours, safeUser } from './utils.js';
import type { JsonStore } from './db/store.js';
import type { Role, UserRecord } from './types.js';

type AccessPayload = { sub: string; role: Role; type: 'access' };

export interface AuthRequest extends Request { user?: UserRecord; auth?: AccessPayload }

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function createAccessToken(user: UserRecord) {
  return jwt.sign({ sub: user.id, role: user.role, type: 'access' } satisfies AccessPayload, config.accessSecret, { expiresIn: config.accessTtl as jwt.SignOptions['expiresIn'] });
}

export async function issueTokens(store: JsonStore, user: UserRecord, request?: Request) {
  const refreshToken = randomToken(48);
  const session = { id: id(), userId: user.id, refreshTokenHash: hashToken(refreshToken), userAgent: request?.headers['user-agent'], ipAddress: request?.ip, expiresAt: addHours(new Date(), 24 * 30), createdAt: now() };
  store.data.sessions = store.data.sessions.filter((item) => item.expiresAt > now() && !item.revokedAt);
  store.data.sessions.push(session);
  await store.persist();
  return { accessToken: createAccessToken(user), refreshToken, sessionId: session.id };
}

export function authRequired(store: JsonStore) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) throw unauthorized();
      const token = header.slice(7);
      const payload = jwt.verify(token, config.accessSecret) as AccessPayload;
      if (payload.type !== 'access') throw unauthorized();
      const user = store.data.users.find((item) => item.id === payload.sub);
      if (!user) throw unauthorized('Your session is no longer valid.');
      req.user = user;
      req.auth = payload;
      next();
    } catch (error) {
      next(error instanceof AppError ? error : unauthorized('Your session has expired. Please sign in again.'));
    }
  };
}

export const rolesRequired = (...roles: Role[]) => (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return next(forbidden());
  return next();
};

export async function rotateRefreshToken(store: JsonStore, refreshToken: string, request?: Request) {
  const session = store.data.sessions.find((item) => item.refreshTokenHash === hashToken(refreshToken) && !item.revokedAt && item.expiresAt > now());
  if (!session) throw unauthorized('Refresh token is invalid or expired.');
  const user = store.data.users.find((item) => item.id === session.userId);
  if (!user) throw unauthorized();
  session.revokedAt = now();
  const tokens = await issueTokens(store, user, request);
  return { ...tokens, user: safeUser(user) };
}

export function publicUser(user: UserRecord) { return safeUser(user); }
