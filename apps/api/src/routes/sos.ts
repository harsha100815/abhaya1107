import { Router } from 'express';
import { z } from 'zod';
import { sosSchema, idSchema, paginationSchema } from '@abhaya/validation';
import { isFreshLocation } from '@abhaya/utils';
import { db, lockUser } from '../db';
import { env } from '../env';
import { HttpError, ok, limit } from '../http';
import { eventSelect } from '../views';
import { queueAlerts } from '../outbox';
export function assertMode(testMode: boolean) {
  if (env.TEST_MODE_ONLY && !testMode)
    throw new HttpError(409, 'TEST_ONLY', 'This environment only accepts TEST events.');
  if (env.NODE_ENV === 'production' && testMode)
    throw new HttpError(409, 'LIVE_ONLY', 'Test events require a separate testing environment.');
}
export const sosRouter = Router();
sosRouter.get('/', async (req, res) => {
  const { take, cursor } = paginationSchema.parse(req.query);
  ok(
    res,
    await db.emergencyEvent.findMany({
      where: { userId: req.auth.userId },
      select: eventSelect,
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
  );
});
sosRouter.get('/:id', async (req, res) =>
  ok(
    res,
    await db.emergencyEvent.findFirstOrThrow({
      where: { id: idSchema.parse(req.params.id), userId: req.auth.userId },
      select: eventSelect,
    }),
  ),
);
sosRouter.post(
  '/',
  limit('sos-create', 20, 60000, (r) => r.auth.userId),
  async (req, res) => {
    const input = sosSchema.parse(req.body);
    assertMode(input.testMode);
    const userId = req.auth.userId;
    const result = await db.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const prior = await tx.emergencyEvent.findUnique({
        where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } },
        select: eventSelect,
      });
      if (prior) return prior;
      if (input.location && !isFreshLocation(input.location.capturedAt))
        throw new HttpError(
          400,
          'STALE_LOCATION',
          'Refresh your location or activate SOS without coordinates.',
        );

      if (await tx.emergencyEvent.count({ where: { userId, status: 'ACTIVE' } }))
        throw new HttpError(
          409,
          'SOS_ALREADY_ACTIVE',
          'An SOS is already active. Refresh to see its status.',
        );
      const event = await tx.emergencyEvent.create({
        data: {
          userId,
          clientRequestId: input.clientRequestId,
          testMode: input.testMode,
          shareLocation: input.shareLocation,
        },
      });
      if (input.location)
        await tx.locationUpdate.create({
          data: {
            userId,
            emergencyId: event.id,
            clientRequestId: input.clientRequestId,
            ...input.location,
          },
        });
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const contacts = await tx.emergencyContact.findMany({
        where: { userId, receivesAlerts: true },
      });
      await queueAlerts(tx, user, contacts, {
        emergencyId: event.id,
        testMode: event.testMode,
        shareLocation: event.shareLocation,
        kind: 'sos',
      });
      return tx.emergencyEvent.findUniqueOrThrow({ where: { id: event.id }, select: eventSelect });
    });
    ok(res, result, 201);
  },
);
sosRouter.patch('/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const input = z
    .object({ status: z.enum(['RESOLVED', 'CANCELLED']) })
    .strict()
    .parse(req.body);
  const userId = req.auth.userId;
  const result = await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const event = await tx.emergencyEvent.findFirstOrThrow({ where: { id, userId } });
    if (event.status === 'ACTIVE') {
      await tx.emergencyEvent.update({
        where: { id },
        data: { status: input.status, endedAt: new Date(), shareLocation: false },
      });
      await tx.notification.updateMany({
        where: { emergencyId: id, status: 'QUEUED' },
        data: { status: 'CANCELLED' },
      });
      await tx.shareGrant.deleteMany({ where: { emergencyId: id } });
    }
    return tx.emergencyEvent.findUniqueOrThrow({ where: { id }, select: eventSelect });
  });
  ok(res, result);
});
sosRouter.post('/:id/stop-sharing', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const userId = req.auth.userId;
  await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    await tx.emergencyEvent.update({ where: { id, userId }, data: { shareLocation: false } });
    await tx.shareGrant.deleteMany({ where: { emergencyId: id, userId } });
  });
  ok(res, { message: 'Location sharing stopped. Previously sent messages cannot be recalled.' });
});
