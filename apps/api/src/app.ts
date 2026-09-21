import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './env';
import { db } from './db';
import { auth, errors, requestLog, HttpError, ok, limit } from './http';
import { authRouter } from './auth';
import { contactsRouter } from './routes/contacts';
import { sosRouter } from './routes/sos';
import { journeyRouter } from './routes/journeys';
import { locationRouter, trackingRouter } from './routes/location';
import { incidentsRouter } from './routes/incidents';
import { profileRouter, dashboardRouter, notificationsRouter } from './routes/profile';
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }), requestLog);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.CORS_ORIGINS.includes(origin)) callback(null, true);
        else callback(new HttpError(403, 'ORIGIN_FORBIDDEN', 'This origin is not allowed.'));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '4500kb' }));
  app.get('/health', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'unavailable', database: 'down' });
    }
  });
  app.use('/api/v1', limit('global', 300, 60000));
  app.get('/api/v1/config', (_req, res) =>
    ok(res, {
      testOnly: env.TEST_MODE_ONLY,
      liveAlertsConfigured: !!(env.SMS_ACCOUNT_SID && env.SMS_AUTH_TOKEN && env.SMS_FROM),
      emailVerificationConfigured: !!(env.EMAIL_API_KEY && env.EMAIL_FROM),
      emergencyNumber: env.EMERGENCY_NUMBER ?? null,
    }),
  );
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/tracking', trackingRouter);
  app.use('/api/v1', auth);
  app.use('/api/v1/profile', profileRouter);
  app.use('/api/v1/users/me', profileRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/contacts', contactsRouter);
  app.use('/api/v1/sos', sosRouter);
  app.use('/api/v1/safety-sessions', journeyRouter);
  app.use('/api/v1/location', locationRouter);
  app.use('/api/v1/incidents', incidentsRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.get('/api/v1/safety-map', (_req, res) =>
    ok(res, {
      verifiedPublicIncidents: [],
      resources: [],
      message:
        'No verified public safety dataset is configured. Your private reports are available in your history.',
    }),
  );
  app.use((_req, _res) => {
    throw new HttpError(404, 'NOT_FOUND', 'This endpoint does not exist.');
  });
  app.use(errors);
  return app;
}
