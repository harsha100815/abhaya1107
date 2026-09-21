import { Router } from 'express';
import { contactSchema, idSchema } from '@abhaya/validation';
import { db, lockUser } from '../db';
import { HttpError, ok } from '../http';
import { contactSelect } from '../views';
export const contactsRouter = Router();
contactsRouter.get('/', async (req, res) =>
  ok(
    res,
    await db.emergencyContact.findMany({
      where: { userId: req.auth.userId },
      select: contactSelect,
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    }),
  ),
);
contactsRouter.post('/', async (req, res) => {
  const { consentConfirmed: _consent, ...input } = contactSchema.parse(req.body);
  const userId = req.auth.userId;
  const result = await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    if ((await tx.emergencyContact.count({ where: { userId } })) >= 10)
      throw new HttpError(400, 'CONTACT_LIMIT', 'You can add up to 10 trusted contacts.');
    if (input.isPrimary)
      await tx.emergencyContact.updateMany({ where: { userId }, data: { isPrimary: false } });
    return tx.emergencyContact.create({ data: { userId, ...input }, select: contactSelect });
  });
  ok(res, result, 201);
});
contactsRouter.patch('/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const { consentConfirmed: _consent, ...input } = contactSchema.parse(req.body);
  const userId = req.auth.userId;
  const result = await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    await tx.emergencyContact.findFirstOrThrow({ where: { id, userId } });
    if (input.isPrimary)
      await tx.emergencyContact.updateMany({ where: { userId }, data: { isPrimary: false } });
    return tx.emergencyContact.update({
      where: { id, userId },
      data: { ...input, consentAt: new Date() },
      select: contactSelect,
    });
  });
  ok(res, result);
});
contactsRouter.delete('/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const userId = req.auth.userId;
  await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    if (
      await tx.safetySession.count({
        where: { userId, contactId: id, status: { in: ['ACTIVE', 'OVERDUE'] } },
      })
    )
      throw new HttpError(
        409,
        'CONTACT_IN_USE',
        'Complete or cancel the active journey before removing this contact.',
      );
    await tx.emergencyContact.delete({ where: { id, userId } });
  });
  ok(res, { message: 'Contact removed.' });
});
