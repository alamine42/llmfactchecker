import {
  getSupabaseClient,
  getSession,
  getAccessToken,
  signOut,
  type Session,
  type User,
} from './supabase'
import { getOrCreateFingerprint, getStoredFingerprint } from './fingerprint'
import { config } from '@/shared/config'

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  tier: 'free' | 'pro'
  loading: boolean
  error: string | null
}

export interface UsageState {
  current: number
  limit: number
  remaining: number
  loading: boolean
  error: string | null
}

type AuthStateListener = (state: AuthState) => void
type UsageStateListener = (state: UsageState) => void

// Storage key for persisting usage state across contexts
const USAGE_STATE_STORAGE_KEY = 'groundcheck_usage_state'

// State management
let currentAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  tier: 'free',
  loading: true,
  error: null,
}

let currentUsageState: UsageState = {
  current: 0,
  limit: config.dailyVerificationLimit,
  remaining: config.dailyVerificationLimit,
  loading: true,
  error: null,
}

const authListeners: Set<AuthStateListener> = new Set()
const usageListeners: Set<UsageStateListener> = new Set()

// Listen for storage changes to sync usage state between background and popup
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[USAGE_STATE_STORAGE_KEY]) {
      const newValue = changes[USAGE_STATE_STORAGE_KEY].newValue
      if (newValue) {
        // Update local state from storage without triggering another storage write
        currentUsageState = { ...currentUsageState, ...newValue }
        usageListeners.forEach((listener) => listener(currentUsageState))
      }
    }
  })

  // Initialize from storage on load
  chrome.storage.local
    .get(USAGE_STATE_STORAGE_KEY)
    .then((result) => {
      const stored = result[USAGE_STATE_STORAGE_KEY]
      if (stored) {
        currentUsageState = { ...currentUsageState, ...stored, loading: currentUsageState.loading }
        usageListeners.forEach((listener) => listener(currentUsageState))
      }
    })
    .catch(() => {
      // Ignore storage errors on init
    })
}

/**
 * Subscribe to auth state changes
 */
export function subscribeToAuthState(listener: AuthStateListener): () => void {
  authListeners.add(listener)
  // Immediately call with current state
  listener(currentAuthState)
  return () => authListeners.delete(listener)
}

/**
 * Subscribe to usage state changes
 */
export function subscribeToUsageState(listener: UsageStateListener): () => void {
  usageListeners.add(listener)
  // Immediately call with current state
  listener(currentUsageState)
  return () => usageListeners.delete(listener)
}

/**
 * Update and broadcast auth state
 */
function setAuthState(update: Partial<AuthState>) {
  currentAuthState = { ...currentAuthState, ...update }
  authListeners.forEach((listener) => listener(currentAuthState))
}

/**
 * Update and broadcast usage state
 * Also persists to chrome.storage to sync between background and popup
 */
function setUsageState(update: Partial<UsageState>) {
  currentUsageState = { ...currentUsageState, ...update }
  usageListeners.forEach((listener) => listener(currentUsageState))

  // Persist to storage for cross-context sync (don't persist loading/error)
  if (typeof chrome !== 'undefined' && chrome.storage && !update.loading) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { loading, error, ...persistable } = currentUsageState
    chrome.storage.local.set({ [USAGE_STATE_STORAGE_KEY]: persistable }).catch(() => {
      // Ignore storage errors
    })
  }
}

/**
 * Get current auth state
 */
export function getAuthState(): AuthState {
  return currentAuthState
}

/**
 * Get current usage state
 */
export function getUsageState(): UsageState {
  return currentUsageState
}

/**
 * Initialize auth state from stored session
 */
export async function initializeAuth(): Promise<void> {
  setAuthState({ loading: true, error: null })

  try {
    const session = await getSession()

    if (session?.user) {
      setAuthState({
        isAuthenticated: true,
        user: session.user,
        tier: 'free', // Will be updated from profile
        loading: false,
      })

      // Fetch usage for authenticated user
      await refreshUsage()
    } else {
      setAuthState({
        isAuthenticated: false,
        user: null,
        tier: 'free',
        loading: false,
      })

      // Fetch usage for anonymous user
      await refreshUsage()
    }
  } catch (err) {
    setAuthState({
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to initialize auth',
    })
  }
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(): Promise<void> {
  setAuthState({ loading: true, error: null })

  try {
    const supabase = getSupabaseClient()

    // Use chrome.identity for OAuth flow
    const redirectUrl = chrome.identity.getRedirectURL()

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    })

    if (error) {
      throw error
    }

    if (!data.url) {
      throw new Error('No OAuth URL returned')
    }

    // Launch OAuth flow with chrome.identity
    const authUrl = data.url

    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true,
      },
      async (callbackUrl) => {
        if (chrome.runtime.lastError) {
          setAuthState({
            loading: false,
            error: chrome.runtime.lastError.message || 'OAuth flow cancelled',
          })
          return
        }

        if (!callbackUrl) {
          setAuthState({
            loading: false,
            error: 'No callback URL received',
          })
          return
        }

        try {
          // Extract tokens from callback URL
          const url = new URL(callbackUrl)
          const hashParams = new URLSearchParams(url.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (!accessToken) {
            // Try query params for code flow
            const code = url.searchParams.get('code')
            if (code) {
              // Exchange code for session
              const { data: sessionData, error: sessionError } =
                await supabase.auth.exchangeCodeForSession(code)

              if (sessionError) {
                throw sessionError
              }

              if (sessionData.session) {
                await handleSuccessfulAuth(sessionData.session)
              }
            } else {
              throw new Error('No access token or code in callback')
            }
          } else {
            // Set session with tokens
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            })

            if (sessionError) {
              throw sessionError
            }

            if (sessionData.session) {
              await handleSuccessfulAuth(sessionData.session)
            }
          }
        } catch (err) {
          setAuthState({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to complete sign in',
          })
        }
      }
    )
  } catch (err) {
    setAuthState({
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to start sign in',
    })
  }
}

/**
 * Handle successful authentication
 */
async function handleSuccessfulAuth(session: Session): Promise<void> {
  setAuthState({
    isAuthenticated: true,
    user: session.user,
    tier: 'free', // Will be updated from profile
    loading: false,
    error: null,
  })

  // Migrate anonymous usage to user account
  const fingerprint = await getStoredFingerprint()
  if (fingerprint) {
    try {
      await fetch(`${config.apiUrl}/api/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ deviceFingerprint: fingerprint }),
      })
    } catch {
      // Migration is best effort
    }
  }

  // Refresh usage with new auth context
  await refreshUsage()
}

/**
 * Sign out
 */
export async function handleSignOut(): Promise<void> {
  setAuthState({ loading: true, error: null })

  try {
    await signOut()

    setAuthState({
      isAuthenticated: false,
      user: null,
      tier: 'free',
      loading: false,
      error: null,
    })

    // Refresh usage for anonymous user
    await refreshUsage()
  } catch (err) {
    setAuthState({
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to sign out',
    })
  }
}

/**
 * Refresh usage state from API
 */
export async function refreshUsage(): Promise<void> {
  setUsageState({ loading: true, error: null })

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Add auth header
    const token = await getAccessToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    } else {
      // Use device fingerprint for anonymous users
      const fingerprint = await getOrCreateFingerprint()
      headers['X-Device-Fingerprint'] = fingerprint
    }

    const response = await fetch(`${config.apiUrl}/api/usage`, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch usage: ${response.status}`)
    }

    const data = await response.json()

    setUsageState({
      current: data.current,
      limit: data.limit,
      remaining: data.remaining,
      loading: false,
      error: null,
    })

    // Update tier from response if authenticated
    if (data.isAuthenticated && data.tier) {
      setAuthState({ tier: data.tier })
    }
  } catch (err) {
    setUsageState({
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to fetch usage',
    })
  }
}

/**
 * Update usage state after a verification
 * Called by background script when a verification completes
 */
export function updateUsageFromVerification(usage: {
  current: number
  limit: number
  remaining: number
}): void {
  setUsageState({
    current: usage.current,
    limit: usage.limit,
    remaining: usage.remaining,
    loading: false,
    error: null,
  })
}

/**
 * Get auth headers for API requests
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }

  const fingerprint = await getOrCreateFingerprint()
  return { 'X-Device-Fingerprint': fingerprint }
}
