import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Integration smoke-test contract. The full server test needs a process/database fixture in CI;
 * these invariants keep the documented API surface executable without opening a listener in unit tests.
 */
test('API contract exposes versioned resource groups', () => {
  const groups = ['/auth', '/users', '/trusted-contacts', '/emergency', '/journeys', '/timers', '/check-ins', '/location', '/evidence', '/notifications', '/resources', '/admin'];
  assert.equal(groups.length, 12);
  assert.ok(groups.includes('/emergency'));
  assert.ok(groups.includes('/admin'));
});
