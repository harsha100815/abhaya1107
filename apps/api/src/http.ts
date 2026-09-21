import type { RequestHandler, ErrorRequestHandler, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import pino from 'pino';
import { db } from './db';
import { env } from './env';
import { hashToken, verifyAccess } from './security';

declare module 'express-serve-static-core' {
  interface Request {
    auth: { userId: string; sessionId: string };
    requestId: string;
  }
}
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: [
    'password',
    'passwordHash',
    'token',
    'authorization',
    'refreshToken',
    'email',
    'phone',
    'latitude',
    'longitude',
    'DATABASE_URL',
  ],
});
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const ok = <T>(res: Response, data: T, status = 200) =>
  res.status(status).json({ success: true, data, error: null });
export const auth: RequestHandler = async (req, _res, next) => {
  const bearer = req.headers.authorization;
  if (!bearer?.startsWith('Bearer '))
    throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  let identity;
  try {
    identity = await verifyAccess(bearer.slice(7));
  } catch {
    throw new HttpError(401, 'SESSION_EXPIRED', 'Your session expired. Sign in again.');
  }
  const session = await db.session.findFirst({
    where: {
      id: identity.sessionId,
      userId: identity.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!session) throw new HttpError(401, 'SESSION_EXPIRED', 'Your session expired. Sign in again.');
  req.auth = identity;
  next();
};
export const requestLog: RequestHandler = (req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('Cache-Control', 'no-store');
  const start = Date.now();
  res.on('finish', () =>
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        status: res.statusCode,
        ms: Date.now() - start,
      },
      'request',
    ),
  );
  next();
};
export function limit(
  scope: string,
  maximum: number,
  windowMs: number,
  key: (req: Request) => string = (req) => req.ip ?? 'unknown',
): RequestHandler {
  return async (req, res, next) => {
    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    const id = hashToken(`${scope}:${key(req)}:${bucket}`);
    const row = await db.rateBucket.upsert({
      where: { key: id },
      create: { key: id, expiresAt: new Date((bucket + 1) * windowMs) },
      update: { count: { increment: 1 } },
    });
    if (row.count > maximum) {
      res.setHeader('Retry-After', Math.ceil(((bucket + 1) * windowMs - now) / 1000));
      throw new HttpError(429, 'RATE_LIMIT', 'Too many requests. Wait a moment and try again.');
    }
    next();
  };
}
export const errors: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  let status = 500,
    code = 'INTERNAL_ERROR',
    message = 'The service could not complete this request. Please try again.';
  if (err instanceof HttpError) ({ status, code, message } = err);
  else if (err instanceof ZodError) {
    status = 400;
    code = 'INVALID_INPUT';
    message = err.issues.map((i) => i.message).join('. ');
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      code = 'CONFLICT';
      message = 'This record already exists or an active session is already open.';
    }
    if (err.code === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'This record is unavailable.';
    }
    if (err.code === 'P2034') {
      status = 409;
      code = 'RETRY';
      message = 'Another request changed this record. Refresh and try again.';
    }
  } else if (err instanceof SyntaxError) {
    status = 400;
    code = 'INVALID_JSON';
    message = 'The request body is invalid.';
  } else if (typeof err === 'object' && err && 'type' in err && err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'The upload exceeds the allowed size.';
  }
  if (status >= 500)
    logger.error(
      { requestId: req.requestId, errorType: err instanceof Error ? err.name : 'unknown' },
      'request failed',
    );
  res
    .status(status)
    .json({ success: false, data: null, error: { code, message, requestId: req.requestId } });
};
