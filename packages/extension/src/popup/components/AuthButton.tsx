import { useState, useEffect } from 'preact/hooks'
import type { AuthState } from '@/shared/types'
import { subscribeToAuthState, signInWithGoogle, handleSignOut, initializeAuth } from '@/lib/auth'

// Google "G" logo with proper colors
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px' }}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

// Loading spinner
function Spinner() {
  return <div className="gc-spinner" />
}

// Sign out / logout icon
function LogOutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '16px', height: '16px' }}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export function AuthButton() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null,
  })
  const [tier, setTier] = useState<'free' | 'pro'>('free')

  useEffect(() => {
    // Initialize auth on mount
    initializeAuth()

    // Subscribe to auth state changes
    const unsubscribe = subscribeToAuthState((state) => {
      setAuthState({
        isAuthenticated: state.isAuthenticated,
        user: state.user
          ? {
              id: state.user.id,
              email: state.user.email || undefined,
              tier: state.tier,
            }
          : null,
        loading: state.loading,
        error: state.error,
      })
      setTier(state.tier)
    })

    return unsubscribe
  }, [])

  const handleSignIn = async () => {
    await signInWithGoogle()
  }

  const handleSignOutClick = async () => {
    await handleSignOut()
  }

  if (authState.loading) {
    return (
      <div>
        <button className="gc-btn gc-btn--google gc-btn--loading" disabled>
          <Spinner />
          <span>Loading...</span>
        </button>
      </div>
    )
  }

  if (authState.isAuthenticated && authState.user) {
    const email = authState.user.email || 'User'
    const initial = email.charAt(0).toUpperCase()

    return (
      <div>
        <div className="gc-user-profile">
          <div className="gc-user-profile__avatar">
            {initial}
            <div className="gc-user-profile__badge" />
          </div>
          <div className="gc-user-profile__info">
            <p className="gc-user-profile__email">{email}</p>
            <span className="gc-user-profile__tier">{tier} plan</span>
          </div>
        </div>

        <button className="gc-btn gc-btn--secondary" onClick={handleSignOutClick}>
          <LogOutIcon />
          <span>Sign out</span>
        </button>

        {authState.error && (
          <div className="gc-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span>{authState.error}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <button className="gc-btn gc-btn--google" onClick={handleSignIn}>
        <GoogleLogo />
        <span>Continue with Google</span>
      </button>

      {authState.error && (
        <div className="gc-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{authState.error}</span>
        </div>
      )}
    </div>
  )
}
