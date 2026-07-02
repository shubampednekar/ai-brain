import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createContainer } from '@ai-brain/core';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.headers['x-cron-secret'] ?? req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const container = createContainer();
  await container.jobs.enqueue('reminder.send', {}, {
    idempotencyKey: `reminder.send:${new Date().toISOString().slice(0, 16)}`,
  });

  return res.status(200).json({ scheduled: true, timestamp: new Date().toISOString() });
}
