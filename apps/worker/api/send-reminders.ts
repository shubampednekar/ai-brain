import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createContainer } from '@ai-brain/core';
import { verifyCronSecret } from '../lib/cron-auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyCronSecret(req, res)) return;

  const container = createContainer();
  await container.jobs.enqueue('reminder.send', {}, {
    idempotencyKey: `reminder.send:${new Date().toISOString().slice(0, 16)}`,
  });

  return res.status(200).json({ scheduled: true, timestamp: new Date().toISOString() });
}
