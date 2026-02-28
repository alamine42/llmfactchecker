import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initSentry } from '../lib/sentry'

// Initialize Sentry on cold start
initSentry()

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: 'ok',
    service: 'groundcheck-backend',
    timestamp: new Date().toISOString(),
  })
}
