import type { VercelRequest, VercelResponse } from '@vercel/node';

export function verifyCronSecret(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    res.status(500).json({ error: 'CRON_SECRET is not configured' });
    return false;
  }

  const authHeader = req.headers.authorization;
  const bearer =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

  const headerSecret = req.headers['x-cron-secret'];
  const querySecret = req.query.secret;

  const provided =
    bearer ??
    (typeof headerSecret === 'string' ? headerSecret : undefined) ??
    (typeof querySecret === 'string' ? querySecret : Array.isArray(querySecret) ? querySecret[0] : undefined);

  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}
