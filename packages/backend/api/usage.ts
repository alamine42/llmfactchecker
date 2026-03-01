import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initSentry, Sentry } from '../lib/sentry'
import { config } from '../lib/config'
import { extractAuthContext, getDailyLimit, hasUnlimitedUsage } from '../lib/auth'
import { getUsage, getUsageCount } from '../lib/supabase'

// Initialize Sentry on cold start
initSentry()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Extract auth context from headers
    const authContext = await extractAuthContext(req)

    // Must have either user ID or device fingerprint
    if (!authContext.userId && !authContext.deviceFingerprint) {
      return res.status(400).json({
        error: 'Authentication required',
        message: 'Please provide a valid token or device fingerprint',
      })
    }

    // Handle unlimited tier separately
    if (hasUnlimitedUsage(authContext.tier)) {
      const current = await getUsageCount(authContext.userId, authContext.deviceFingerprint)
      return res.status(200).json({
        current,
        limit: -1, // unlimited
        remaining: -1, // unlimited
        tier: authContext.tier,
        isAuthenticated: authContext.isAuthenticated,
        resetsAt: getNextResetTime(),
      })
    }

    // Get daily limit for user's tier
    const dailyLimit = getDailyLimit(authContext.tier)

    // Get current usage
    const usage = await getUsage(authContext.userId, authContext.deviceFingerprint, dailyLimit)

    return res.status(200).json({
      current: usage.current,
      limit: usage.limit,
      remaining: usage.remaining,
      tier: authContext.tier,
      isAuthenticated: authContext.isAuthenticated,
      resetsAt: getNextResetTime(),
    })
  } catch (error) {
    Sentry.captureException(error)

    if (error instanceof Error) {
      return res.status(500).json({
        error: 'Internal server error',
        message: config.isDev ? error.message : undefined,
      })
    }

    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Get the next daily reset time (midnight UTC)
 */
function getNextResetTime(): string {
  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return tomorrow.toISOString()
}
