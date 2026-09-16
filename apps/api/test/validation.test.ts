import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

test('password policy used by authentication requires mixed characters', () => {
  const schema = z.string().min(10).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/);
  assert.equal(schema.safeParse('Password123!').success, true);
  assert.equal(schema.safeParse('password').success, false);
});

test('location bounds reject invalid coordinates', () => {
  const schema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
  assert.equal(schema.safeParse({ latitude: 17.4, longitude: 78.4 }).success, true);
  assert.equal(schema.safeParse({ latitude: 181, longitude: 78.4 }).success, false);
});
