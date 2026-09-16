import { AppError } from '../errors.js';
import type { EmergencyState } from '../types.js';

const allowed: Record<EmergencyState, EmergencyState[]> = {
  CREATED: ['COUNTDOWN', 'ACTIVE', 'CANCELLED'],
  COUNTDOWN: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ACKNOWLEDGED', 'RESOLVED', 'CANCELLED'],
  ACKNOWLEDGED: ['RESOLVED', 'CANCELLED', 'ACTIVE'],
  RESOLVED: [],
  CANCELLED: [],
};

export function assertEmergencyTransition(from: EmergencyState, to: EmergencyState) {
  if (from === to) return true;
  if (!allowed[from].includes(to)) throw new AppError(409, 'INVALID_EMERGENCY_TRANSITION', `Cannot move an emergency from ${from} to ${to}.`);
  return true;
}

export function isActiveEmergency(status: EmergencyState) { return ['CREATED', 'COUNTDOWN', 'ACTIVE', 'ACKNOWLEDGED'].includes(status); }
