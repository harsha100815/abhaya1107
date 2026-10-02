import { z } from 'zod';
import type { Notification, DeliveryStatus } from '@prisma/client';
import { env } from './env';
import { decrypt } from './security';
export type DeliveryResult = { status: DeliveryStatus; providerId?: string; errorCode?: string };
const payloadSchema = z.object({ title: z.string(), body: z.string() });
class ProviderHttpError extends Error {
  constructor(public status: number) {
    super(`provider_http_${status}`);
  }
}
async function request(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new ProviderHttpError(response.status);
  return response.json();
}
export async function deliver(job: Notification): Promise<DeliveryResult> {
  if (job.testMode) {
    if (env.NODE_ENV === 'production') return { status: 'FAILED', errorCode: 'TEST_DISABLED' };
    return { status: 'TEST' };
  }
  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(JSON.parse(decrypt(job.payload).toString('utf8')));
  } catch {
    // One corrupt row must not interrupt delivery of other queued alerts.
    return { status: 'FAILED', errorCode: 'INVALID_NOTIFICATION_PAYLOAD' };
  }
  try {
    if (job.channel === 'sms') {
      if (!env.SMS_ACCOUNT_SID || !env.SMS_AUTH_TOKEN || !env.SMS_FROM)
        return { status: 'UNCONFIGURED', errorCode: 'SMS_UNCONFIGURED' };
      const raw = await request(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.SMS_ACCOUNT_SID)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${env.SMS_ACCOUNT_SID}:${env.SMS_AUTH_TOKEN}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: job.recipient,
            From: env.SMS_FROM,
            Body: payload.body,
          }).toString(),
        },
      );
      const result = z.object({ sid: z.string(), status: z.string() }).parse(raw);
      return {
        status:
          result.status === 'delivered'
            ? 'DELIVERED'
            : ['failed', 'undelivered'].includes(result.status)
              ? 'FAILED'
              : 'ACCEPTED',
        providerId: result.sid,
      };
    }
    if (job.channel === 'email') {
      if (!env.EMAIL_API_KEY || !env.EMAIL_FROM)
        return { status: 'UNCONFIGURED', errorCode: 'EMAIL_UNCONFIGURED' };
      const raw = await request('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.EMAIL_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': job.id,
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [job.recipient],
          subject: payload.title,
          text: payload.body,
        }),
      });
      const result = z.object({ id: z.string() }).parse(raw);
      return { status: 'ACCEPTED', providerId: result.id };
    }
    if (job.channel === 'push') {
      if (!env.EXPO_ACCESS_TOKEN) return { status: 'UNCONFIGURED', errorCode: 'PUSH_UNCONFIGURED' };
      const raw = await request('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: job.recipient,
          title: payload.title,
          body: 'A trusted contact sent a safety update. Open ABHAYA for details.',
          data: { title: payload.title, message: payload.body },
          sound: 'default',
        }),
      });
      const result = z
        .object({ data: z.object({ status: z.string(), id: z.string().optional() }) })
        .parse(raw);
      return result.data.status === 'ok'
        ? { status: 'ACCEPTED', providerId: result.data.id }
        : { status: 'FAILED', errorCode: 'PUSH_REJECTED' };
    }
    return { status: 'FAILED', errorCode: 'UNKNOWN_CHANNEL' };
  } catch (error) {
    if (
      error instanceof ProviderHttpError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 408
    )
      return { status: 'FAILED', errorCode: `PROVIDER_HTTP_${error.status}` };
    return { status: 'UNKNOWN', errorCode: 'PROVIDER_UNCONFIRMED' };
  }
}
export async function receipt(job: Notification): Promise<DeliveryResult | null> {
  if (!job.providerId) return null;
  try {
    if (job.channel === 'sms' && env.SMS_ACCOUNT_SID && env.SMS_AUTH_TOKEN) {
      const raw = await request(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.SMS_ACCOUNT_SID)}/Messages/${encodeURIComponent(job.providerId)}.json`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${env.SMS_ACCOUNT_SID}:${env.SMS_AUTH_TOKEN}`).toString('base64')}`,
          },
        },
      );
      const result = z.object({ status: z.string() }).parse(raw);
      if (result.status === 'delivered') return { status: 'DELIVERED' };
      if (['undelivered', 'failed', 'canceled'].includes(result.status))
        return { status: 'FAILED', errorCode: 'SMS_UNDELIVERED' };
    }
    if (job.channel === 'email' && env.EMAIL_API_KEY) {
      const raw = await request(
        `https://api.resend.com/emails/${encodeURIComponent(job.providerId)}`,
        { headers: { Authorization: `Bearer ${env.EMAIL_API_KEY}` } },
      );
      const result = z.object({ last_event: z.string() }).parse(raw);
      if (result.last_event === 'delivered') return { status: 'DELIVERED' };
      if (['bounced', 'failed', 'complained', 'canceled', 'suppressed'].includes(result.last_event))
        return { status: 'FAILED', errorCode: 'EMAIL_UNDELIVERED' };
    }
    if (job.channel === 'push' && env.EXPO_ACCESS_TOKEN) {
      const raw = await request('https://exp.host/--/api/v2/push/getReceipts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: [job.providerId] }),
      });
      const result = z
        .object({
          data: z.record(
            z.object({
              status: z.string(),
              details: z.object({ error: z.string().optional() }).optional(),
            }),
          ),
        })
        .parse(raw);
      if (result.data[job.providerId]?.status === 'error')
        return { status: 'FAILED', errorCode: 'PUSH_UNDELIVERED' };
      // A successful Expo receipt confirms handoff to APNs/FCM, not delivery to a device.
    }
    return null;
  } catch {
    return null;
  }
}
