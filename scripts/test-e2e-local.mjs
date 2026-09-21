import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import chromium from '@sparticuz/chromium';
const database = await PGlite.create();
const server = new PGLiteSocketServer({
  db: database,
  port: 5435,
  host: '127.0.0.1',
  maxConnections: 30,
});
await server.start();
mkdirSync('docs/screenshots', { recursive: true });
mkdirSync('.cache', { recursive: true });
const env = {
  ...process.env,
  NODE_ENV: 'development',
  DB_POOL_MAX: '1',
  DATABASE_URL: 'postgresql://postgres@127.0.0.1:5435/abhaya_e2e_test',
  PORT: '4002',
  JWT_SECRET: randomBytes(48).toString('hex'),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  PUBLIC_WEB_URL: 'http://localhost:3000',
  CORS_ORIGINS: 'http://localhost:3000',
  WEB_ORIGIN: 'http://localhost:3000',
  TEST_MODE_ONLY: 'true',
  LOG_LEVEL: 'silent',
  API_URL: 'http://127.0.0.1:4002/api/v1',
  NEXT_TELEMETRY_DISABLED: '1',
  PLAYWRIGHT_CHROMIUM_EXECUTABLE:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? (await chromium.executablePath()),
};
for (const key of [
  'SMS_ACCOUNT_SID',
  'SMS_AUTH_TOKEN',
  'SMS_FROM',
  'EMAIL_API_KEY',
  'EMAIL_FROM',
  'EXPO_ACCESS_TOKEN',
])
  delete env[key];
const children = [];
function start(command, args, label) {
  const log = createWriteStream(`.cache/${label}.log`);
  const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  children.push(child);
  return child;
}
async function command(args) {
  await new Promise((resolve, reject) => {
    const child = spawn('npm', args, { env, stdio: 'inherit' });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`npm ${args.join(' ')} exited ${code}`)),
    );
  });
}
async function ready(url) {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* Service is still starting; retry within the bounded readiness window. */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Service did not become ready: ${url}`);
}
try {
  await command(['run', 'db:deploy']);
  start('node', ['apps/api/dist/server.js'], 'api-e2e');
  await ready('http://127.0.0.1:4002/health');
  start('node', ['apps/api/dist/worker.js'], 'worker-e2e');
  start(
    'node',
    [
      'node_modules/next/dist/bin/next',
      'dev',
      'apps/web',
      '--hostname',
      '0.0.0.0',
      '--port',
      '3000',
    ],
    'web-e2e',
  );
  await ready('http://localhost:3000');
  await command(['run', 'test:e2e']);
} finally {
  for (const child of children) child.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 1000));
  for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
  await server.stop();
  await database.close();
}
