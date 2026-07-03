import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createContainer } from '@ai-brain/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

async function main() {
  const container = createContainer();
  console.log('[worker] AI Brain job processor started');

  const processReminders = async () => {
    try {
      await container.jobs.enqueue('reminder.send', {}, {
        idempotencyKey: `reminder.send:${new Date().toISOString().slice(0, 16)}`,
      });
    } catch {
      // idempotency - already scheduled
    }
  };

  const processDailyDigest = async () => {
    try {
      await container.jobs.enqueue('digest.daily', {}, {
        idempotencyKey: `digest.daily:${new Date().toISOString().slice(0, 13)}`,
      });
    } catch {
      // idempotency - already scheduled
    }
  };

  setInterval(processReminders, 60_000);
  setInterval(processDailyDigest, 60 * 60_000);
  await processReminders();
  await processDailyDigest();

  const poll = async () => {
    try {
      const processed = await container.jobProcessor.processBatch(BATCH_SIZE);
      if (processed > 0) {
        console.log(`[worker] Processed ${processed} jobs`);
      }
    } catch (err) {
      console.error('[worker] Error processing batch:', err);
    }
  };

  setInterval(poll, POLL_INTERVAL_MS);
  await poll();
}

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
