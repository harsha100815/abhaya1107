import { describe, expect, it } from 'vitest';
import { safeErrorDetails } from './diagnostics';

describe('safe database diagnostics', () => {
  it('provides the missing-table code without logging the query or private values', () => {
    const error = Object.assign(new Error('private-user-value'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2021',
      meta: { modelName: 'User', query: 'private-query-value' },
    });
    const details = safeErrorDetails(error);
    expect(details.errorCode).toBe('P2021');
    expect(details.hint).toContain('npm run db:deploy');
    expect(JSON.stringify(details)).not.toContain('private-');
  });

  it('identifies raw-query PostgreSQL errors without including provider messages', () => {
    const error = Object.assign(new Error('private connection string'), {
      code: 'P2010',
      meta: { code: '42P01', message: 'private database detail' },
    });
    expect(safeErrorDetails(error)).toMatchObject({
      errorCode: 'P2010',
      databaseCode: '42P01',
      hint: expect.stringContaining('db:status'),
    });
    expect(JSON.stringify(safeErrorDetails(error))).not.toContain('private');
  });

  it('identifies authentication failures and omits unknown payloads', () => {
    expect(safeErrorDetails({ errorCode: 'P1000' }).hint).toContain('authentication failed');
    expect(safeErrorDetails({ code: 'secret-token', message: 'secret-password' })).toEqual({
      errorType: 'unknown',
    });
    expect(safeErrorDetails(null)).toEqual({ errorType: 'unknown' });
  });
});
