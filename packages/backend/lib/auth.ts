import type { VercelRequest } from '@vercel/node'
import { getSupabaseClient, getUserProfile } from './supabase'
import { config } from './config'

export interface AuthContext {
  // User ID if authenticated, null for anonymous
  userId: string | null
  // Device fingerprint for anonymous users
  deviceFingerprint: string | null
  // User tier (free/pro), defaults to free for anonymous
  tier: 'free' | 'pro'
  // Whether the request is from an authenticated user
  isAuthenticated: boolean
}

/**
 * Extract authentication context from request headers
 *
 * Supports two modes:
 * 1. Bearer token (JWT): Authorization: Bearer <token>
 * 2. Device fingerprint: X-Device-Fingerprint: <fingerprint>
 */
export async function extractAuthContext(req: VercelRequest): Promise<AuthContext> {
  const authHeader = req.headers.authorization
  const deviceFingerprint = req.headers['x-device-fingerprint'] as string | undefined

  // Try JWT authentication first
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const userContext = await validateJwtToken(token)
    if (userContext) {
      return userContext
    }
  }

  // Fall back to device fingerprint for anonymous users
  if (deviceFingerprint && isValidFingerprint(deviceFingerprint)) {
    return {
      userId: null,
      deviceFingerprint,
      tier: 'free',
      isAuthenticated: false,
    }
  }

  // No valid auth - return anonymous without fingerprint
  // This will be rejected by usage limits
  return {
    userId: null,
    deviceFingerprint: null,
    tier: 'free',
    isAuthenticated: false,
  }
}

/**
 * Validate a JWT token and extract user info
 */
async function validateJwtToken(token: string): Promise<AuthContext | null> {
  try {
    const supabase = getSupabaseClient()

    // Verify the JWT with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      if (config.isDev) {
        console.warn('[Auth] JWT validation failed:', error?.message)
      }
      return null
    }

    // Get user profile for tier info
    const profile = await getUserProfile(user.id)
    const tier = profile?.tier || 'free'

    return {
      userId: user.id,
      deviceFingerprint: profile?.device_fingerprint || null,
      tier,
      isAuthenticated: true,
    }
  } catch (err) {
    if (config.isDev) {
      console.error('[Auth] JWT validation error:', err)
    }
    return null
  }
}

/**
 * Validate device fingerprint format
 * Fingerprint should be a 64-character hex string (SHA-256 hash)
 */
function isValidFingerprint(fingerprint: string): boolean {
  return /^[a-f0-9]{64}$/i.test(fingerprint)
}

/**
 * Get the daily verification limit for a user tier
 * Returns -1 for unlimited (pro tier) - this sentinel value must be handled by callers
 */
export function getDailyLimit(tier: 'free' | 'pro'): number {
  return config.dailyVerificationLimit[tier]
}

/**
 * Check if tier has unlimited usage
 */
export function hasUnlimitedUsage(tier: 'free' | 'pro'): boolean {
  return config.dailyVerificationLimit[tier] === -1
}

/**
 * Check if a user has exceeded their daily limit
 * Returns true if within limits, false if exceeded
 */
export function isWithinLimit(current: number, tier: 'free' | 'pro'): boolean {
  const limit = getDailyLimit(tier)
  return current < limit
}
