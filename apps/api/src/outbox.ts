import type { User, EmergencyContact } from '@prisma/client';
import type { Tx } from './db';
import { env } from './env';
import { encrypt, newToken, hashToken } from './security';

export type AlertPayload = { title: string; body: string };
async function queue(
  tx: Tx,
  data: {
    userId: string;
    dedupeKey: string;
    kind: string;
    channel: string;
    recipient: string;
    recipientLabel: string;
    testMode: boolean;
    emergencyId?: string;
    safetySessionId?: string;
  },
  payload: AlertPayload,
) {
  await tx.notification.create({
    data: { ...data, payload: encrypt(Buffer.from(JSON.stringify(payload))) },
  });
}
export async function queueEmail(
  tx: Tx,
  user: User,
  dedupeKey: string,
  title: string,
  body: string,
) {
  await queue(
    tx,
    {
      userId: user.id,
      dedupeKey,
      kind: 'account',
      channel: 'email',
      recipient: user.email,
      recipientLabel: 'Account email',
      testMode: false,
    },
    { title, body },
  );
}
export async function queueAlerts(
  tx: Tx,
  user: User,
  contacts: EmergencyContact[],
  context: {
    emergencyId?: string;
    safetySessionId?: string;
    testMode: boolean;
    shareLocation: boolean;
    kind: 'sos' | 'overdue';
    round?: number;
  },
) {
  const subjectId = context.emergencyId ?? context.safetySessionId;
  for (const contact of contacts.filter((c) => c.receivesAlerts)) {
    let tracking = '';
    if (context.shareLocation) {
      const token = newToken();
      await tx.shareGrant.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          emergencyId: context.emergencyId,
          safetySessionId: context.safetySessionId,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      const url = new URL('/track', env.PUBLIC_WEB_URL);
      url.hash = `token=${token}`;
      tracking = ` View location while sharing remains active: ${url.toString()}`;
    }
    const prefix = context.testMode ? 'TEST ONLY. ' : '';
    const title =
      context.kind === 'sos' ? 'ABHAYA 1107 · SOS alert' : 'ABHAYA 1107 · Missed check-in';
    const body =
      prefix +
      (context.kind === 'sos'
        ? `${user.name} activated SOS. Please contact them and assess what help is needed.`
        : `${user.name} missed a planned journey check-in. This does not confirm an emergency. Please contact them.`) +
      tracking;
    const channel = !env.SMS_ACCOUNT_SID && contact.email ? 'email' : 'sms';
    const recipient = channel === 'email' ? contact.email! : contact.phone;
    const base = {
      userId: user.id,
      emergencyId: context.emergencyId,
      safetySessionId: context.safetySessionId,
      testMode: context.testMode,
      kind: context.kind,
    };
    await queue(
      tx,
      {
        ...base,
        dedupeKey: `${subjectId}:${context.kind}:${context.round ?? 0}:${contact.id}:${channel}`,
        channel,
        recipient,
        recipientLabel: contact.name,
      },
      { title, body },
    );
    if (contact.email) {
      const recipientUser = await tx.user.findFirst({
        where: { email: contact.email, emailVerifiedAt: { not: null }, pushEnabled: true },
        include: { devices: true },
      });
      for (const device of recipientUser?.devices ?? [])
        await queue(
          tx,
          {
            ...base,
            dedupeKey: `${subjectId}:${context.kind}:${context.round ?? 0}:${device.id}`,
            channel: 'push',
            recipient: device.token,
            recipientLabel: contact.name,
          },
          { title, body },
        );
    }
  }
}
