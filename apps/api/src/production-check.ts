import { ZodError } from 'zod';
import { parseEnv } from './config';

try {
  if (process.env.NODE_ENV !== 'production')
    throw new Error('Production preflight requires NODE_ENV=production');
  parseEnv(process.env);
  console.log('Production configuration passed. Provider delivery still needs live verification.');
} catch (error) {
  // Report field names and static validation messages, never credential values.
  const message =
    error instanceof ZodError
      ? `Invalid production fields: ${[...new Set(error.issues.map((issue) => issue.path.join('.')))].join(', ')}`
      : error instanceof Error
        ? error.message
        : 'Invalid production configuration';
  console.error(`Production preflight failed: ${message}`);
  process.exitCode = 1;
}
