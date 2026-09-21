import { describe, it, expect } from 'vitest';
import {
  isFreshLocation,
  isOverdue,
  validArrival,
  sosTransition,
  permissionMessage,
  deliveryLabel,
} from './index';
describe('safety invariants', () => {
  it('never marks a failed SOS active', () => {
    expect(sosTransition('idle', 'acknowledged')).toBe('idle');
    expect(sosTransition('sending', 'failed')).toBe('unconfirmed');
    expect(sosTransition('sending', 'acknowledged')).toBe('active');
  });
  it('allows cancellation only before transmission', () => {
    expect(sosTransition('countdown', 'cancel')).toBe('idle');
    expect(sosTransition('sending', 'cancel')).toBe('sending');
  });
  it('rejects stale or future coordinates', () => {
    expect(isFreshLocation(new Date(0).toISOString(), 130000)).toBe(false);
    expect(isFreshLocation(new Date(90000).toISOString(), 0)).toBe(false);
    expect(isFreshLocation(new Date(1000).toISOString(), 2000)).toBe(true);
  });
  it('only escalates active, expired journeys', () => {
    expect(isOverdue(new Date(1000), 'ACTIVE', new Date(2000))).toBe(true);
    expect(isOverdue(new Date(1000), 'COMPLETED', new Date(2000))).toBe(false);
    expect(validArrival(new Date(25000).toISOString(), 0)).toBe(false);
  });
  it('permission denial retains SOS access', () =>
    expect(permissionMessage('denied', true)).toContain('SOS is still available'));
  it('provider acceptance is not delivery', () =>
    expect(deliveryLabel('ACCEPTED')).toContain('unconfirmed'));
});
