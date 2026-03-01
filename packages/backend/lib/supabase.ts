import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

// Profile row type
export interface ProfileRow {
  id: string
  tier: 'free' | 'pro'
  device_fingerprint: string | null
  created_at: string
  updated_at: string
}

// Singleton clients
let anonClient: SupabaseClient | null = null
let serviceClient: SupabaseClient | null = null

/**
 * Get the Supabase client with anon key (respects RLS)
 * Use for user-authenticated requests
 */
export function getSupabaseClient(): SupabaseClient {
  if (!anonClient) {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error('Supabase configuration missing: SUPABASE_URL and SUPABASE_ANON_KEY required')
    }
    anonClient = createClient(config.supabaseUrl, config.supabaseAnonKey)
  }
  return anonClient
}

/**
 * Get the Supabase client with service role key (bypasses RLS)
 * Use for server-side operations like anonymous user tracking
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (!serviceClient) {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error(
        'Supabase configuration missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required'
      )
    }
    serviceClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return serviceClient
}

/**
 * Create a Supabase client authenticated with a user's JWT
 */
export function getSupabaseClientWithToken(jwt: string): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('Supabase configuration missing: SUPABASE_URL and SUPABASE_ANON_KEY required')
  }
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  })
}

export interface UsageResult {
  allowed: boolean
  current: number
  limit: number
  remaining: number
}

/**
 * Get current usage count without limit checking (for unlimited tier)
 */
export async function getUsageCount(
  userId: string | null,
  deviceFingerprint: string | null
): Promise<number> {
  const client = getSupabaseServiceClient()
  const today = new Date().toISOString().split('T')[0]

  let query = client.from('daily_usage').select('count').eq('usage_date', today)

  if (userId) {
    query = query.eq('user_id', userId)
  } else if (deviceFingerprint) {
    query = query.eq('device_fingerprint', deviceFingerprint)
  } else {
    return 0
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return 0
  }

  return (data as { count: number }).count
}

/**
 * Check and increment usage for a user or device
 */
export async function checkAndIncrementUsage(
  userId: string | null,
  deviceFingerprint: string | null,
  dailyLimit: number
): Promise<UsageResult> {
  const client = getSupabaseServiceClient()

  const { data, error } = await client.rpc('check_and_increment_usage', {
    p_user_id: userId,
    p_device_fingerprint: deviceFingerprint,
    p_daily_limit: dailyLimit,
  })

  if (error) {
    throw new Error(`Failed to check usage: ${error.message}`)
  }

  return data as UsageResult
}

/**
 * Get current usage for a user or device
 */
export async function getUsage(
  userId: string | null,
  deviceFingerprint: string | null,
  dailyLimit: number
): Promise<Omit<UsageResult, 'allowed'>> {
  const client = getSupabaseServiceClient()

  const { data, error } = await client.rpc('get_usage', {
    p_user_id: userId,
    p_device_fingerprint: deviceFingerprint,
    p_daily_limit: dailyLimit,
  })

  if (error) {
    throw new Error(`Failed to get usage: ${error.message}`)
  }

  return data as Omit<UsageResult, 'allowed'>
}

/**
 * Increment usage only (for unlimited/pro tier users)
 * Does not check limits, just tracks usage for analytics
 * Returns the new count
 */
export async function incrementUsageOnly(
  userId: string | null,
  deviceFingerprint: string | null
): Promise<number> {
  const client = getSupabaseServiceClient()
  const today = new Date().toISOString().split('T')[0]

  if (userId) {
    // Upsert for authenticated user
    const { data: existing } = await client
      .from('daily_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single()

    if (existing) {
      const { data, error } = await client
        .from('daily_usage')
        .update({ count: existing.count + 1, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('usage_date', today)
        .select('count')
        .single()

      if (error) throw new Error(`Failed to increment usage: ${error.message}`)
      return (data as { count: number }).count
    } else {
      const { data, error } = await client
        .from('daily_usage')
        .insert({ user_id: userId, usage_date: today, count: 1 })
        .select('count')
        .single()

      if (error) throw new Error(`Failed to create usage: ${error.message}`)
      return (data as { count: number }).count
    }
  } else if (deviceFingerprint) {
    // Upsert for anonymous user
    const { data: existing } = await client
      .from('daily_usage')
      .select('count')
      .eq('device_fingerprint', deviceFingerprint)
      .eq('usage_date', today)
      .single()

    if (existing) {
      const { data, error } = await client
        .from('daily_usage')
        .update({ count: existing.count + 1, updated_at: new Date().toISOString() })
        .eq('device_fingerprint', deviceFingerprint)
        .eq('usage_date', today)
        .select('count')
        .single()

      if (error) throw new Error(`Failed to increment usage: ${error.message}`)
      return (data as { count: number }).count
    } else {
      // Ensure anonymous user exists
      await client
        .from('anonymous_users')
        .upsert({ device_fingerprint: deviceFingerprint }, { onConflict: 'device_fingerprint' })

      const { data, error } = await client
        .from('daily_usage')
        .insert({ device_fingerprint: deviceFingerprint, usage_date: today, count: 1 })
        .select('count')
        .single()

      if (error) throw new Error(`Failed to create usage: ${error.message}`)
      return (data as { count: number }).count
    }
  }

  throw new Error('Either userId or deviceFingerprint must be provided')
}

/**
 * Migrate anonymous usage to user account
 */
export async function migrateAnonymousUsage(
  userId: string,
  deviceFingerprint: string
): Promise<void> {
  const client = getSupabaseServiceClient()

  const { error } = await client.rpc('migrate_anonymous_usage', {
    p_user_id: userId,
    p_device_fingerprint: deviceFingerprint,
  })

  if (error) {
    throw new Error(`Failed to migrate usage: ${error.message}`)
  }
}

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<ProfileRow | null> {
  const client = getSupabaseServiceClient()

  const { data, error } = await client.from('profiles').select('*').eq('id', userId).single()

  if (error) {
    return null
  }

  return data as ProfileRow
}
