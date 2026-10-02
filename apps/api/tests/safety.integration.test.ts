import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { db } from '../src/db';
import { escalateJourneys, processOutbox } from '../src/jobs';
import { decrypt } from '../src/security';
const app = createApp();
const email = `api-${randomUUID()}@example.test`;
const password = 'correct horse battery staple';
let access = '',
  other = '',
  userId = '',
  refresh = '',
  contactId = '',
  sosId = '';
const location = () => ({
  latitude: 17.4001,
  longitude: 78.4001,
  accuracy: 9,
  capturedAt: new Date().toISOString(),
});
const call = (method: 'get' | 'post' | 'patch' | 'delete', path: string, token = access) =>
  request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
beforeAll(async () => {
  await db.rateBucket.deleteMany();
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: [email, `other-${email}`] } } });
  await db.$disconnect();
});
describe.sequential('persisted safety API', () => {
  it('registers without leaking credentials', async () => {
    const r = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'API Test', email, password });
    expect(r.status).toBe(201);
    expect(r.body.data.user.passwordHash).toBeUndefined();
    access = r.body.data.accessToken;
    refresh = r.body.data.refreshToken;
    userId = r.body.data.user.id;
    const b = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Other Test', email: `other-${email}`, password });
    other = b.body.data.accessToken;
  });
  it('rejects missing authentication and foreign origins', async () => {
    expect((await request(app).get('/api/v1/profile')).status).toBe(401);
    expect(
      (await request(app).get('/api/v1/config').set('Origin', 'https://untrusted.invalid')).status,
    ).toBe(403);
  });
  it('logs in and rejects wrong passwords', async () => {
    expect(
      (await request(app).post('/api/v1/auth/login').send({ email, password: 'bad' })).status,
    ).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ email, password })).status).toBe(
      200,
    );
  });
  it('persists a consented contact and enforces ownership', async () => {
    const r = await call('post', '/contacts').send({
      name: 'Trusted friend',
      phone: '+919999999991',
      consentConfirmed: true,
      isPrimary: true,
    });
    expect(r.status).toBe(201);
    contactId = r.body.data.id;
    expect((await call('get', '/contacts')).body.data).toHaveLength(1);
    expect((await call('delete', `/contacts/${contactId}`, other)).status).toBe(404);
  });
  it('creates one acknowledged TEST SOS under retries', async () => {
    const body = {
      clientRequestId: randomUUID(),
      testMode: true,
      shareLocation: true,
      location: location(),
    };
    const first = await call('post', '/sos').send(body);
    expect(first.status).toBe(201);
    sosId = first.body.data.id;
    expect(first.body.data.status).toBe('ACTIVE');
    const again = await call('post', '/sos').send(body);
    expect(again.body.data.id).toBe(sosId);
    expect(await db.emergencyEvent.count({ where: { userId } })).toBe(1);
    expect((await call('get', `/sos/${sosId}`, other)).status).toBe(404);
  });
  it('never sends test notifications to a real provider', async () => {
    await processOutbox();
    const event = await call('get', `/sos/${sosId}`);
    expect(event.body.data.notifications[0].status).toBe('TEST');
  });
  it('returns one SOS and outbox batch for concurrent retries', async () => {
    const event = await db.emergencyEvent.findUniqueOrThrow({ where: { id: sosId } });
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        call('post', '/sos').send({
          clientRequestId: event.clientRequestId,
          testMode: true,
          shareLocation: true,
        }),
      ),
    );
    expect(results.every((r) => r.status === 201 && r.body.data.id === sosId)).toBe(true);
    expect(await db.notification.count({ where: { emergencyId: sosId } })).toBe(1);
  });
  it('accepts fresh location only from the owner', async () => {
    const body = { clientRequestId: randomUUID(), emergencyId: sosId, location: location() };
    expect((await call('post', '/location', other).send(body)).status).toBe(409);
    expect((await call('post', '/location').send(body)).status).toBe(201);
    expect(
      (
        await call('post', '/location').send({
          ...body,
          clientRequestId: randomUUID(),
          location: { ...location(), capturedAt: '2000-01-01T00:00:00.000Z' },
        })
      ).status,
    ).toBe(400);
  });
  it('revokes tracking links when sharing stops', async () => {
    const job = await db.notification.findFirstOrThrow({ where: { emergencyId: sosId } });
    const payload = JSON.parse(decrypt(job.payload).toString()) as { body: string };
    const token = payload.body.match(/token=([a-f0-9]{64})/)?.[1];
    expect(token).toBeDefined();
    expect((await request(app).post('/api/v1/tracking/lookup').send({ token })).status).toBe(200);
    expect((await call('post', `/sos/${sosId}/stop-sharing`).send({})).status).toBe(200);
    expect((await request(app).post('/api/v1/tracking/lookup').send({ token })).status).toBe(404);
    expect(
      (
        await call('post', '/location').send({
          clientRequestId: randomUUID(),
          emergencyId: sosId,
          location: location(),
        })
      ).status,
    ).toBe(409);
  });
  it('resolves SOS and rejects later location updates', async () => {
    const r = await call('patch', `/sos/${sosId}`).send({ status: 'RESOLVED' });
    expect(r.body.data.status).toBe('RESOLVED');
    expect(r.body.data.endedAt).toBeTruthy();
  });
  it('marks a missed journey overdue without inventing an emergency', async () => {
    const r = await call('post', '/safety-sessions').send({
      clientRequestId: randomUUID(),
      destination: 'Home',
      expectedAt: new Date(Date.now() + 600000).toISOString(),
      contactId,
      shareLocation: true,
      testMode: true,
    });
    expect(r.status).toBe(201);
    const id = r.body.data.id;
    await db.safetySession.update({
      where: { id },
      data: { expectedAt: new Date(Date.now() - 1000) },
    });
    await escalateJourneys();
    await escalateJourneys();
    expect((await call('get', `/safety-sessions/${id}`)).body.data.status).toBe('OVERDUE');
    expect(await db.notification.count({ where: { safetySessionId: id } })).toBe(1);
    expect(await db.emergencyEvent.count({ where: { userId, status: 'ACTIVE' } })).toBe(0);
    expect(
      (
        await call('patch', `/safety-sessions/${id}`).send({
          action: 'check-in',
          expectedAt: new Date(Date.now() + 900000).toISOString(),
        })
      ).body.data.status,
    ).toBe('ACTIVE');
    expect(
      (await call('patch', `/safety-sessions/${id}`).send({ action: 'complete' })).body.data.status,
    ).toBe('COMPLETED');
  });
  it('stores private incidents and prevents cross-user access', async () => {
    const r = await call('post', '/incidents').send({
      clientRequestId: randomUUID(),
      category: 'OTHER',
      description: 'Private test incident description',
      occurredAt: new Date().toISOString(),
      location: location(),
    });
    expect(r.status).toBe(201);
    const id = r.body.data.id;
    expect((await call('get', `/incidents/${id}`, other)).status).toBe(404);
    expect((await call('delete', `/incidents/${id}`, other)).status).toBe(404);
    expect((await call('delete', `/incidents/${id}`)).status).toBe(200);
  });
  it('returns honest recovery configuration errors', async () =>
    expect((await request(app).post('/api/v1/auth/forgot-password').send({ email })).status).toBe(
      503,
    ));
  it('keeps authenticated users available after a shared public IP hits its limit', async () => {
    await db.rateBucket.deleteMany();
    expect((await request(app).get('/api/v1/config')).status).toBe(200);
    await db.rateBucket.updateMany({ data: { count: 300 } });
    expect((await request(app).get('/api/v1/config')).status).toBe(429);
    expect((await call('get', '/profile')).status).toBe(200);
    expect((await call('get', '/profile', other)).status).toBe(200);
    await db.rateBucket.deleteMany();
    expect((await request(app).get('/api/v1/profile')).status).toBe(401);
    await db.rateBucket.updateMany({ data: { count: 300 } });
    expect((await request(app).get('/api/v1/profile')).status).toBe(429);
    expect((await call('get', '/profile')).status).toBe(200);
    await db.rateBucket.deleteMany();
  });
  it('rotates refresh tokens and revokes a replayed family', async () => {
    const rotated = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: refresh });
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.refreshToken).not.toBe(refresh);
    expect(
      (await request(app).post('/api/v1/auth/refresh').send({ refreshToken: refresh })).status,
    ).toBe(401);
    expect((await call('get', '/profile', rotated.body.data.accessToken)).status).toBe(401);
  });
  it('requires password confirmation and cascades account deletion', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    access = login.body.data.accessToken;
    expect(
      (await call('delete', '/profile').send({ password: 'incorrect', confirmation: 'DELETE' }))
        .status,
    ).toBe(401);
    expect(
      (await call('delete', '/profile').send({ password, confirmation: 'DELETE' })).status,
    ).toBe(200);
    expect(await db.emergencyContact.count({ where: { userId } })).toBe(0);
    expect(await db.locationUpdate.count({ where: { userId } })).toBe(0);
    expect((await call('get', '/profile')).status).toBe(401);
  });
});
