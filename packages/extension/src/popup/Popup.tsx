import { useState, useEffect } from 'preact/hooks'
import { AuthButton } from './components/AuthButton'
import { UsageDisplay } from './components/UsageDisplay'
import { UpgradePrompt } from './components/UpgradePrompt'

// Checkmark icon for the logo
function LogoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

export function Popup() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    const manifest = chrome.runtime.getManifest()
    setVersion(manifest.version)
  }, [])

  return (
    <div className="gc-popup">
      {/* Header */}
      <header className="gc-header">
        <div className="gc-header__brand">
          <div className="gc-header__logo">
            <LogoIcon />
          </div>
          <div className="gc-header__text">
            <h1 className="gc-header__title">GroundCheck</h1>
            <p className="gc-header__subtitle">Fact-check AI responses</p>
          </div>
        </div>
        <div className="gc-status-badge">
          <span className="gc-status-badge__dot" />
          <span>Active</span>
        </div>
      </header>

      {/* Usage Card */}
      <div className="gc-card" style={{ animationDelay: '50ms' }}>
        <UsageDisplay />
      </div>

      {/* Upgrade Prompt (shows when limit reached) */}
      <UpgradePrompt />

      {/* Divider */}
      <div className="gc-divider" />

      {/* Auth Section */}
      <div className="gc-auth">
        <AuthButton />
      </div>

      {/* Version Footer */}
      <div
        style={{
          marginTop: '16px',
          textAlign: 'center',
          fontSize: '11px',
          color: 'var(--gc-gray-400)',
        }}
      >
        v{version}
      </div>
    </div>
  )
}
