import { createApp } from './app';
import { db } from './db';
import { env } from './env';
import { logger } from './http';
const server = createApp().listen(env.PORT, '0.0.0.0', () =>
  logger.info({ port: env.PORT, testOnly: env.TEST_MODE_ONLY }, 'ABHAYA API listening'),
);
server.requestTimeout = 20000;
server.headersTimeout = 10000;
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    void db.$disconnect().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
