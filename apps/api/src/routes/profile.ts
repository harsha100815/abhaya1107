import { Router } from 'express';
import { z } from 'zod';
import { profileSchema, evidenceSchema, deviceSchema } from '@abhaya/validation';
import { db, lockUser } from '../db';
import { HttpError, ok, limit } from '../http';
import {
  userView,
  contactSelect,
  eventSelect,
  journeySelect,
  incidentView,
  deliverySelect,
} from '../views';
import { verifyPassword, decrypt } from '../security';
import { prepareImage } from '../media';
export const profileRouter = Router();
profileRouter.get('/', async (req, res) =>
  ok(res, userView(await db.user.findUniqueOrThrow({ where: { id: req.auth.userId } }))),
);
profileRouter.patch('/', async (req, res) =>
  ok(
    res,
    userView(
      await db.user.update({ where: { id: req.auth.userId }, data: profileSchema.parse(req.body) }),
    ),
  ),
);
profileRouter.put('/avatar', async (req, res) => {
  const input = evidenceSchema.parse(req.body);
  const avatar = await prepareImage(input.base64, input.mimeType, true);
  await db.user.update({
    where: { id: req.auth.userId },
    data: { avatar, avatarMime: 'image/jpeg' },
  });
  ok(res, { message: 'Profile image saved.' });
});
profileRouter.get('/avatar', async (req, res) => {
  const u = await db.user.findUniqueOrThrow({ where: { id: req.auth.userId } });
  if (!u.avatar) throw new HttpError(404, 'NO_AVATAR', 'No profile image.');
  res.type('image/jpeg').send(decrypt(u.avatar));
});
profileRouter.delete('/avatar', async (req, res) => {
  await db.user.update({
    where: { id: req.auth.userId },
    data: { avatar: null, avatarMime: null },
  });
  ok(res, { message: 'Profile image removed.' });
});
profileRouter.delete(
  '/',
  limit('delete-account', 5, 15 * 60000, (r) => r.auth.userId),
  async (req, res) => {
    const input = z
      .object({ password: z.string().min(1).max(256), confirmation: z.literal('DELETE') })
      .strict()
      .parse(req.body);
    await db.$transaction(async (tx) => {
      await lockUser(tx, req.auth.userId);
      const u = await tx.user.findUniqueOrThrow({ where: { id: req.auth.userId } });
      if (!(await verifyPassword(input.password, u.passwordHash)))
        throw new HttpError(401, 'INVALID_PASSWORD', 'Password is incorrect.');
      await tx.user.delete({ where: { id: u.id } });
    });
    ok(res, { message: 'Account and associated data deleted.' });
  },
);
export const dashboardRouter = Router();
dashboardRouter.get('/', async (req, res) => {
  const userId = req.auth.userId;
  const [user, contacts, emergencies, journeys, incidents] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    db.emergencyContact.findMany({
      where: { userId },
      select: contactSelect,
      orderBy: { isPrimary: 'desc' },
    }),
    db.emergencyEvent.findMany({
      where: { userId },
      select: eventSelect,
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.safetySession.findMany({
      where: { userId },
      select: journeySelect,
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.incident.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  ok(res, {
    user: userView(user),
    contacts,
    emergencies,
    journeys,
    incidents: incidents.map(incidentView),
  });
});
export const notificationsRouter = Router();
notificationsRouter.get('/', async (req, res) =>
  ok(
    res,
    await db.notification.findMany({
      where: { userId: req.auth.userId },
      select: deliverySelect,
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ),
);
notificationsRouter.post('/devices', async (req, res) => {
  const input = deviceSchema.parse(req.body);
  await db.device.upsert({
    where: { token: input.token },
    create: { userId: req.auth.userId, ...input },
    update: { userId: req.auth.userId, platform: input.platform },
  });
  ok(res, { message: 'Push notification device registered.' });
});
notificationsRouter.delete('/devices', async (req, res) => {
  const { token } = deviceSchema.pick({ token: true }).parse(req.body);
  await db.device.deleteMany({ where: { userId: req.auth.userId, token } });
  ok(res, { message: 'Device unregistered.' });
});
