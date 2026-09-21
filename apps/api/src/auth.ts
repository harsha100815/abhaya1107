import { Router } from 'express';
import { z } from 'zod';
import {
  loginSchema,
  registerSchema,
  refreshSchema,
  emailSchema,
  resetSchema,
  opaqueTokenSchema,
} from '@abhaya/validation';
import { db, lockUser } from './db';
import { env } from './env';
import { auth, HttpError, limit, ok } from './http';
import { newToken, hashToken, hashPassword, verifyPassword, accessToken } from './security';
import { userView } from './views';
import { queueEmail } from './outbox';

export const authRouter = Router();
authRouter.use(limit('auth-ip', 50, 15 * 60000));
const accountLimit = limit('auth-account', 10, 15 * 60000, (req) =>
  typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : (req.ip ?? 'unknown'),
);
const dummyHashPromise = hashPassword(newToken());
async function issue(userId: string) {
  const refreshToken = newToken();
  const expiresAt = new Date(Date.now() + 30 * 86400000);
  const session = await db.session.create({
    data: {
      userId,
      expiresAt,
      refreshTokens: { create: { tokenHash: hashToken(refreshToken), expiresAt } },
    },
  });
  return { accessToken: await accessToken(userId, session.id), refreshToken };
}
async function sendAction(userId: string, purpose: 'verify' | 'reset') {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const token = newToken();
  await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    await tx.actionToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.actionToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 30 * 60000),
      },
    });
    const url = new URL(`/${purpose}`, env.PUBLIC_WEB_URL);
    url.hash = `token=${token}`;
    await queueEmail(
      tx,
      user,
      `account:${purpose}:${hashToken(token)}`,
      `ABHAYA 1107 — ${purpose === 'reset' ? 'Reset your password' : 'Verify your email'}`,
      `Open this link within 30 minutes: ${url.toString()}\nIf you did not request this, you can ignore it.`,
    );
  });
}
authRouter.post('/register', accountLimit, async (req, res) => {
  const input = registerSchema.parse(req.body);
  const passwordHash = await hashPassword(input.password);
  const user = await db.user.create({
    data: { name: input.name, email: input.email, passwordHash },
  });
  const tokens = await issue(user.id);
  if (env.EMAIL_API_KEY) await sendAction(user.id, 'verify');
  ok(res, { user: userView(user), ...tokens }, 201);
});
authRouter.post('/login', accountLimit, async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await db.user.findUnique({ where: { email: input.email } });
  const valid = await verifyPassword(
    input.password,
    user?.passwordHash ?? (await dummyHashPromise),
  );
  if (!user || !valid)
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  ok(res, { user: userView(user), ...(await issue(user.id)) });
});
authRouter.post('/refresh', async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const tokenHash = hashToken(refreshToken);
  const nextToken = newToken();
  const result = await db.$transaction(async (tx) => {
    const initial = await tx.refreshToken.findUnique({
      where: { tokenHash },
      include: { session: true },
    });
    if (!initial) return null;
    await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "id"=${initial.sessionId}::uuid FOR UPDATE`;
    const row = await tx.refreshToken.findUniqueOrThrow({
      where: { tokenHash },
      include: { session: true },
    });
    if (row.usedAt) {
      await tx.session.update({ where: { id: row.sessionId }, data: { revokedAt: new Date() } });
      return null;
    }
    if (row.expiresAt <= new Date() || row.session.revokedAt || row.session.expiresAt <= new Date())
      return null;
    await tx.refreshToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await tx.refreshToken.create({
      data: {
        sessionId: row.sessionId,
        tokenHash: hashToken(nextToken),
        expiresAt: row.session.expiresAt,
      },
    });
    return { userId: row.session.userId, sessionId: row.sessionId };
  });
  if (!result) throw new HttpError(401, 'SESSION_EXPIRED', 'Your session expired. Sign in again.');
  const user = await db.user.findUniqueOrThrow({ where: { id: result.userId } });
  ok(res, {
    user: userView(user),
    accessToken: await accessToken(result.userId, result.sessionId),
    refreshToken: nextToken,
  });
});
authRouter.post('/logout', auth, async (req, res) => {
  await db.session.update({ where: { id: req.auth.sessionId }, data: { revokedAt: new Date() } });
  ok(res, { message: 'Signed out.' });
});
authRouter.post('/forgot-password', accountLimit, async (req, res) => {
  const { email } = z.object({ email: emailSchema }).strict().parse(req.body);
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM)
    throw new HttpError(
      503,
      'EMAIL_UNCONFIGURED',
      'Password recovery is unavailable until email delivery is configured.',
    );
  const user = await db.user.findUnique({ where: { email } });
  if (user) await sendAction(user.id, 'reset');
  ok(res, { message: 'If the account exists, a reset email has been queued.' });
});
authRouter.post('/reset-password', async (req, res) => {
  const { token, password } = resetSchema.parse(req.body);
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const row = await tx.actionToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row) throw new HttpError(400, 'INVALID_TOKEN', 'This link is invalid or expired.');
    await lockUser(tx, row.userId);
    const changed = await tx.actionToken.updateMany({
      where: { id: row.id, purpose: 'reset', usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (!changed.count)
      throw new HttpError(400, 'INVALID_TOKEN', 'This link is invalid or expired.');
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.session.updateMany({ where: { userId: row.userId }, data: { revokedAt: new Date() } });
  });
  ok(res, { message: 'Password updated. Sign in with your new password.' });
});
authRouter.post('/verification', auth, async (req, res) => {
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM)
    throw new HttpError(503, 'EMAIL_UNCONFIGURED', 'Email verification is not configured.');
  await sendAction(req.auth.userId, 'verify');
  ok(res, { message: 'Verification email queued.' });
});
authRouter.post('/verify', async (req, res) => {
  const { token } = z.object({ token: opaqueTokenSchema }).strict().parse(req.body);
  await db.$transaction(async (tx) => {
    const row = await tx.actionToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row) throw new HttpError(400, 'INVALID_TOKEN', 'This link is invalid or expired.');
    await lockUser(tx, row.userId);
    const changed = await tx.actionToken.updateMany({
      where: { id: row.id, purpose: 'verify', usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (!changed.count)
      throw new HttpError(400, 'INVALID_TOKEN', 'This link is invalid or expired.');
    await tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
  });
  ok(res, { message: 'Email verified.' });
});
