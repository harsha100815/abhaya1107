import { Router } from 'express';
import { journeySchema, journeyActionSchema, idSchema, paginationSchema } from '@abhaya/validation';
import { validArrival } from '@abhaya/utils';
import { db, lockUser } from '../db';
import { HttpError, ok } from '../http';
import { journeySelect } from '../views';
import { assertMode } from './sos';
export const journeyRouter = Router();
journeyRouter.get('/', async (req, res) => {
  const { take, cursor } = paginationSchema.parse(req.query);
  ok(
    res,
    await db.safetySession.findMany({
      where: { userId: req.auth.userId },
      select: journeySelect,
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
  );
});
journeyRouter.get('/:id', async (req, res) =>
  ok(
    res,
    await db.safetySession.findFirstOrThrow({
      where: { id: idSchema.parse(req.params.id), userId: req.auth.userId },
      select: journeySelect,
    }),
  ),
);
journeyRouter.post('/', async (req, res) => {
  const input = journeySchema.parse(req.body);
  assertMode(input.testMode);
  if (!validArrival(input.expectedAt))
    throw new HttpError(
      400,
      'INVALID_ARRIVAL',
      'Choose an arrival time between 1 minute and 24 hours from now.',
    );
  const userId = req.auth.userId;
  const result = await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const prior = await tx.safetySession.findUnique({
      where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } },
      select: journeySelect,
    });
    if (prior) return prior;
    await tx.emergencyContact.findFirstOrThrow({
      where: { id: input.contactId, userId, receivesAlerts: true },
    });
    if (await tx.safetySession.count({ where: { userId, status: { in: ['ACTIVE', 'OVERDUE'] } } }))
      throw new HttpError(409, 'JOURNEY_ACTIVE', 'Complete or cancel your current journey first.');
    return tx.safetySession.create({ data: { userId, ...input }, select: journeySelect });
  });
  ok(res, result, 201);
});
journeyRouter.patch('/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const input = journeyActionSchema.parse(req.body);
  const userId = req.auth.userId;
  if (
    ['check-in', 'extend'].includes(input.action) &&
    (!input.expectedAt || !validArrival(input.expectedAt))
  )
    throw new HttpError(400, 'INVALID_ARRIVAL', 'Choose a new check-in deadline within 24 hours.');
  const result = await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const row = await tx.safetySession.findFirstOrThrow({ where: { id, userId } });
    if (!['ACTIVE', 'OVERDUE'].includes(row.status))
      throw new HttpError(409, 'JOURNEY_ENDED', 'This journey has already ended.');
    const ending = ['complete', 'cancel'].includes(input.action);
    const data = ending
      ? {
          status: input.action === 'complete' ? ('COMPLETED' as const) : ('CANCELLED' as const),
          endedAt: new Date(),
          shareLocation: false,
        }
      : {
          status: 'ACTIVE' as const,
          expectedAt: new Date(input.expectedAt!),
          ...(input.action === 'check-in' ? { lastCheckInAt: new Date() } : {}),
        };
    await tx.safetySession.update({ where: { id }, data });
    await tx.notification.updateMany({
      where: { safetySessionId: id, status: 'QUEUED' },
      data: { status: 'CANCELLED' },
    });
    await tx.shareGrant.deleteMany({ where: { safetySessionId: id } });
    return tx.safetySession.findUniqueOrThrow({ where: { id }, select: journeySelect });
  });
  ok(res, result);
});
journeyRouter.post('/:id/stop-sharing', async (req, res) => {
  const id = idSchema.parse(req.params.id),
    userId = req.auth.userId;
  await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    await tx.safetySession.update({ where: { id, userId }, data: { shareLocation: false } });
    await tx.shareGrant.deleteMany({ where: { safetySessionId: id, userId } });
  });
  ok(res, { message: 'Location sharing stopped.' });
});
