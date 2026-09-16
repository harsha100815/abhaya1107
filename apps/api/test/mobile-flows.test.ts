import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('mobile demo API: sign-in, dashboard, journeys, timers, contacts, SOS and sign-out', { timeout: 25000 }, async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'abhaya-mobile-test-'));
  const portProbe = createServer();
  portProbe.listen(0, '127.0.0.1');
  await once(portProbe, 'listening');
  const address = portProbe.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>(resolve => portProbe.close(() => resolve()));
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    env: { ...process.env, NODE_ENV: 'test', DATABASE_MODE: 'file', DATABASE_URL: '', DEMO_MODE: 'true', DATA_DIR: dataDir, PORT: String(port), JWT_ACCESS_SECRET: 'test-only-access-secret-not-a-production-key', JWT_REFRESH_SECRET: 'test-only-refresh-secret-not-a-production-key' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Test API did not start')), 15000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Test API exited: ${code}`)); });
      child.stdout.on('data', chunk => { if (String(chunk).includes('ABHAYA API listening')) { clearTimeout(timeout); resolve(); } });
    });
    let access = '';
    const request = async (path: string, method = 'GET', body?: unknown) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
        method, headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const payload = await response.json() as { ok: boolean; data: any; error?: { message: string } };
      assert.equal(response.ok && payload.ok, true, `${method} ${path}: ${payload.error?.message ?? response.status}`);
      return payload.data;
    };
    const auth = await request('/auth/login', 'POST', { email: 'demo@abhaya.app', password: 'Password123!' });
    access = auth.accessToken;
    for (const path of ['/users/me', '/trusted-contacts', '/emergency/active', '/history', '/notifications']) await request(path);

    const { journey } = await request('/journeys', 'POST', { title: 'Mobile test journey', origin: 'Office', destination: 'Home', expectedArrival: new Date(Date.now() - 60000).toISOString(), contactIds: [] });
    assert.equal(journey.status, 'PLANNED');
    assert.equal((await request(`/journeys/${journey.id}/start`, 'POST', {})).journey.status, 'ACTIVE');
    const journeyExtendedAt = Date.now();
    const extended = await request(`/journeys/${journey.id}/extend`, 'POST', { minutes: 15 });
    assert.ok(Date.parse(extended.journey.expectedArrival) >= journeyExtendedAt + 15 * 60000);
    await request(`/journeys/${journey.id}/check-in`, 'POST', { message: 'I am safe' });
    assert.equal((await request(`/journeys/${journey.id}/end`, 'POST', {})).journey.status, 'COMPLETED');

    const { timer } = await request('/timers', 'POST', { label: 'Mobile test timer', durationMinutes: 5 });
    const timerExtended = await request(`/timers/${timer.id}/extend`, 'POST', { minutes: 5 });
    assert.equal(Date.parse(timerExtended.timer.expiresAt), Date.parse(timer.expiresAt) + 5 * 60000);
    assert.equal((await request(`/timers/${timer.id}/confirm`, 'POST', {})).timer.status, 'CONFIRMED');
    const { contact } = await request('/trusted-contacts', 'POST', { name: 'Test Contact', phone: '+919000000001', relationship: 'Friend', receives: ['EMERGENCY', 'JOURNEY', 'TIMER', 'CHECK_IN'] });
    assert.equal(contact.verified, false);
    assert.equal((await request('/users/me/settings', 'PATCH', { sosCountdown: 10 })).settings.sosCountdown, 10);

    const { emergency } = await request('/emergency', 'POST', { source: 'SOS' });
    assert.equal(emergency.status, 'ACTIVE');
    assert.equal((await request(`/emergency/${emergency.id}/resolve`, 'POST', {})).emergency.status, 'RESOLVED');
    assert.equal((await request('/emergency/active')).emergency, null);
    const history = await request('/history');
    assert.ok(history.checkIns.some((item: { journeyId: string }) => item.journeyId === journey.id));

    const rotated = await request('/auth/refresh', 'POST', { refreshToken: auth.refreshToken });
    access = rotated.accessToken;
    await request('/users/me');
    await request('/auth/logout', 'POST', { refreshToken: rotated.refreshToken });
    const revoked = await fetch(`http://127.0.0.1:${port}/api/v1/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rotated.refreshToken }) });
    assert.equal(revoked.status, 401);
  } finally {
    if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
    await rm(dataDir, { recursive: true, force: true });
  }
});
