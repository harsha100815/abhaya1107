import { describe, it, expect } from 'vitest';
import {
  contactSchema,
  locationSchema,
  passwordSchema,
  sosSchema,
  locationUpdateSchema,
} from './index';
const id = '802c183b-9ce6-4c5e-8357-14d4e64778fd';
const point = {
  latitude: 17.4,
  longitude: 78.4,
  accuracy: 12,
  capturedAt: new Date().toISOString(),
};
describe('input boundaries', () => {
  it('requires contact consent and international telephone numbers', () => {
    expect(
      contactSchema.safeParse({ name: 'Friend', phone: '9876543210', consentConfirmed: true })
        .success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({ name: 'Friend', phone: '+919876543210', consentConfirmed: false })
        .success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({ name: 'Friend', phone: '+919876543210', consentConfirmed: true })
        .success,
    ).toBe(true);
  });
  it('rejects invalid coordinates and nonfinite accuracy', () => {
    expect(locationSchema.safeParse({ ...point, latitude: 91 }).success).toBe(false);
    expect(locationSchema.safeParse({ ...point, accuracy: NaN }).success).toBe(false);
  });
  it('does not accept location without sharing consent', () =>
    expect(
      sosSchema.safeParse({
        clientRequestId: id,
        testMode: true,
        shareLocation: false,
        location: point,
      }).success,
    ).toBe(false));
  it('requires exactly one location subject', () => {
    expect(locationUpdateSchema.safeParse({ clientRequestId: id, location: point }).success).toBe(
      false,
    );
    expect(
      locationUpdateSchema.safeParse({
        clientRequestId: id,
        emergencyId: id,
        safetySessionId: id,
        location: point,
      }).success,
    ).toBe(false);
  });
  it('rejects passwords beyond bcrypt byte limit', () => {
    expect(passwordSchema.safeParse('😀'.repeat(20)).success).toBe(false);
    expect(passwordSchema.safeParse('a long unique password').success).toBe(true);
  });
});
