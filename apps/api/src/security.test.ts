import { describe, it, expect, vi } from 'vitest';
vi.mock('./env', async () => {
  const { randomBytes } = await import('node:crypto');
  return {
    env: {
      JWT_SECRET: randomBytes(48).toString('hex'),
      DATA_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    },
  };
});
import {
  accessToken,
  verifyAccess,
  hashPassword,
  verifyPassword,
  encrypt,
  decrypt,
  newToken,
  hashToken,
} from './security';
describe('authentication and encryption', () => {
  it('accepts signed tokens and rejects modified signatures', async () => {
    const token = await accessToken('user-id', 'session-id');
    expect(await verifyAccess(token)).toEqual({ userId: 'user-id', sessionId: 'session-id' });
    const parts = token.split('.');
    parts[2] = `${parts[2]![0] === 'a' ? 'b' : 'a'}${parts[2]!.slice(1)}`;
    await expect(verifyAccess(parts.join('.'))).rejects.toThrow();
  });
  it('hashes credentials and rejects wrong passwords', async () => {
    const hash = await hashPassword('long unique test password');
    expect(hash).not.toContain('long unique test password');
    expect(await verifyPassword('long unique test password', hash)).toBe(true);
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });
  it('encrypts evidence and detects tampering', () => {
    const encrypted = encrypt(Buffer.from('private test evidence'));
    expect(decrypt(encrypted).toString()).toBe('private test evidence');
    encrypted[13] = (encrypted[13] ?? 0) ^ 1;
    expect(() => decrypt(encrypted)).toThrow();
  });
  it('stores only deterministic token digests', () => {
    const token = newToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).not.toBe(token);
    expect(newToken()).not.toBe(token);
  });
});
