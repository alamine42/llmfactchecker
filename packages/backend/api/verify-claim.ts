import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initSentry, Sentry } from '../lib/sentry'
import { config } from '../lib/config'
import { VerifyClaimRequestSchema, VerifyClaimResponseSchema } from '../lib/schemas'
import { extractAuthContext, getDailyLimit, hasUnlimitedUsage } from '../lib/auth'
import { checkAndIncrementUsage, incrementUsageOnly } from '../lib/supabase'

// Initialize Sentry on cold start
initSentry()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Validate request body FIRST (before any usage tracking)
    // This prevents quota drain from invalid/malformed requests
    const parseResult = VerifyClaimRequestSchema.safeParse(req.body)

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.issues,
      })
    }

    const validatedRequest = parseResult.data

    // Extract auth context from headers
    const authContext = await extractAuthContext(req)

    // Must have either user ID or device fingerprint for usage tracking
    if (!authContext.userId && !authContext.deviceFingerprint) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid token or device fingerprint',
      })
    }

    // Check and increment usage (atomic operation)
    // Pro tier has unlimited usage - skip limit check but still track usage
    let usageResult: { allowed: boolean; current: number; limit: number; remaining: number }

    if (hasUnlimitedUsage(authContext.tier)) {
      // Pro tier: just increment, no limit check
      const current = await incrementUsageOnly(authContext.userId, authContext.deviceFingerprint)
      usageResult = {
        allowed: true,
        current,
        limit: -1, // unlimited
        remaining: -1, // unlimited
      }
    } else {
      // Free tier: check and increment with limit
      const dailyLimit = getDailyLimit(authContext.tier)
      usageResult = await checkAndIncrementUsage(
        authContext.userId,
        authContext.deviceFingerprint,
        dailyLimit
      )

      // Check if usage limit exceeded
      if (!usageResult.allowed) {
        return res.status(429).json({
          error: 'Daily limit exceeded',
          message: `You've used all ${usageResult.limit} verifications for today. Upgrade to Pro for unlimited verifications.`,
          usage: {
            current: usageResult.current,
            limit: usageResult.limit,
            remaining: 0,
          },
        })
      }
    }

    // Forward request to Python service with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    let pythonResponse: Response
    try {
      pythonResponse = await fetch(`${config.pythonServiceUrl}/api/verify-claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validatedRequest),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text()
      Sentry.captureMessage(`Python service error: ${pythonResponse.status}`, {
        level: 'error',
        extra: { status: pythonResponse.status, body: errorText },
      })
      return res.status(502).json({
        error: 'Upstream service error',
        status: pythonResponse.status,
      })
    }

    const responseData = await pythonResponse.json()

    // Validate response from Python service
    const responseParseResult = VerifyClaimResponseSchema.safeParse(responseData)

    if (!responseParseResult.success) {
      Sentry.captureMessage('Invalid response from Python service', {
        level: 'error',
        extra: { issues: responseParseResult.error.issues },
      })
      return res.status(502).json({
        error: 'Invalid upstream response',
      })
    }

    // Include usage info in successful response
    return res.status(200).json({
      ...responseParseResult.data,
      usage: {
        current: usageResult.current,
        limit: usageResult.limit,
        remaining: usageResult.remaining,
      },
    })
  } catch (error) {
    // Handle timeout/abort errors separately
    if (error instanceof Error && error.name === 'AbortError') {
      Sentry.captureMessage('Verification request timed out', { level: 'warning' })
      return res.status(504).json({
        error: 'Verification request timed out',
        message: 'The upstream service took too long to respond. Please try again.',
      })
    }

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
