import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// A single free Render service for TEST previews. All processes sleep together.
// Real emergency delivery requires the separate, always-on production stack.
const origin = process.env.WEB_ORIGIN || process.env.RENDER_EXTERNAL_URL;
for (const key of ['DATABASE_URL', 'JWT_SECRET', 'DATA_ENCRYPTION_KEY']) {
  if (!process.env[key]) throw new Error(`Set ${key} in Render before starting the preview.`);
}
if (!origin) throw new Error('Set WEB_ORIGIN to the public HTTPS website URL.');
if (process.env.TEST_MODE_ONLY !== 'true') {
  throw new Error('The free preview requires TEST_MODE_ONLY=true. Use the production stack for live delivery.');
}
const port = process.env.PORT || '10000';
const apiPort = port === '4000' ? '4001' : '4000';
const apiEnv = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: apiPort,
  PUBLIC_WEB_URL: origin,
  CORS_ORIGINS: origin,
  DB_POOL_MAX: process.env.DB_POOL_MAX || '3',
  TRUST_PROXY_HOPS: '0',
};
const children = new Set();
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  if (!children.size) process.exit(code);
  const deadline = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
    process.exit(code);
  }, 12000);
  const poll = setInterval(() => {
    if (!children.size) {
      clearTimeout(deadline);
      clearInterval(poll);
      process.exit(code);
    }
  }, 100);
}
process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
function run(command, args, env, persistent = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' });
    children.add(child);
    child.on('error', (error) => {
      children.delete(child);
      reject(error);
      if (persistent) stop(1);
    });
    child.on('exit', (code) => {
      children.delete(child);
      if (persistent && !stopping) {
        console.error(`${command} exited; stopping the preview.`);
        stop(code || 1);
      }
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}
try {
  await run('npm', ['run', 'db:generate'], apiEnv);
  await run('npm', ['run', 'db:deploy'], apiEnv);
  if (!stopping) {
    void run(process.execPath, ['apps/api/dist/server.js'], apiEnv, true).catch(() => stop(1));
    let ready = false;
    for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${apiPort}/health`, { signal: AbortSignal.timeout(2000) });
        if (response.ok) { ready = true; break; }
      } catch {}
      await delay(1000);
    }
    if (!ready) throw new Error('API health check failed; the website will not start.');
    void run(process.execPath, ['apps/api/dist/worker.js'], apiEnv, true).catch(() => stop(1));
    void run(process.execPath, ['node_modules/next/dist/bin/next', 'start', 'apps/web', '--hostname', '0.0.0.0', '--port', port], {
      ...process.env,
      NODE_ENV: 'production',
      WEB_ORIGIN: origin,
      API_URL: `http://127.0.0.1:${apiPort}/api/v1`,
    }, true).catch(() => stop(1));
  }
} catch (error) {
  console.error(error.message);
  stop(1);
}
