import { AppError, notFound } from './errors.js';
import { hashToken, now } from './utils.js';
import type { JsonStore } from './db/store.js';

export function publicShare(store: JsonStore, token: string) {
  const link = store.data.shareLinks.find((item) => item.tokenHash === hashToken(token) && !item.revokedAt && item.expiresAt > now());
  if (!link) throw new AppError(410, 'LINK_EXPIRED', 'This safety link has expired or been revoked.');
  const user = store.data.users.find((item) => item.id === link.ownerId);
  if (!user) throw notFound('Safety link owner not found.');
  const emergency = link.emergencyId ? store.data.emergencies.find((item) => item.id === link.emergencyId) : undefined;
  const journey = link.journeyId ? store.data.journeys.find((item) => item.id === link.journeyId) : undefined;
  return { firstName: user.fullName.split(' ')[0], status: emergency?.status ?? journey?.status ?? 'UNKNOWN', lastKnownLocation: emergency?.location ?? journey?.lastLocation, timestamp: emergency?.lastLocationAt ?? journey?.lastLocation?.timestamp ?? link.createdAt, expiresAt: link.expiresAt, safe: emergency?.status === 'RESOLVED' || journey?.status === 'COMPLETED' };
}
