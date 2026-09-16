import test from 'node:test';
import assert from 'node:assert/strict';
import { hashToken, randomToken, distanceKm } from '../src/utils.js';
import { assertEmergencyTransition, isActiveEmergency } from '../src/domain/state.js';

test('public tokens are high entropy and only hashes are deterministic', () => {
  const token = randomToken(32);
  assert.ok(token.length > 30);
  assert.equal(hashToken(token), hashToken(token));
  assert.notEqual(hashToken(token), token);
});

test('emergency state machine rejects terminal state reactivation', () => {
  assert.equal(assertEmergencyTransition('CREATED', 'COUNTDOWN'), true);
  assert.equal(assertEmergencyTransition('ACTIVE', 'ACKNOWLEDGED'), true);
  assert.throws(() => assertEmergencyTransition('RESOLVED', 'ACTIVE'), /Cannot move/);
  assert.equal(isActiveEmergency('ACKNOWLEDGED'), true);
  assert.equal(isActiveEmergency('RESOLVED'), false);
});

test('distance calculation is geographic and bounded', () => {
  const distance = distanceKm({ latitude: 17.385, longitude: 78.4867 }, { latitude: 17.4239, longitude: 78.4071 });
  assert.ok(distance > 8 && distance < 12);
});
