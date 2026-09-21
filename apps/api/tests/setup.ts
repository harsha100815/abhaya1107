import { config } from 'dotenv';
import { randomBytes } from 'node:crypto';
config({ path: 'apps/api/.env', quiet: true });
if (
  !process.env.TEST_DATABASE_URL ||
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')
)
  throw new Error('Set TEST_DATABASE_URL to a dedicated database ending in _test.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.TEST_MODE_ONLY = 'true';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.PUBLIC_WEB_URL = 'http://localhost:3000';
for (const key of [
  'SMS_ACCOUNT_SID',
  'SMS_AUTH_TOKEN',
  'SMS_FROM',
  'EMAIL_API_KEY',
  'EMAIL_FROM',
  'EXPO_ACCESS_TOKEN',
])
  delete process.env[key];
