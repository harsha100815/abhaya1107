import { Router } from 'express';
import { z } from 'zod';
import { locationUpdateSchema, opaqueTokenSchema } from '@abhaya/validation';
import { isFreshLocation } from '@abhaya/utils';
import { db, lockUser } from '../db';
import { HttpError, ok, limit } from '../http';
import { hashToken } from '../security';
import { locationSelect } from '../views';
export const locationRouter = Router();
locationRouter.post(
  '/',
  limit('location', 30, 60000, (r) => r.auth.userId),
  async (req, res) => {
    const input = locationUpdateSchema.parse(req.body),
      userId = req.auth.userId;
    if (!isFreshLocation(input.location.capturedAt))
      throw new HttpError(
        400,
        'STALE_LOCATION',
        'This location is too old or has an invalid device timestamp.',
      );
    const result = await db.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const prior = await tx.locationUpdate.findUnique({
        where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } },
        select: locationSelect,
      });
      if (prior) return prior;
      const active = input.emergencyId
        ? await tx.emergencyEvent.findFirst({
            where: { id: input.emergencyId, userId, status: 'ACTIVE', shareLocation: true },
          })
        : await tx.safetySession.findFirst({
            where: {
              id: input.safetySessionId,
              userId,
              status: { in: ['ACTIVE', 'OVERDUE'] },
              shareLocation: true,
            },
          });
      if (!active)
        throw new HttpError(
          409,
          'SHARING_INACTIVE',
          'Location sharing is not active for this session.',
        );
      return tx.locationUpdate.create({
        data: {
          userId,
          clientRequestId: input.clientRequestId,
          emergencyId: input.emergencyId,
          safetySessionId: input.safetySessionId,
          ...input.location,
        },
        select: locationSelect,
      });
    });
    ok(res, result, 201);
  },
);
locationRouter.delete('/', async (req, res) => {
  const userId = req.auth.userId;
  await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    await tx.emergencyEvent.updateMany({ where: { userId }, data: { shareLocation: false } });
    await tx.safetySession.updateMany({ where: { userId }, data: { shareLocation: false } });
    await tx.shareGrant.deleteMany({ where: { userId } });
    await tx.locationUpdate.deleteMany({ where: { userId } });
  });
  ok(res, { message: 'Stored journey and SOS location history deleted. Sharing stopped.' });
});
export const trackingRouter = Router();
trackingRouter.post('/lookup', limit('tracking', 60, 60000), async (req, res) => {
  const { token } = z.object({ token: opaqueTokenSchema }).strict().parse(req.body);
  const row = await db.shareGrant.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { name: true } },
      emergency: {
        include: {
          locations: { select: locationSelect, orderBy: { capturedAt: 'desc' }, take: 1 },
        },
      },
      safetySession: {
        include: {
          locations: { select: locationSelect, orderBy: { capturedAt: 'desc' }, take: 1 },
        },
      },
    },
  });
  if (!row || row.expiresAt <= new Date())
    throw new HttpError(
      404,
      'LINK_INACTIVE',
      'This sharing link has expired or sharing has stopped.',
    );
  const active = row.emergency
    ? row.emergency.status === 'ACTIVE' && row.emergency.shareLocation
    : row.safetySession &&
      ['ACTIVE', 'OVERDUE'].includes(row.safetySession.status) &&
      row.safetySession.shareLocation;
  if (!active)
    throw new HttpError(
      404,
      'LINK_INACTIVE',
      'This sharing link has expired or sharing has stopped.',
    );
  const source = row.emergency ?? row.safetySession!;
  ok(res, {
    name: row.user.name,
    status: source.status,
    testMode: source.testMode,
    location: source.locations[0] ?? null,
    expiresAt: row.expiresAt,
  });
});
