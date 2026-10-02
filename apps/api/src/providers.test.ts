import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '@prisma/client';
vi.mock('./env', () => ({
  env: {
    NODE_ENV: 'test',
    DATA_ENCRYPTION_KEY: 'a'.repeat(64),
    SMS_ACCOUNT_SID: 'test-account',
    SMS_AUTH_TOKEN: 'test-secret',
    SMS_FROM: 'test-sender',
    EMAIL_API_KEY: 'test-email-key',
    EMAIL_FROM: 'ABHAYA <alerts@example.test>',
    EXPO_ACCESS_TOKEN: 'test-push-key',
  },
}));
import { env } from './env';
import { encrypt } from './security';
import { deliver, receipt } from './providers';
const network = vi.fn();
const job = (channel = 'sms', extra: Partial<Notification> = {}) =>
  ({
    id: 'test-notification',
    channel,
    recipient: 'synthetic-recipient',
    testMode: false,
    payload: encrypt(
      Buffer.from(JSON.stringify({ title: 'Safety update', body: 'Synthetic test only' })),
    ),
    ...extra,
  }) as Notification;
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
  network.mockReset();
  vi.stubGlobal('fetch', network);
});
afterEach(() => vi.unstubAllGlobals());
describe('provider boundaries with mocked network only', () => {
  it('never calls a provider for TEST jobs and rejects TEST in production', async () => {
    expect(await deliver(job('sms', { testMode: true }))).toEqual({ status: 'TEST' });
    const original = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      expect(await deliver(job('sms', { testMode: true }))).toEqual({
        status: 'FAILED',
        errorCode: 'TEST_DISABLED',
      });
    } finally {
      env.NODE_ENV = original;
    }
    expect(network).not.toHaveBeenCalled();
  });
  it('contains corrupt encrypted payloads without interrupting the worker', async () => {
    expect(await deliver(job('sms', { payload: new Uint8Array([1, 2, 3]) }))).toEqual({
      status: 'FAILED',
      errorCode: 'INVALID_NOTIFICATION_PAYLOAD',
    });
    expect(network).not.toHaveBeenCalled();
  });
  it('contains invalid payload fields without sending', async () => {
    expect(
      await deliver(job('sms', { payload: encrypt(Buffer.from('{"title":1}')) })),
    ).toMatchObject({ status: 'FAILED' });
    expect(network).not.toHaveBeenCalled();
  });
  it('reports missing SMS credentials honestly', async () => {
    const original = env.SMS_FROM;
    env.SMS_FROM = undefined;
    try {
      expect(await deliver(job())).toEqual({
        status: 'UNCONFIGURED',
        errorCode: 'SMS_UNCONFIGURED',
      });
    } finally {
      env.SMS_FROM = original;
    }
    expect(network).not.toHaveBeenCalled();
  });
  it('submits SMS with authentication and separates queued from delivered', async () => {
    network.mockResolvedValue(response({ sid: 'SMsynthetic', status: 'queued' }));
    expect(await deliver(job())).toEqual({ status: 'ACCEPTED', providerId: 'SMsynthetic' });
    const [url, init] = network.mock.calls[0]!;
    expect(url).toContain('/Accounts/test-account/Messages.json');
    expect(init.headers.Authorization).toMatch(/^Basic /);
    expect(new URLSearchParams(init.body).get('Body')).toBe('Synthetic test only');
  });
  it.each(['delivered', 'undelivered', 'failed'])('recognizes SMS receipt %s', async (status) => {
    network.mockResolvedValue(response({ status }));
    expect(await receipt(job('sms', { providerId: 'SMsynthetic' }))).toMatchObject({
      status: status === 'delivered' ? 'DELIVERED' : 'FAILED',
    });
  });
  it.each([400, 401, 429])('records explicit provider rejection %s as failed', async (status) => {
    network.mockResolvedValue(response({ error: 'synthetic' }, status));
    expect(await deliver(job())).toEqual({
      status: 'FAILED',
      errorCode: `PROVIDER_HTTP_${status}`,
    });
  });
  it('keeps server errors and transport timeouts unconfirmed without resending', async () => {
    network.mockResolvedValueOnce(response({}, 503));
    expect(await deliver(job())).toMatchObject({ status: 'UNKNOWN' });
    network.mockResolvedValueOnce(response({}, 408));
    expect(await deliver(job())).toMatchObject({ status: 'UNKNOWN' });
    network.mockRejectedValueOnce(new Error('synthetic timeout'));
    expect(await deliver(job())).toMatchObject({ status: 'UNKNOWN' });
    expect(network).toHaveBeenCalledTimes(3);
  });
  it('rejects malformed successful responses as unconfirmed', async () => {
    network.mockResolvedValue(response({ wrong: 'shape' }));
    expect(await deliver(job())).toMatchObject({ status: 'UNKNOWN' });
  });
  it('uses email idempotency and recognizes delivered and bounced receipts', async () => {
    network.mockResolvedValueOnce(response({ id: 'email-synthetic' }));
    expect(await deliver(job('email'))).toEqual({
      status: 'ACCEPTED',
      providerId: 'email-synthetic',
    });
    expect(network.mock.calls[0]![1].headers['Idempotency-Key']).toBe('test-notification');
    network.mockResolvedValueOnce(response({ last_event: 'delivered' }));
    expect(await receipt(job('email', { providerId: 'email-synthetic' }))).toEqual({
      status: 'DELIVERED',
    });
    network.mockResolvedValueOnce(response({ last_event: 'bounced' }));
    expect(await receipt(job('email', { providerId: 'email-synthetic' }))).toMatchObject({
      status: 'FAILED',
    });
    network.mockResolvedValueOnce(response({ last_event: 'suppressed' }));
    expect(await receipt(job('email', { providerId: 'email-synthetic' }))).toMatchObject({
      status: 'FAILED',
    });
  });
  it('does not claim device delivery from an accepted push receipt', async () => {
    network.mockResolvedValueOnce(response({ data: { status: 'ok', id: 'push-synthetic' } }));
    expect(await deliver(job('push'))).toEqual({
      status: 'ACCEPTED',
      providerId: 'push-synthetic',
    });
    network.mockResolvedValueOnce(response({ data: { 'push-synthetic': { status: 'ok' } } }));
    expect(await receipt(job('push', { providerId: 'push-synthetic' }))).toBeNull();
    network.mockResolvedValueOnce(
      response({
        data: { 'push-synthetic': { status: 'error', details: { error: 'DeviceNotRegistered' } } },
      }),
    );
    expect(await receipt(job('push', { providerId: 'push-synthetic' }))).toMatchObject({
      status: 'FAILED',
    });
  });
});
