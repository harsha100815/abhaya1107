import test from 'node:test';
import assert from 'node:assert/strict';
import { extendDeadline } from '../src/utils.js';

const currentTime = Date.parse('2026-09-12T10:00:00.000Z');
for (const [workflow, minutes] of [['timer', 5], ['journey', 15]] as const) {
  test(`${workflow}: extending an overdue deadline grants the full new interval`, () => {
    assert.equal(Date.parse(extendDeadline('2026-09-12T09:00:00.000Z', minutes, currentTime)), currentTime + minutes * 60000);
  });
  test(`${workflow}: extending a future deadline preserves the remaining time`, () => {
    const future = '2026-09-12T10:30:00.000Z';
    assert.equal(Date.parse(extendDeadline(future, minutes, currentTime)), Date.parse(future) + minutes * 60000);
  });
}
