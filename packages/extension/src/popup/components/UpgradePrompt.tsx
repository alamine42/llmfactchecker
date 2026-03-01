import { useState, useEffect } from 'preact/hooks'
import type { UsageState } from '@/shared/types'
import { subscribeToUsageState } from '@/lib/auth'
import { config } from '@/shared/config'

// Warning/Alert icon
function AlertIcon() {
  return (
    <svg
      className="gc-upgrade__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

// Arrow right icon
function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

// Sparkles/Star icon for premium
function SparklesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  )
}

function getTimeUntilReset(): string {
  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const diffMs = tomorrow.getTime() - now.getTime()

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes} minutes`
}

export function UpgradePrompt() {
  const [usageState, setUsageState] = useState<UsageState>({
    current: 0,
    limit: config.dailyVerificationLimit,
    remaining: config.dailyVerificationLimit,
    loading: true,
    error: null,
  })
  const [timeUntilReset, setTimeUntilReset] = useState(getTimeUntilReset())

  useEffect(() => {
    // Subscribe to usage state changes
    const unsubscribe = subscribeToUsageState((state) => {
      setUsageState({
        current: state.current,
        limit: state.limit,
        remaining: state.remaining,
        loading: state.loading,
        error: state.error,
      })
    })

    // Update time until reset every minute
    const interval = setInterval(() => {
      setTimeUntilReset(getTimeUntilReset())
    }, 60000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  // Never show for unlimited tier (limit === -1)
  // Only show when limit is reached (remaining <= 0 and not unlimited)
  if (usageState.loading || usageState.limit === -1 || usageState.remaining > 0) {
    return null
  }

  return (
    <div
      className="gc-card gc-card--warning"
      style={{ marginTop: '12px', animationDelay: '100ms' }}
    >
      <div className="gc-upgrade">
        <div className="gc-upgrade__header">
          <AlertIcon />
          <h3 className="gc-upgrade__title">Daily Limit Reached</h3>
        </div>

        <p className="gc-upgrade__message">
          You've used all {usageState.limit} free verifications for today. Upgrade to Pro for
          unlimited fact-checking and priority support.
        </p>

        <a
          href="https://groundcheck.app/pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="gc-upgrade__cta"
        >
          <SparklesIcon />
          <span>Upgrade to Pro</span>
          <ArrowRightIcon />
        </a>

        <p className="gc-upgrade__reset">
          Or wait <strong>{timeUntilReset}</strong> for your limit to reset
        </p>
      </div>
    </div>
  )
}
