import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js'
import { config } from '@/shared/config'

// Singleton client
let supabaseClient: SupabaseClient | null = null

/**
 * Get the Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error('Supabase configuration missing')
    }
    supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        // Use custom storage for Chrome extension
        storage: {
          getItem: async (key: string) => {
            const result = await chrome.storage.local.get(key)
            return result[key] || null
          },
          setItem: async (key: string, value: string) => {
            await chrome.storage.local.set({ [key]: value })
          },
          removeItem: async (key: string) => {
            await chrome.storage.local.remove(key)
          },
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  }
  return supabaseClient
}

/**
 * Get the current session
 * Returns null if Supabase is not configured
 */
export async function getSession(): Promise<Session | null> {
  try {
    const client = getSupabaseClient()
    const {
      data: { session },
    } = await client.auth.getSession()
    return session
  } catch {
    // If Supabase is not configured, return null
    return null
  }
}

/**
 * Get the current user
 */
export async function getUser(): Promise<User | null> {
  const session = await getSession()
  return session?.user || null
}

/**
 * Get the current access token
 * Returns null if Supabase is not configured or no session exists
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const session = await getSession()
    return session?.access_token || null
  } catch {
    // If Supabase is not configured, return null to fall back to fingerprint auth
    return null
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const client = getSupabaseClient()
  await client.auth.signOut()
}

export type { Session, User }
