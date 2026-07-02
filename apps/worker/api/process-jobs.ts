import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createContainer } from '@ai-brain/core';
import { verifyCronSecret } from '../lib/cron-auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyCronSecret(req, res)) return;

  const container = createContainer();
  const processed = await container.jobProcessor.processBatch(20);

  return res.status(200).json({ processed, timestamp: new Date().toISOString() });
}
