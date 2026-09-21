import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
const database = await PGlite.create();
const server = new PGLiteSocketServer({
  db: database,
  port: 5433,
  host: '127.0.0.1',
  maxConnections: 20,
});
await server.start();
const connection = 'postgresql://postgres@127.0.0.1:5433/abhaya_test';
async function run(args) {
  await new Promise((resolve, reject) => {
    const child = spawn('npm', args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        DB_POOL_MAX: '1',
        DATABASE_URL: connection,
        TEST_DATABASE_URL: connection,
      },
    });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Command failed (${code}): npm ${args.join(' ')}`)),
    );
  });
}
try {
  await run(['run', 'db:deploy']);
  await run(['run', 'test:integration']);
} finally {
  await server.stop();
  await database.close();
}
