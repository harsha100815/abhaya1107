import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyProduction } from './production-smoke.mjs';

const origins = { apiOrigin: 'https://api.example.com', webOrigin: 'https://web.example.com' };
const live = {
  success: true,
  data: {
    testOnly: false,
    liveAlertsConfigured: true,
    emailVerificationConfigured: true,
    pushNotificationsConfigured: true,
  },
};
function fixture(overrides = {}, requests = []) {
  const responses = {
    'https://api.example.com/health': { status: 'ok', database: 'up' },
    'https://api.example.com/api/v1/config': live,
    'https://web.example.com/': '<!doctype html><title>ABHAYA</title>',
    'https://web.example.com/api/config': live,
    ...overrides,
  };
  return async (url, init) => {
    requests.push({ url, init });
    const body = responses[url];
    return typeof body === 'string'
      ? new Response(body, { headers: { 'Content-Type': 'text/html' } })
      : Response.json(body);
  };
}

test('checks health, live providers and the web proxy using only non-redirecting GETs', async () => {
  const requests = [];
  assert.equal((await verifyProduction(origins, fixture({}, requests))).length, 4);
  assert.equal(requests.length, 4);
  for (const { init } of requests) {
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.body, undefined);
  }
});
test('rejects TEST mode behind either the API or web proxy', async () => {
  for (const url of ['https://api.example.com/api/v1/config', 'https://web.example.com/api/config'])
    await assert.rejects(
      verifyProduction(
        origins,
        fixture({ [url]: { ...live, data: { ...live.data, testOnly: true } } }),
      ),
      /not reporting LIVE mode/,
    );
});
test('rejects missing delivery channels instead of treating database health as readiness', async () => {
  for (const key of [
    'liveAlertsConfigured',
    'emailVerificationConfigured',
    'pushNotificationsConfigured',
  ])
    await assert.rejects(
      verifyProduction(
        origins,
        fixture({
          'https://api.example.com/api/v1/config': {
            ...live,
            data: { ...live.data, [key]: false },
          },
        }),
      ),
      /not configured/,
    );
});
test('rejects database failures, HTTP errors, non-JSON responses and connection failures', async () => {
  await assert.rejects(
    verifyProduction(
      origins,
      fixture({
        'https://api.example.com/health': { status: 'unavailable', database: 'down' },
      }),
    ),
    /database is not healthy/,
  );
  await assert.rejects(
    verifyProduction(origins, async () => new Response('', { status: 503 })),
    /HTTP 503/,
  );
  await assert.rejects(
    verifyProduction(origins, fixture({ 'https://api.example.com/health': 'not JSON' })),
    /expected JSON/,
  );
  await assert.rejects(
    verifyProduction(origins, async () => {
      throw new Error('secret provider detail');
    }),
    /connection failed/,
  );
});
test('rejects insecure or credential-bearing origins before making any request', async () => {
  for (const apiOrigin of [
    'http://api.example.com',
    'https://user:secret@api.example.com',
    'https://api.example.com/api',
    'invalid',
  ])
    await assert.rejects(
      verifyProduction({ ...origins, apiOrigin }, async () => assert.fail('unexpected request')),
      /HTTPS origin/,
    );
});
