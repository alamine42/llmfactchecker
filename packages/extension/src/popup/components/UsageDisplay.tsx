import { useState, useEffect } from 'preact/hooks'
import type { UsageState } from '@/shared/types'
import { subscribeToUsageState, refreshUsage, subscribeToAuthState } from '@/lib/auth'
import { config } from '@/shared/config'

// Chart icon
function ChartIcon() {
  return (
    <svg
      className="gc-usage__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  )
}

// Refresh icon
function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  )
}

// Info icon
function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}

export function UsageDisplay() {
  const [usageState, setUsageState] = useState<UsageState>({
    current: 0,
    limit: config.dailyVerificationLimit,
    remaining: config.dailyVerificationLimit,
    loading: true,
    error: null,
  })
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    // Subscribe to usage state changes
    const unsubUsage = subscribeToUsageState((state) => {
      setUsageState({
        current: state.current,
        limit: state.limit,
        remaining: state.remaining,
        loading: state.loading,
        error: state.error,
      })
      // Only clear refreshing when the request has completed (not loading)
      if (!state.loading) {
        setIsRefreshing(false)
      }
    })

    // Subscribe to auth state to know if user is authenticated
    const unsubAuth = subscribeToAuthState((state) => {
      setIsAuthenticated(state.isAuthenticated)
    })

    return () => {
      unsubUsage()
      unsubAuth()
    }
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    refreshUsage()
  }

  // Check if unlimited tier (limit === -1)
  const isUnlimited = usageState.limit === -1

  // Calculate progress percentage (0% for unlimited since there's no limit)
  const progressPercent = isUnlimited
    ? 0
    : usageState.limit > 0
      ? (usageState.current / usageState.limit) * 100
      : 0
  const clampedPercent = Math.min(100, Math.max(0, progressPercent))

  // Determine progress bar state
  let progressClass = ''
  if (progressPercent >= 100) {
    progressClass = 'gc-progress__bar--danger'
  } else if (progressPercent >= 70) {
    progressClass = 'gc-progress__bar--warning'
  }

  if (usageState.loading) {
    return (
      <div className="gc-usage">
        <div className="gc-usage__header">
          <div className="gc-skeleton" style={{ width: '140px', height: '18px' }} />
          <div className="gc-skeleton" style={{ width: '50px', height: '24px' }} />
        </div>
        <div className="gc-skeleton" style={{ height: '8px', marginBottom: '12px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="gc-skeleton" style={{ width: '80px', height: '14px' }} />
          <div className="gc-skeleton" style={{ width: '50px', height: '14px' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="gc-usage">
      <div className="gc-usage__header">
        <div className="gc-usage__label">
          <ChartIcon />
          <span>Verifications today</span>
        </div>
        <div className="gc-usage__count">
          <span className="gc-usage__current">{usageState.current}</span>
          {isUnlimited ? (
            <span className="gc-usage__unlimited">Unlimited</span>
          ) : (
            <>
              <span className="gc-usage__separator">/</span>
              <span className="gc-usage__limit">{usageState.limit}</span>
            </>
          )}
        </div>
      </div>

      <div className="gc-progress">
        <div
          className={`gc-progress__bar ${progressClass}`}
          style={{ width: `${clampedPercent}%` }}
        />
        <div className="gc-progress__shine" />
      </div>

      <div className="gc-usage__footer">
        <span className="gc-usage__remaining">
          {isUnlimited ? (
            <strong>Pro</strong>
          ) : (
            <>
              <strong>{usageState.remaining}</strong> remaining
            </>
          )}
        </span>
        <button
          className={`gc-refresh-btn ${isRefreshing ? 'gc-refresh-btn--loading' : ''}`}
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshIcon />
          {isRefreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      {usageState.error && (
        <div className="gc-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{usageState.error}</span>
        </div>
      )}

      {!isAuthenticated &&
        !isUnlimited &&
        usageState.remaining <= 3 &&
        usageState.remaining > 0 && (
          <div className="gc-usage__hint">
            <InfoIcon />
            <span>Sign in to sync usage across devices</span>
          </div>
        )}
    </div>
  )
}
