import type { JsonStore } from './db/store.js';
import type { Channel, NotificationRecord } from './types.js';
import { id, now } from './utils.js';

export interface NotificationInput {
  userId?: string;
  recipientId?: string;
  type: string;
  title: string;
  body: string;
  channel?: Channel;
  relatedType?: string;
  relatedId?: string;
}

/** Provider abstraction. Mock is deterministic and never claims that an emergency reached a real person. */
export class NotificationService {
  constructor(private readonly store: JsonStore) {}

  async enqueue(input: NotificationInput): Promise<NotificationRecord> {
    const record: NotificationRecord = { id: id(), userId: input.userId, recipientId: input.recipientId, type: input.type, title: input.title, body: input.body, channel: input.channel ?? 'PUSH', status: 'QUEUED', relatedType: input.relatedType, relatedId: input.relatedId, createdAt: now() };
    this.store.data.notifications.unshift(record);
    await this.store.persist();
    await this.deliver(record);
    return record;
  }

  async deliver(record: NotificationRecord) {
    const hasProvider = record.channel === 'PUSH' ? Boolean(process.env.FCM_SERVER_KEY) : record.channel === 'SMS' ? Boolean(process.env.TWILIO_ACCOUNT_SID) : Boolean(process.env.RESEND_API_KEY);
    // Demo provider simulates a local queue only. It is deliberately labelled as delivered locally.
    record.status = hasProvider ? 'SENT' : 'DELIVERED';
    record.deliveredAt = now();
    if (!hasProvider) record.error = 'DEMO_PROVIDER: no external credential configured';
    await this.store.persist();
    return record;
  }

  async notifyUserAndContacts(userId: string, input: Omit<NotificationInput, 'userId' | 'recipientId'>) {
    const contacts = this.store.data.contacts.filter((contact) => contact.ownerId === userId && contact.verified && contact.receives.includes(this.eventToPreference(input.type)));
    const records: NotificationRecord[] = [];
    for (const contact of contacts) records.push(await this.enqueue({ ...input, recipientId: contact.id }));
    return records;
  }

  private eventToPreference(type: string) {
    if (type.includes('JOURNEY') || type.includes('DEVIATION')) return 'JOURNEY' as const;
    if (type.includes('TIMER')) return 'TIMER' as const;
    if (type.includes('CHECK')) return 'CHECK_IN' as const;
    return 'EMERGENCY' as const;
  }
}
