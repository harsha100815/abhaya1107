import 'dotenv/config';

const bool = (value: string | undefined, fallback: boolean) => value === undefined ? fallback : value === 'true';

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGINS ?? process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',').map((value) => value.trim()),
  demoMode: bool(process.env.DEMO_MODE, true),
  dataDir: process.env.DATA_DIR ?? './data',
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseMode: process.env.DATABASE_MODE ?? 'file',
  accessSecret: process.env.JWT_ACCESS_SECRET ?? 'local-only-access-secret-change-me-32-chars',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'local-only-refresh-secret-change-me-32-chars',
  accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTtl: process.env.REFRESH_TOKEN_TTL ?? '30d',
  publicLinkTtlHours: Number(process.env.PUBLIC_LINK_TTL_HOURS ?? 24),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
  evidenceMaxBytes: Number(process.env.EVIDENCE_MAX_BYTES ?? 50 * 1024 * 1024),
};

export const isProduction = config.nodeEnv === 'production';
