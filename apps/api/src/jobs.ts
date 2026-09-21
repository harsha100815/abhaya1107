import { db, lockUser } from './db';
import { env } from './env';
import { queueAlerts } from './outbox';
import { deliver, receipt } from './providers';

export async function escalateJourneys(now = new Date()) {
  const due = await db.safetySession.findMany({
    where: { status: 'ACTIVE', expectedAt: { lte: now } },
    select: { id: true, userId: true },
    take: 100,
  });
  for (const item of due)
    await db.$transaction(async (tx) => {
      await lockUser(tx, item.userId);
      const journey = await tx.safetySession.findUnique({
        where: { id: item.id },
        include: { user: true, contact: true },
      });
      if (!journey || journey.status !== 'ACTIVE' || journey.expectedAt > now) return;
      await tx.safetySession.update({
        where: { id: journey.id },
        data: { status: 'OVERDUE', escalationCount: { increment: 1 } },
      });
      if (journey.contact)
        await queueAlerts(tx, journey.user, [journey.contact], {
          safetySessionId: journey.id,
          testMode: journey.testMode,
          shareLocation: journey.shareLocation,
          kind: 'overdue',
          round: journey.escalationCount,
        });
    });
  return due.length;
}
export async function processOutbox() {
  // A crashed send has an ambiguous outcome. Never blindly repeat an SMS.
  await db.notification.updateMany({
    where: { status: 'PROCESSING', leaseUntil: { lt: new Date() } },
    data: { status: 'UNKNOWN', errorCode: 'WORKER_INTERRUPTED', leaseUntil: null },
  });
  for (let i = 0; i < 50; i++) {
    const job = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "Notification" WHERE "status"='QUEUED' AND "nextAttemptAt"<=${new Date()} ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      return tx.notification.update({
        where: { id: rows[0].id },
        data: {
          status: 'PROCESSING',
          leaseUntil: new Date(Date.now() + 30000),
          attempts: { increment: 1 },
        },
      });
    });
    if (!job) break;
    const stillValid = await db.notification.findUnique({
      where: { id: job.id },
      include: { emergency: true, safetySession: true },
    });
    if (!stillValid) continue;
    if (
      stillValid.status !== 'PROCESSING' ||
      (stillValid.emergency && stillValid.emergency.status !== 'ACTIVE') ||
      (stillValid.safetySession && stillValid.safetySession.status !== 'OVERDUE')
    ) {
      await db.notification.updateMany({
        where: { id: job.id, status: 'PROCESSING' },
        data: { status: 'CANCELLED', leaseUntil: null },
      });
      continue;
    }
    const result = await deliver(job);
    await db.notification.updateMany({
      where: { id: job.id, status: 'PROCESSING' },
      data: { ...result, leaseUntil: null, nextAttemptAt: new Date(Date.now() + 60000) },
    });
  }
  const pending = await db.notification.findMany({
    where: {
      status: 'ACCEPTED',
      nextAttemptAt: { lte: new Date() },
      createdAt: { gt: new Date(Date.now() - 86400000) },
    },
    take: 50,
  });
  for (const job of pending) {
    const result = await receipt(job);
    await db.notification.updateMany({
      where: { id: job.id, status: 'ACCEPTED' },
      data: { ...result, nextAttemptAt: new Date(Date.now() + 60000) },
    });
  }
}
export async function purgeExpiredData() {
  await db.locationUpdate.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - env.LOCATION_RETENTION_DAYS * 86400000) } },
  });
  await db.rateBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.shareGrant.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.actionToken.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 86400000) } },
  });
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400000) } } });
  await db.notification.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 30 * 86400000) } },
  });
}
