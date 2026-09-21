import { z } from 'zod';
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  JWT_SECRET: z.string().min(48),
  DATA_ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((v) => v.split(',').map((s) => new URL(s.trim()).origin)),
  PUBLIC_WEB_URL: z.string().url(),
  TEST_MODE_ONLY: bool.default('true'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  SMS_ACCOUNT_SID: z.string().optional(),
  SMS_AUTH_TOKEN: z.string().optional(),
  SMS_FROM: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  EMERGENCY_NUMBER: z
    .string()
    .regex(/^\+?\d{3,15}$/)
    .optional(),
  LOCATION_RETENTION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
});
export type Env = z.infer<typeof schema>;
export function parseEnv(source: Record<string, string | undefined>): Env {
  const env = schema.parse(source);
  if (env.NODE_ENV === 'production') {
    if (
      !env.PUBLIC_WEB_URL.startsWith('https:') ||
      env.CORS_ORIGINS.some((v) => !v.startsWith('https:'))
    )
      throw new Error('Production origins must use HTTPS');
    if (env.TEST_MODE_ONLY)
      throw new Error('Production may not use a simulated communication mode');
    if (!env.SMS_ACCOUNT_SID || !env.SMS_AUTH_TOKEN || !env.SMS_FROM)
      throw new Error('Production requires a configured SMS provider');
    if (!env.EMAIL_API_KEY || !env.EMAIL_FROM)
      throw new Error('Production requires email for verification and recovery');
  }
  return env;
}
export const env = parseEnv(process.env);
