import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createContainer } from '@ai-brain/core';
import { verifyCronSecret } from '../lib/cron-auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyCronSecret(req, res)) return;

  const container = createContainer();
  await container.jobs.enqueue('digest.daily', {}, {
    idempotencyKey: `digest.daily:${new Date().toISOString().slice(0, 13)}`,
  });

  return res.status(200).json({ scheduled: true, timestamp: new Date().toISOString() });
}
