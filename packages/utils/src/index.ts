export const ACTIVE_JOURNEY = ['ACTIVE', 'OVERDUE'] as const;
export function isFreshLocation(capturedAt: string, now = Date.now()): boolean {
  const at = Date.parse(capturedAt);
  return Number.isFinite(at) && at <= now + 30000 && now - at <= 120000;
}
export function validArrival(expectedAt: string, now = Date.now()): boolean {
  const delta = Date.parse(expectedAt) - now;
  return delta >= 60000 && delta <= 86400000;
}
export function isOverdue(expectedAt: Date, status: string, now = new Date()): boolean {
  return status === 'ACTIVE' && expectedAt.getTime() <= now.getTime();
}
export type SosPhase = 'idle' | 'countdown' | 'sending' | 'active' | 'unconfirmed';
export type SosAction =
  'hold' | 'cancel' | 'elapsed' | 'acknowledged' | 'failed' | 'resolved' | 'retry';
export function sosTransition(state: SosPhase, action: SosAction): SosPhase {
  if (state === 'idle' && action === 'hold') return 'countdown';
  if (state === 'countdown' && action === 'cancel') return 'idle';
  if (state === 'countdown' && action === 'elapsed') return 'sending';
  if (state === 'sending' && action === 'acknowledged') return 'active';
  if (state === 'sending' && action === 'failed') return 'unconfirmed';
  if (state === 'unconfirmed' && action === 'retry') return 'sending';
  if (state === 'active' && action === 'resolved') return 'idle';
  return state;
}
export function permissionMessage(
  status: 'granted' | 'denied' | 'undetermined',
  serviceEnabled: boolean,
): string {
  if (!serviceEnabled) return 'Location services are off. Turn on GPS in device settings.';
  if (status === 'denied')
    return 'Location permission is off. SOS is still available without coordinates.';
  if (status === 'undetermined')
    return 'Choose whether to share your location during SOS and journeys.';
  return 'Location available. Sharing starts only when you choose it.';
}
export function deliveryLabel(status: string): string {
  const labels: Record<string, string> = {
    QUEUED: 'Queued',
    PROCESSING: 'Sending',
    ACCEPTED: 'Provider accepted · delivery unconfirmed',
    DELIVERED: 'Provider reports delivered',
    FAILED: 'Not delivered',
    UNKNOWN: 'Delivery unknown · check directly',
    TEST: 'Simulated · no message sent',
    CANCELLED: 'Cancelled before sending',
    UNCONFIGURED: 'No provider configured',
  };
  return labels[status] ?? 'Delivery unconfirmed';
}
