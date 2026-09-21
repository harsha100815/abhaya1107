import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { hash, compare } from 'bcryptjs';
import { env } from './env';
export const newToken = () => randomBytes(32).toString('hex');
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export const hashPassword = (value: string) => hash(value, 12);
export const verifyPassword = (value: string, hashed: string) => compare(value, hashed);
export async function accessToken(userId: string, sessionId: string) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('abhaya-api')
    .setAudience('abhaya-client')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(env.JWT_SECRET));
}
export async function verifyAccess(token: string) {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET), {
    algorithms: ['HS256'],
    issuer: 'abhaya-api',
    audience: 'abhaya-client',
  });
  if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string')
    throw new Error('Invalid token');
  return { userId: payload.sub, sessionId: payload.sid };
}
export function encrypt(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(env.DATA_ENCRYPTION_KEY, 'hex'), iv);
  return new Uint8Array(
    Buffer.concat([iv, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]),
  );
}
export function decrypt(bytes: Uint8Array): Buffer {
  const value = Buffer.from(bytes);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(env.DATA_ENCRYPTION_KEY, 'hex'),
    value.subarray(0, 12),
  );
  decipher.setAuthTag(value.subarray(-16));
  return Buffer.concat([decipher.update(value.subarray(12, -16)), decipher.final()]);
}
