import { db } from './db';
import { logger } from './http';
import { escalateJourneys, processOutbox, purgeExpiredData } from './jobs';
import { safeErrorDetails } from './diagnostics';
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
let lastPurge = 0;
async function run() {
  while (!stopping) {
    try {
      await escalateJourneys();
      await processOutbox();
      if (Date.now() - lastPurge > 3600000) {
        await purgeExpiredData();
        lastPurge = Date.now();
      }
    } catch (error) {
      logger.error(
        safeErrorDetails(error),
        'worker cycle failed; queued work remains in PostgreSQL',
      );
    }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  await db.$disconnect();
}
void run();
