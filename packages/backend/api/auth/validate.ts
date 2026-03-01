import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initSentry, Sentry } from '../../lib/sentry'
import { config } from '../../lib/config'
import { extractAuthContext, getDailyLimit, hasUnlimitedUsage } from '../../lib/auth'
import { getUsage, getUsageCount, migrateAnonymousUsage } from '../../lib/supabase'
import { z } from 'zod'

// Initialize Sentry on cold start
initSentry()

const ValidateRequestSchema = z.object({
  deviceFingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Extract auth context from headers
    const authContext = await extractAuthContext(req)

    // Must have valid auth token
    if (!authContext.isAuthenticated || !authContext.userId) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        message: 'Please sign in again',
      })
    }

    // Parse request body for device fingerprint migration
    const parseResult = ValidateRequestSchema.safeParse(req.body || {})
    const { deviceFingerprint } = parseResult.success ? parseResult.data : {}

    // Migrate anonymous usage if device fingerprint provided
    if (deviceFingerprint) {
      try {
        await migrateAnonymousUsage(authContext.userId, deviceFingerprint)
      } catch (err) {
        // Log but don't fail - migration is best effort
        if (config.isDev) {
          console.warn('[Auth] Usage migration failed:', err)
        }
      }
    }

    // Get current usage for the authenticated user
    let usageData: { current: number; limit: number; remaining: number }

    if (hasUnlimitedUsage(authContext.tier)) {
      const current = await getUsageCount(authContext.userId, null)
      usageData = {
        current,
        limit: -1, // unlimited
        remaining: -1, // unlimited
      }
    } else {
      const dailyLimit = getDailyLimit(authContext.tier)
      const usage = await getUsage(authContext.userId, null, dailyLimit)
      usageData = {
        current: usage.current,
        limit: usage.limit,
        remaining: usage.remaining,
      }
    }

    return res.status(200).json({
      valid: true,
      user: {
        id: authContext.userId,
        tier: authContext.tier,
      },
      usage: usageData,
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
