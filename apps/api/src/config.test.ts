import { describe, expect, it } from 'vitest';
import { parseEnv } from './config';

// Synthetic configuration only; no provider or database is contacted.
const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://localhost/abhaya_test',
  JWT_SECRET: 'a'.repeat(48),
  DATA_ENCRYPTION_KEY: 'b'.repeat(64),
  PUBLIC_WEB_URL: 'https://web.example.com',
  CORS_ORIGINS: 'https://web.example.com',
  TEST_MODE_ONLY: 'false',
  SMS_ACCOUNT_SID: 'synthetic-account',
  SMS_AUTH_TOKEN: 'synthetic-sms-token',
  SMS_FROM: '+15005550006',
  EMAIL_API_KEY: 'synthetic-email-token',
  EMAIL_FROM: 'ABHAYA <alerts@example.com>',
  EXPO_ACCESS_TOKEN: 'synthetic-push-token',
};

describe('production configuration', () => {
  it('accepts a complete live configuration', () => {
    expect(parseEnv(production).TEST_MODE_ONLY).toBe(false);
  });
  it('rejects explicit and default simulated mode', () => {
    for (const value of ['true', undefined])
      expect(() => parseEnv({ ...production, TEST_MODE_ONLY: value })).toThrow(/simulated/);
  });
  it.each([
    'SMS_ACCOUNT_SID',
    'SMS_AUTH_TOKEN',
    'SMS_FROM',
    'EMAIL_API_KEY',
    'EMAIL_FROM',
    'EXPO_ACCESS_TOKEN',
  ])('rejects missing or blank %s', (key) => {
    for (const value of [undefined, '', '   '])
      expect(() => parseEnv({ ...production, [key]: value })).toThrow(/Production requires/);
  });
  it('rejects insecure origins and a mismatched browser origin', () => {
    expect(() => parseEnv({ ...production, PUBLIC_WEB_URL: 'http://web.example.com' })).toThrow(
      /HTTPS/,
    );
    expect(() => parseEnv({ ...production, CORS_ORIGINS: 'http://web.example.com' })).toThrow(
      /HTTPS/,
    );
    expect(() => parseEnv({ ...production, CORS_ORIGINS: 'https://another.example.com' })).toThrow(
      /must include PUBLIC_WEB_URL/,
    );
  });
  it('retains credential-free local simulation', () => {
    expect(
      parseEnv({
        DATABASE_URL: production.DATABASE_URL,
        JWT_SECRET: production.JWT_SECRET,
        DATA_ENCRYPTION_KEY: production.DATA_ENCRYPTION_KEY,
        PUBLIC_WEB_URL: 'http://localhost:3000',
        CORS_ORIGINS: 'http://localhost:3000',
      }).TEST_MODE_ONLY,
    ).toBe(true);
  });
});
