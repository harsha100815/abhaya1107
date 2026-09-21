const hints: Record<string, string> = {
  P1000:
    'Database authentication failed. Check the API database credentials against the running PostgreSQL instance.',
  P1001:
    'Cannot reach PostgreSQL. Check that the database is running and the configured host and port are correct.',
  P1003: 'The configured database does not exist. Check the database name and PostgreSQL setup.',
  P1010: 'The database user lacks access. Check its permissions on the configured database.',
  P2021:
    'An application table is missing. Run npm run db:status and npm run db:deploy from the repository root.',
  P2022: 'An application column is missing. Check pending migrations with npm run db:status.',
  '28P01':
    'PostgreSQL rejected the password. Check the API credentials against the running database.',
  '3D000': 'The configured PostgreSQL database does not exist.',
  '42P01':
    'An application table is missing. Run npm run db:status and npm run db:deploy from the repository root.',
  '42703': 'An application column is missing. Check pending migrations with npm run db:status.',
  '42501': 'The database user lacks permission for this operation.',
  ECONNREFUSED: 'Cannot reach PostgreSQL. Check the running database and configured host and port.',
};

/** Keep query text, values, connection strings, messages and stacks out of logs. */
export function safeErrorDetails(error: unknown) {
  const details: { errorType: string; errorCode?: string; databaseCode?: string; hint?: string } = {
    errorType: error instanceof Error ? error.name : 'unknown',
  };
  if (typeof error !== 'object' || error === null) return details;
  const record = error as Record<string, unknown>;
  const code = record.code ?? record.errorCode;
  if (typeof code === 'string' && (/^P\d{4}$/.test(code) || Object.hasOwn(hints, code)))
    details.errorCode = code;
  if (typeof record.meta === 'object' && record.meta !== null) {
    const databaseCode = (record.meta as Record<string, unknown>).code;
    if (typeof databaseCode === 'string' && /^[0-9A-Z]{5}$/.test(databaseCode))
      details.databaseCode = databaseCode;
  }
  const hint = hints[details.databaseCode ?? ''] ?? hints[details.errorCode ?? ''];
  if (hint) details.hint = hint;
  return details;
}
