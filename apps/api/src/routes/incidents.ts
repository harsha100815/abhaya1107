import { Router } from 'express';
import { incidentSchema, evidenceSchema, idSchema, paginationSchema } from '@abhaya/validation';
import { db } from '../db';
import { HttpError, ok } from '../http';
import { incidentView } from '../views';
import { prepareImage } from '../media';
import { decrypt } from '../security';
export const incidentsRouter = Router();
incidentsRouter.get('/', async (req, res) => {
  const { take, cursor } = paginationSchema.parse(req.query);
  ok(
    res,
    (
      await db.incident.findMany({
        where: { userId: req.auth.userId },
        orderBy: { createdAt: 'desc' },
        take,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
    ).map(incidentView),
  );
});
incidentsRouter.get('/:id', async (req, res) =>
  ok(
    res,
    incidentView(
      await db.incident.findFirstOrThrow({
        where: { id: idSchema.parse(req.params.id), userId: req.auth.userId },
      }),
    ),
  ),
);
incidentsRouter.post('/', async (req, res) => {
  const { location, ...input } = incidentSchema.parse(req.body),
    userId = req.auth.userId;
  if (Date.parse(input.occurredAt) > Date.now() + 30000)
    throw new HttpError(400, 'INVALID_TIME', 'The incident time cannot be in the future.');
  const result = await db.incident.upsert({
    where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } },
    create: { userId, ...input, latitude: location?.latitude, longitude: location?.longitude },
    update: {},
  });
  ok(res, incidentView(result), 201);
});
incidentsRouter.put('/:id/evidence', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await db.incident.findFirstOrThrow({ where: { id, userId: req.auth.userId } });
  const input = evidenceSchema.parse(req.body);
  const evidence = await prepareImage(input.base64, input.mimeType);
  await db.incident.update({
    where: { id, userId: req.auth.userId },
    data: { evidence, evidenceMime: 'image/jpeg', evidenceConsentAt: new Date() },
  });
  ok(res, { message: 'Private evidence saved. Embedded image metadata was removed.' });
});
incidentsRouter.get('/:id/evidence', async (req, res) => {
  const row = await db.incident.findFirstOrThrow({
    where: { id: idSchema.parse(req.params.id), userId: req.auth.userId },
  });
  if (!row.evidence) throw new HttpError(404, 'NO_EVIDENCE', 'No image is attached.');
  res.type('image/jpeg').setHeader('Content-Disposition', 'attachment; filename="evidence.jpg"');
  res.send(decrypt(row.evidence));
});
incidentsRouter.delete('/:id', async (req, res) => {
  await db.incident.delete({
    where: { id: idSchema.parse(req.params.id), userId: req.auth.userId },
  });
  ok(res, { message: 'Incident and evidence deleted.' });
});
