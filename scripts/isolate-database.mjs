import { randomBytes } from 'node:crypto';
import { copyFileSync, chmodSync, constants, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { parseEnv } from 'node:util';

// Explicit development recovery: a separate Compose project/volume, never a reset.
const rootPath = '.env';
const apiPath = 'apps/api/.env';
const rootText = readFileSync(rootPath, 'utf8');
const apiText = readFileSync(apiPath, 'utf8');
const root = parseEnv(rootText);
const api = parseEnv(apiText);
if (
  process.env.NODE_ENV === 'production' ||
  api.NODE_ENV === 'production' ||
  api.TEST_MODE_ONLY !== 'true'
)
  throw new Error('Database isolation is available only for a local TEST environment.');
const overridden = [
  'DATABASE_URL',
  'COMPOSE_PROJECT_NAME',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
].filter((key) => process.env[key] !== undefined);
if (overridden.length)
  throw new Error(
    `Shell variables override local configuration. Unset these before retrying: ${overridden.join(', ')}. Values have not been printed.`,
  );
const url = new URL(api.DATABASE_URL);
if (
  !['postgres:', 'postgresql:'].includes(url.protocol) ||
  !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
)
  throw new Error('This command only updates an existing local PostgreSQL configuration.');
if (!root.POSTGRES_USER || !root.POSTGRES_PASSWORD || !root.POSTGRES_DB)
  throw new Error('Missing local PostgreSQL settings. Run npm run setup first.');
if (root.ABHAYA_ISOLATED_DATABASE === 'true') {
  console.log('This checkout already has an isolated database configuration. No files changed.');
  console.log('Run docker compose up -d --wait postgres, then npm run db:deploy.');
  process.exit(0);
}
const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    probe.close((error) => (error ? reject(error) : resolve(address.port)));
  });
});
const suffix = randomBytes(6).toString('hex');
const project = `abhaya1107-local-${suffix}`;
url.hostname = '127.0.0.1';
url.port = String(port);
url.username = root.POSTGRES_USER;
url.password = root.POSTGRES_PASSWORD;
url.pathname = `/${encodeURIComponent(root.POSTGRES_DB)}`;
url.search = '';
url.hash = '';
function setValue(text, key, value) {
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, 'gm');
  return pattern.test(text) ? text.replace(pattern, () => line) : `${text.trimEnd()}\n${line}\n`;
}
let nextRoot = setValue(rootText, 'POSTGRES_PORT', String(port));
nextRoot = setValue(nextRoot, 'COMPOSE_PROJECT_NAME', project);
nextRoot = setValue(nextRoot, 'ABHAYA_ISOLATED_DATABASE', 'true');
const nextApi = setValue(apiText, 'DATABASE_URL', url.toString());
for (const path of [rootPath, apiPath]) {
  const backup = `${path}.backup-${suffix}`;
  copyFileSync(path, backup, constants.COPYFILE_EXCL);
  chmodSync(backup, 0o600);
}
try {
  writeFileSync(rootPath, nextRoot, { mode: 0o600 });
  writeFileSync(apiPath, nextApi, { mode: 0o600 });
} catch (error) {
  copyFileSync(`${rootPath}.backup-${suffix}`, rootPath);
  copyFileSync(`${apiPath}.backup-${suffix}`, apiPath);
  throw error;
}
console.log(
  `Configured ${project} on local port ${port}. Existing containers and database volumes were not changed.`,
);
console.log('This creates a separate empty development database; previous data is not imported.');
console.log('Original environment files were backed up beside each file (ignored by Git).');
console.log(
  'Next: docker compose up -d --wait postgres, then npm run db:deploy, then npm run dev.',
);
