/**
 * Sidebar Manager
 *
 * Slide-in panel that displays detailed claim verification information.
 * Opens when user clicks on a highlighted claim or inline badge.
 *
 * Design: Premium slide-in panel with rich source display.
 * Responsive: Full-height sidebar on desktop, bottom sheet on mobile.
 */

import type { VerificationResult, VerificationSource, VerifiedClaim } from '@/shared/types'

const CSS_PREFIX = 'gc'

export interface SidebarCallbacks {
  onVerifyRequest?: (claimId: string, claim: VerifiedClaim) => void
  onClose?: () => void
  onClaimNavigate?: (direction: 'prev' | 'next') => void
}

export interface SidebarState {
  isVisible: boolean
  activeClaim: VerifiedClaim | null
  allClaims: VerifiedClaim[]
  activeClaimIndex: number
  isVerifying: boolean
}

export class SidebarManager {
  private container: HTMLElement | null = null
  private state: SidebarState = {
    isVisible: false,
    activeClaim: null,
    allClaims: [],
    activeClaimIndex: -1,
    isVerifying: false,
  }
  private callbacks: SidebarCallbacks = {}
  private styleInjected = false
  private hideTimeoutId: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.setupGlobalListeners()
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: SidebarCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * Show sidebar with claim details
   */
  show(claim: VerifiedClaim, allClaims: VerifiedClaim[] = []): void {
    // Cancel any pending hide animation
    if (this.hideTimeoutId) {
      clearTimeout(this.hideTimeoutId)
      this.hideTimeoutId = null
    }

    if (!this.styleInjected) {
      this.injectStyles()
      this.styleInjected = true
    }

    this.state.activeClaim = claim
    this.state.allClaims = allClaims.length > 0 ? allClaims : [claim]
    this.state.activeClaimIndex = this.state.allClaims.findIndex((c) => c.id === claim.id)
    if (this.state.activeClaimIndex === -1) this.state.activeClaimIndex = 0
    // Reset verifying state when switching to a new claim
    this.state.isVerifying = false

    this.render()
    this.state.isVisible = true

    // Animate in
    requestAnimationFrame(() => {
      this.container?.classList.add(`${CSS_PREFIX}-sidebar--visible`)
    })

    // Focus the sidebar for accessibility
    setTimeout(() => {
      const closeBtn = this.container?.querySelector(`.${CSS_PREFIX}-sidebar-close`) as HTMLElement
      closeBtn?.focus()
    }, 100)
  }

  /**
   * Hide sidebar
   */
  hide(): void {
    if (!this.state.isVisible) return

    this.container?.classList.remove(`${CSS_PREFIX}-sidebar--visible`)
    this.state.isVisible = false

    // Remove after animation - store timeout handle so it can be cancelled
    this.hideTimeoutId = setTimeout(() => {
      // Only remove if still hidden (not reopened during animation)
      if (!this.state.isVisible) {
        this.container?.remove()
        this.container = null
      }
      this.hideTimeoutId = null
    }, 300)

    this.callbacks.onClose?.()
  }

  /**
   * Update claim verification status
   */
  updateClaimStatus(claimId: string, verification: VerificationResult): void {
    if (this.state.activeClaim?.id === claimId) {
      this.state.activeClaim = { ...this.state.activeClaim, verification }
      this.state.isVerifying = false
      this.render()
    }

    // Update in allClaims array too
    const idx = this.state.allClaims.findIndex((c) => c.id === claimId)
    if (idx !== -1) {
      this.state.allClaims[idx] = { ...this.state.allClaims[idx], verification }
    }
  }

  /**
   * Set verifying state
   */
  setVerifying(claimId: string, isVerifying: boolean): void {
    if (this.state.activeClaim?.id === claimId) {
      this.state.isVerifying = isVerifying
      this.render()
    }
  }

  /**
   * Navigate to next/previous claim
   */
  navigateClaim(direction: 'prev' | 'next'): void {
    if (this.state.allClaims.length <= 1) return

    const newIndex =
      direction === 'next'
        ? (this.state.activeClaimIndex + 1) % this.state.allClaims.length
        : (this.state.activeClaimIndex - 1 + this.state.allClaims.length) %
          this.state.allClaims.length

    this.state.activeClaimIndex = newIndex
    this.state.activeClaim = this.state.allClaims[newIndex]
    this.state.isVerifying = false
    this.render()

    this.callbacks.onClaimNavigate?.(direction)
  }

  /**
   * Check if sidebar is visible
   */
  get isVisible(): boolean {
    return this.state.isVisible
  }

  /**
   * Render sidebar content
   */
  private render(): void {
    if (!this.container) {
      this.container = document.createElement('div')
      this.container.className = `${CSS_PREFIX}-sidebar`
      // Use complementary role instead of dialog/modal since background interaction is allowed
      this.container.setAttribute('role', 'complementary')
      this.container.setAttribute('aria-label', 'Claim verification details')
      document.body.appendChild(this.container)
    }

    const claim = this.state.activeClaim
    if (!claim) {
      this.container.innerHTML = this.renderEmptyState()
      this.setupEventListeners()
      return
    }

    const verification = claim.verification
    const hasError = verification?.status === 'error'
    const isPending = verification?.status === 'pending' || this.state.isVerifying
    const hasNavigation = this.state.allClaims.length > 1

    this.container.innerHTML = `
      <div class="${CSS_PREFIX}-sidebar-header">
        <div class="${CSS_PREFIX}-sidebar-title-row">
          <h2 class="${CSS_PREFIX}-sidebar-title">Claim Details</h2>
          ${hasNavigation ? this.renderNavigation() : ''}
        </div>
        <button class="${CSS_PREFIX}-sidebar-close" aria-label="Close sidebar">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="${CSS_PREFIX}-sidebar-content">
        ${this.renderClaimCard(claim, isPending)}

        ${hasError ? this.renderErrorState(claim) : ''}

        ${verification && !hasError ? this.renderSourcesSection(verification) : ''}

        ${this.renderVerifyButton(claim, isPending, !!verification && verification.status !== 'unverified' && !hasError)}
      </div>

      <div class="${CSS_PREFIX}-sidebar-footer">
        <span class="${CSS_PREFIX}-sidebar-branding">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.78 5.28-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06L6.75 9.19l3.97-3.97a.75.75 0 1 1 1.06 1.06Z"/>
          </svg>
          GroundCheck
        </span>
      </div>
    `

    this.setupEventListeners()
  }

  /**
   * Render claim card
   */
  private renderClaimCard(claim: VerifiedClaim, isPending: boolean): string {
    const status = claim.verification?.status || 'none'
    // Use nullish coalescing so 0% confidence is not treated as falsy
    const confidence = claim.verification?.confidence ?? claim.confidence ?? 0
    const confidencePercent = Math.round(confidence * 100)

    return `
      <div class="${CSS_PREFIX}-claim-card">
        <div class="${CSS_PREFIX}-claim-card-header">
          <span class="${CSS_PREFIX}-claim-type-badge">${this.formatClaimType(claim.type)}</span>
          ${this.renderStatusBadge(status, isPending)}
        </div>

        <blockquote class="${CSS_PREFIX}-claim-text">
          "${this.escapeHtml(claim.text)}"
        </blockquote>

        <div class="${CSS_PREFIX}-claim-meta">
          <div class="${CSS_PREFIX}-confidence-meter">
            <span class="${CSS_PREFIX}-confidence-label">Confidence</span>
            <div class="${CSS_PREFIX}-confidence-bar">
              <div class="${CSS_PREFIX}-confidence-fill" style="width: ${confidencePercent}%"></div>
            </div>
            <span class="${CSS_PREFIX}-confidence-value">${confidencePercent}%</span>
          </div>
        </div>
      </div>
    `
  }

  /**
   * Render status badge
   */
  private renderStatusBadge(status: string, isPending: boolean): string {
    if (isPending) {
      return `
        <span class="${CSS_PREFIX}-status-badge ${CSS_PREFIX}-status-badge--pending">
          <svg class="${CSS_PREFIX}-spinner" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="8" cy="8" r="6" stroke-opacity="0.15"/>
            <path d="M8 2a6 6 0 0 1 6 6" stroke-linecap="round"/>
          </svg>
          Verifying...
        </span>
      `
    }

    const configs: Record<string, { label: string; icon: string }> = {
      verified: {
        label: 'Verified',
        icon: '<path d="M5.5 8.5l2 2 3.5-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
      },
      disputed: {
        label: 'Disputed',
        icon: '<path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      },
      unverified: {
        label: 'Unverified',
        icon: '<path d="M8 5v3.5M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      },
      error: {
        label: 'Error',
        icon: '<path d="M8 5v4M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      },
      none: {
        label: 'Not Checked',
        icon: '<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.25" stroke-dasharray="2 2" fill="none"/>',
      },
    }

    const config = configs[status] || configs.none

    return `
      <span class="${CSS_PREFIX}-status-badge ${CSS_PREFIX}-status-badge--${status}">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          ${config.icon}
        </svg>
        ${config.label}
      </span>
    `
  }

  /**
   * Render sources section
   */
  private renderSourcesSection(verification: VerificationResult): string {
    if (!verification.sources || verification.sources.length === 0) {
      return `
        <div class="${CSS_PREFIX}-sources-section">
          <h3 class="${CSS_PREFIX}-sources-title">Sources</h3>
          <p class="${CSS_PREFIX}-no-sources">No fact-check sources found for this claim.</p>
        </div>
      `
    }

    const sourcesHtml = verification.sources.map((source) => this.renderSourceCard(source)).join('')

    return `
      <div class="${CSS_PREFIX}-sources-section">
        <h3 class="${CSS_PREFIX}-sources-title">
          Sources
          <span class="${CSS_PREFIX}-sources-count">${verification.sources.length}</span>
        </h3>
        <div class="${CSS_PREFIX}-sources-list">
          ${sourcesHtml}
        </div>
      </div>
    `
  }

  /**
   * Render individual source card
   */
  private renderSourceCard(source: VerificationSource): string {
    const verdictClass = this.getVerdictClass(source.verdict)
    // Safely parse and format date - external sources may have invalid date formats
    let publishedDate: string | null = null
    if (source.publishedDate) {
      try {
        const date = new Date(source.publishedDate)
        if (!Number.isNaN(date.getTime())) {
          publishedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        }
      } catch {
        // Ignore invalid dates
      }
    }

    return `
      <article class="${CSS_PREFIX}-source-card">
        <div class="${CSS_PREFIX}-source-header">
          <a href="${this.sanitizeUrl(source.url)}" target="_blank" rel="noopener noreferrer" class="${CSS_PREFIX}-source-name">
            ${this.escapeHtml(source.name)}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3.5 8.5l5-5M4 3.5h4.5V8" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
          <span class="${CSS_PREFIX}-source-verdict ${CSS_PREFIX}-source-verdict--${verdictClass}">
            ${this.escapeHtml(source.verdict)}
          </span>
        </div>
        ${publishedDate ? `<time class="${CSS_PREFIX}-source-date">${publishedDate}</time>` : ''}
      </article>
    `
  }

  /**
   * Render navigation controls
   */
  private renderNavigation(): string {
    const current = this.state.activeClaimIndex + 1
    const total = this.state.allClaims.length

    return `
      <div class="${CSS_PREFIX}-sidebar-nav">
        <button class="${CSS_PREFIX}-nav-btn" data-direction="prev" aria-label="Previous claim">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="${CSS_PREFIX}-nav-indicator">${current} / ${total}</span>
        <button class="${CSS_PREFIX}-nav-btn" data-direction="next" aria-label="Next claim">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `
  }

  /**
   * Render verify button
   */
  private renderVerifyButton(
    claim: VerifiedClaim,
    isPending: boolean,
    isReVerify: boolean = false
  ): string {
    const buttonLabel = isReVerify ? 'Re-verify Claim' : 'Verify Claim'
    const buttonClass = isReVerify
      ? `${CSS_PREFIX}-verify-btn ${CSS_PREFIX}-verify-btn--secondary`
      : `${CSS_PREFIX}-verify-btn`

    return `
      <div class="${CSS_PREFIX}-verify-section">
        <button
          class="${buttonClass}"
          data-claim-id="${claim.id}"
          ${isPending ? 'disabled' : ''}
        >
          ${
            isPending
              ? `
            <svg class="${CSS_PREFIX}-spinner" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="8" cy="8" r="6" stroke-opacity="0.15"/>
              <path d="M8 2a6 6 0 0 1 6 6" stroke-linecap="round"/>
            </svg>
            Verifying...
          `
              : `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              ${
                isReVerify
                  ? '<path d="M2 8a6 6 0 1 1 1.17 3.5M2 13v-3h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
                  : '<circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 8.5l2 2 3.5-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
              }
            </svg>
            ${buttonLabel}
          `
          }
        </button>
      </div>
    `
  }

  /**
   * Render error state
   */
  private renderErrorState(_claim: VerifiedClaim): string {
    return `
      <div class="${CSS_PREFIX}-error-state">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 8v4M12 16v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p>Verification failed. Please try again.</p>
      </div>
    `
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): string {
    return `
      <div class="${CSS_PREFIX}-sidebar-header">
        <h2 class="${CSS_PREFIX}-sidebar-title">Claim Details</h2>
        <button class="${CSS_PREFIX}-sidebar-close" aria-label="Close sidebar">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="${CSS_PREFIX}-sidebar-content">
        <div class="${CSS_PREFIX}-empty-state">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4"/>
            <path d="M24 16v8M24 32v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p>No claim selected</p>
          <span>Click on a highlighted claim to see details</span>
        </div>
      </div>
    `
  }

  /**
   * Format claim type for display
   */
  private formatClaimType(type: string): string {
    const types: Record<string, string> = {
      factual: 'Factual',
      statistical: 'Statistical',
      attribution: 'Attribution',
      temporal: 'Temporal',
      comparative: 'Comparative',
    }
    return types[type] || 'Claim'
  }

  /**
   * Get verdict class for styling
   */
  private getVerdictClass(verdict: string): string {
    const lower = verdict.toLowerCase()
    if (lower.includes('true') || lower.includes('correct') || lower.includes('accurate')) {
      return 'true'
    }
    if (lower.includes('false') || lower.includes('incorrect') || lower.includes('wrong')) {
      return 'false'
    }
    if (lower.includes('misleading') || lower.includes('partially')) {
      return 'mixed'
    }
    return 'unknown'
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * Validate and sanitize URL to prevent XSS via javascript: URLs
   */
  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url)
      // Only allow http and https schemes
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return this.escapeHtml(url)
      }
      return '#'
    } catch {
      return '#'
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    if (!this.container) return

    // Close button
    const closeBtn = this.container.querySelector(`.${CSS_PREFIX}-sidebar-close`)
    closeBtn?.addEventListener('click', () => this.hide())

    // Verify button
    const verifyBtn = this.container.querySelector(`.${CSS_PREFIX}-verify-btn`)
    verifyBtn?.addEventListener('click', () => {
      if (this.state.activeClaim && !this.state.isVerifying) {
        this.state.isVerifying = true
        this.render()
        this.callbacks.onVerifyRequest?.(this.state.activeClaim.id, this.state.activeClaim)
      }
    })

    // Navigation buttons
    const navBtns = this.container.querySelectorAll(`.${CSS_PREFIX}-nav-btn`)
    navBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const direction = (btn as HTMLElement).dataset.direction as 'prev' | 'next'
        this.navigateClaim(direction)
      })
    })
  }

  /**
   * Set up global event listeners
   */
  private setupGlobalListeners(): void {
    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!this.state.isVisible) return
      const target = e.target as HTMLElement
      if (
        !target.closest(`.${CSS_PREFIX}-sidebar`) &&
        !target.closest(`.${CSS_PREFIX}-claim-highlight`)
      ) {
        this.hide()
      }
    })

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state.isVisible) {
        this.hide()
      }

      // Arrow key navigation - only when focus is inside the sidebar
      // to avoid hijacking ChatGPT's input fields
      if (this.state.isVisible && this.state.allClaims.length > 1) {
        const focusInsideSidebar =
          this.container && document.activeElement?.closest(`.${CSS_PREFIX}-sidebar`)
        if (focusInsideSidebar) {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault()
            this.navigateClaim('prev')
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault()
            this.navigateClaim('next')
          }
        }
      }
    })
  }

  /**
   * Inject sidebar styles
   */
  private injectStyles(): void {
    const style = document.createElement('style')
    style.id = `${CSS_PREFIX}-sidebar-styles`
    style.textContent = `
      /* ============================================
         SIDEBAR - SLIDE-IN PANEL
      ============================================ */

      .${CSS_PREFIX}-sidebar {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 420px;
        max-width: calc(100vw - 48px);
        background: var(--gc-bg-primary, #ffffff);
        box-shadow:
          -16px 0 48px rgba(0, 0, 0, 0.1),
          -4px 0 16px rgba(0, 0, 0, 0.06),
          0 0 1px rgba(0, 0, 0, 0.1);
        z-index: 10002;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        /* Spring-based slide animation */
        transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
        color: var(--gc-text-primary, #1a1f36);
        /* Optimize for animations */
        will-change: transform;
        backface-visibility: hidden;
        /* Subtle border for definition */
        border-left: 1px solid rgba(0, 0, 0, 0.06);
      }

      .${CSS_PREFIX}-sidebar--visible {
        transform: translateX(0);
      }

      /* Backdrop overlay for focus */
      .${CSS_PREFIX}-sidebar::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        right: 420px;
        bottom: 0;
        background: rgba(0, 0, 0, 0.15);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
        z-index: -1;
      }

      .${CSS_PREFIX}-sidebar--visible::before {
        opacity: 1;
        /* Keep pointer-events: none to allow clicks through to dismiss sidebar or interact with chat */
      }

      /* ============================================
         HEADER
      ============================================ */

      .${CSS_PREFIX}-sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--gc-border-primary, #e3e8ef);
        flex-shrink: 0;
      }

      .${CSS_PREFIX}-sidebar-title-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .${CSS_PREFIX}-sidebar-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
        color: var(--gc-text-primary, #1a1f36);
      }

      .${CSS_PREFIX}-sidebar-close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border: none;
        background: transparent;
        border-radius: 10px;
        cursor: pointer;
        color: var(--gc-text-tertiary, #8792a2);
        transition:
          background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
          color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
          transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .${CSS_PREFIX}-sidebar-close:hover {
        background: var(--gc-bg-secondary, #f7f8f9);
        color: var(--gc-text-primary, #1a1f36);
        transform: scale(1.05);
      }

      .${CSS_PREFIX}-sidebar-close:active {
        transform: scale(0.95);
        transition-duration: 50ms;
      }

      .${CSS_PREFIX}-sidebar-close:focus-visible {
        outline: none;
        box-shadow:
          0 0 0 2px var(--gc-bg-primary, #ffffff),
          0 0 0 4px var(--gc-accent-primary, #635bff);
      }

      /* ============================================
         NAVIGATION
      ============================================ */

      .${CSS_PREFIX}-sidebar-nav {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .${CSS_PREFIX}-nav-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: 1px solid var(--gc-border-primary, #e3e8ef);
        background: var(--gc-bg-primary, #ffffff);
        border-radius: 8px;
        cursor: pointer;
        color: var(--gc-text-secondary, #5e6687);
        transition:
          border-color 0.15s ease,
          color 0.15s ease,
          transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
          box-shadow 0.15s ease;
      }

      .${CSS_PREFIX}-nav-btn:hover {
        border-color: var(--gc-accent-primary, #635bff);
        color: var(--gc-accent-primary, #635bff);
        transform: scale(1.05);
        box-shadow: 0 2px 6px rgba(99, 91, 255, 0.15);
      }

      .${CSS_PREFIX}-nav-btn:active {
        transform: scale(0.95);
        transition-duration: 50ms;
      }

      .${CSS_PREFIX}-nav-btn:focus-visible {
        outline: none;
        box-shadow:
          0 0 0 2px var(--gc-bg-primary, #ffffff),
          0 0 0 4px var(--gc-accent-primary, #635bff);
      }

      .${CSS_PREFIX}-nav-indicator {
        font-size: 13px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--gc-text-tertiary, #8792a2);
        min-width: 48px;
        text-align: center;
        letter-spacing: -0.01em;
      }

      /* ============================================
         CONTENT
      ============================================ */

      .${CSS_PREFIX}-sidebar-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }

      /* ============================================
         CLAIM CARD
      ============================================ */

      .${CSS_PREFIX}-claim-card {
        background: var(--gc-bg-secondary, #f7f8f9);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 20px;
      }

      .${CSS_PREFIX}-claim-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .${CSS_PREFIX}-claim-type-badge {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--gc-text-tertiary, #8792a2);
        background: var(--gc-bg-primary, #ffffff);
        padding: 4px 8px;
        border-radius: 4px;
      }

      .${CSS_PREFIX}-claim-text {
        font-size: 15px;
        line-height: 1.6;
        color: var(--gc-text-primary, #1a1f36);
        margin: 0 0 16px 0;
        padding: 0;
        border: none;
        font-style: normal;
      }

      .${CSS_PREFIX}-claim-text::before,
      .${CSS_PREFIX}-claim-text::after {
        content: none;
      }

      /* ============================================
         STATUS BADGE
      ============================================ */

      .${CSS_PREFIX}-status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
        padding: 4px 10px;
        border-radius: 20px;
      }

      .${CSS_PREFIX}-status-badge--verified {
        background: rgba(16, 185, 129, 0.1);
        color: #059669;
      }

      .${CSS_PREFIX}-status-badge--disputed {
        background: rgba(239, 68, 68, 0.1);
        color: #dc2626;
      }

      .${CSS_PREFIX}-status-badge--unverified {
        background: rgba(107, 114, 128, 0.1);
        color: #6b7280;
      }

      .${CSS_PREFIX}-status-badge--pending {
        background: rgba(99, 102, 241, 0.1);
        color: #6366f1;
      }

      .${CSS_PREFIX}-status-badge--error {
        background: rgba(245, 158, 11, 0.1);
        color: #d97706;
      }

      .${CSS_PREFIX}-status-badge--none {
        background: rgba(156, 163, 175, 0.1);
        color: #9ca3af;
      }

      /* ============================================
         CONFIDENCE METER - PREMIUM VISUALIZATION
      ============================================ */

      .${CSS_PREFIX}-confidence-meter {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .${CSS_PREFIX}-confidence-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--gc-text-tertiary, #8792a2);
        min-width: 72px;
        letter-spacing: 0.01em;
      }

      .${CSS_PREFIX}-confidence-bar {
        flex: 1;
        height: 8px;
        background: var(--gc-bg-primary, #ffffff);
        border-radius: 4px;
        overflow: hidden;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
        position: relative;
      }

      /* Subtle track pattern */
      .${CSS_PREFIX}-confidence-bar::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 10%,
            rgba(0, 0, 0, 0.02) 10%,
            rgba(0, 0, 0, 0.02) 20%
          );
        border-radius: 4px;
      }

      .${CSS_PREFIX}-confidence-fill {
        height: 100%;
        background: linear-gradient(90deg, #4f46e5, #6366f1, #818cf8);
        border-radius: 4px;
        transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        box-shadow: 0 1px 3px rgba(99, 102, 241, 0.3);
        position: relative;
      }

      /* Shine effect on fill */
      .${CSS_PREFIX}-confidence-fill::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 50%;
        background: linear-gradient(
          to bottom,
          rgba(255, 255, 255, 0.25),
          transparent
        );
        border-radius: 4px 4px 0 0;
      }

      .${CSS_PREFIX}-confidence-value {
        font-size: 13px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--gc-text-secondary, #5e6687);
        min-width: 40px;
        text-align: right;
        letter-spacing: -0.02em;
      }

      /* ============================================
         SOURCES SECTION
      ============================================ */

      .${CSS_PREFIX}-sources-section {
        margin-bottom: 20px;
      }

      .${CSS_PREFIX}-sources-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        color: var(--gc-text-primary, #1a1f36);
        margin: 0 0 12px 0;
      }

      .${CSS_PREFIX}-sources-count {
        font-size: 11px;
        font-weight: 500;
        background: var(--gc-accent-primary, #635bff);
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
      }

      .${CSS_PREFIX}-sources-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .${CSS_PREFIX}-no-sources {
        font-size: 14px;
        color: var(--gc-text-tertiary, #8792a2);
        margin: 0;
      }

      /* ============================================
         SOURCE CARD - PREMIUM INTERACTIVE DESIGN
      ============================================ */

      .${CSS_PREFIX}-source-card {
        background: var(--gc-bg-primary, #ffffff);
        border: 1px solid var(--gc-border-primary, #e3e8ef);
        border-radius: 12px;
        padding: 14px 16px;
        transition:
          border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
          box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
          transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
        cursor: pointer;
        position: relative;
        overflow: hidden;
      }

      /* Subtle left accent bar */
      .${CSS_PREFIX}-source-card::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--gc-accent-primary, #635bff);
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .${CSS_PREFIX}-source-card:hover {
        border-color: var(--gc-accent-primary, #635bff);
        box-shadow:
          0 4px 12px rgba(99, 91, 255, 0.12),
          0 1px 3px rgba(0, 0, 0, 0.05);
        transform: translateY(-1px);
      }

      .${CSS_PREFIX}-source-card:hover::before {
        opacity: 1;
      }

      .${CSS_PREFIX}-source-card:active {
        transform: translateY(0) scale(0.995);
        transition-duration: 50ms;
      }

      .${CSS_PREFIX}-source-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .${CSS_PREFIX}-source-name {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        font-weight: 600;
        color: var(--gc-accent-primary, #635bff);
        text-decoration: none;
        transition: color 0.15s ease;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .${CSS_PREFIX}-source-name:hover {
        color: #4338ca;
      }

      .${CSS_PREFIX}-source-name svg {
        flex-shrink: 0;
        opacity: 0.7;
        transition: transform 0.2s ease, opacity 0.2s ease;
      }

      .${CSS_PREFIX}-source-name:hover svg {
        transform: translate(2px, -2px);
        opacity: 1;
      }

      .${CSS_PREFIX}-source-verdict {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 4px 10px;
        border-radius: 6px;
        flex-shrink: 0;
      }

      .${CSS_PREFIX}-source-verdict--true {
        background: rgba(5, 150, 105, 0.12);
        color: #059669;
        box-shadow: inset 0 0 0 1px rgba(5, 150, 105, 0.2);
      }

      .${CSS_PREFIX}-source-verdict--false {
        background: rgba(220, 38, 38, 0.12);
        color: #dc2626;
        box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.2);
      }

      .${CSS_PREFIX}-source-verdict--mixed {
        background: rgba(217, 119, 6, 0.12);
        color: #d97706;
        box-shadow: inset 0 0 0 1px rgba(217, 119, 6, 0.2);
      }

      .${CSS_PREFIX}-source-verdict--unknown {
        background: rgba(107, 114, 128, 0.1);
        color: #6b7280;
        box-shadow: inset 0 0 0 1px rgba(107, 114, 128, 0.15);
      }

      .${CSS_PREFIX}-source-date {
        display: block;
        margin-top: 8px;
        font-size: 12px;
        color: var(--gc-text-tertiary, #8792a2);
        font-variant-numeric: tabular-nums;
      }

      /* ============================================
         VERIFY BUTTON
      ============================================ */

      .${CSS_PREFIX}-verify-section {
        margin-top: 20px;
      }

      .${CSS_PREFIX}-verify-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 14px 24px;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: white;
        background: linear-gradient(135deg, var(--gc-accent-primary, #635bff) 0%, #4f46e5 100%);
        border: none;
        border-radius: 12px;
        cursor: pointer;
        box-shadow:
          0 2px 8px rgba(99, 91, 255, 0.25),
          inset 0 1px 0 rgba(255, 255, 255, 0.15);
        transition:
          transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
          box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
          background 0.2s ease;
        position: relative;
        overflow: hidden;
      }

      /* Shimmer effect on hover */
      .${CSS_PREFIX}-verify-btn::after {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.15),
          transparent
        );
        transition: left 0.4s ease;
      }

      .${CSS_PREFIX}-verify-btn:hover:not(:disabled)::after {
        left: 100%;
      }

      .${CSS_PREFIX}-verify-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow:
          0 4px 16px rgba(99, 91, 255, 0.35),
          inset 0 1px 0 rgba(255, 255, 255, 0.2);
      }

      .${CSS_PREFIX}-verify-btn:active:not(:disabled) {
        transform: translateY(0) scale(0.98);
        box-shadow:
          0 1px 4px rgba(99, 91, 255, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);
        transition-duration: 50ms;
      }

      .${CSS_PREFIX}-verify-btn:disabled {
        opacity: 0.65;
        cursor: not-allowed;
        background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
        box-shadow: none;
      }

      .${CSS_PREFIX}-verify-btn:focus-visible {
        outline: none;
        box-shadow:
          0 0 0 3px var(--gc-bg-primary, #ffffff),
          0 0 0 6px var(--gc-accent-primary, #635bff),
          0 4px 16px rgba(99, 91, 255, 0.35);
      }

      /* Secondary style for re-verify button */
      .${CSS_PREFIX}-verify-btn--secondary {
        background: transparent;
        border: 1.5px solid var(--gc-border-primary, #e3e8ef);
        color: var(--gc-text-secondary, #5e6687);
        box-shadow: none;
      }

      .${CSS_PREFIX}-verify-btn--secondary:hover:not(:disabled) {
        background: var(--gc-bg-secondary, #f7f8f9);
        border-color: var(--gc-accent-primary, #635bff);
        color: var(--gc-accent-primary, #635bff);
      }

      .${CSS_PREFIX}-verify-btn--secondary::after {
        display: none;
      }

      /* ============================================
         ERROR STATE
      ============================================ */

      .${CSS_PREFIX}-error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 24px;
        background: rgba(245, 158, 11, 0.05);
        border: 1px solid rgba(245, 158, 11, 0.2);
        border-radius: 10px;
        text-align: center;
        color: #d97706;
        margin-bottom: 20px;
      }

      .${CSS_PREFIX}-error-state p {
        margin: 0;
        font-size: 14px;
      }

      /* ============================================
         EMPTY STATE
      ============================================ */

      .${CSS_PREFIX}-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 48px 24px;
        text-align: center;
        color: var(--gc-text-tertiary, #8792a2);
      }

      .${CSS_PREFIX}-empty-state p {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
        color: var(--gc-text-secondary, #5e6687);
      }

      .${CSS_PREFIX}-empty-state span {
        font-size: 14px;
      }

      /* ============================================
         FOOTER
      ============================================ */

      .${CSS_PREFIX}-sidebar-footer {
        padding: 12px 20px;
        border-top: 1px solid var(--gc-border-primary, #e3e8ef);
        flex-shrink: 0;
      }

      .${CSS_PREFIX}-sidebar-branding {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
        color: var(--gc-text-tertiary, #8792a2);
      }

      /* ============================================
         SPINNER - REFINED ANIMATION
      ============================================ */

      .${CSS_PREFIX}-spinner {
        animation: ${CSS_PREFIX}-spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        transform-origin: center;
      }

      @keyframes ${CSS_PREFIX}-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Loading shimmer for skeleton states */
      .${CSS_PREFIX}-loading-shimmer {
        background: linear-gradient(
          90deg,
          var(--gc-bg-secondary, #f7f8f9) 0%,
          var(--gc-bg-primary, #ffffff) 50%,
          var(--gc-bg-secondary, #f7f8f9) 100%
        );
        background-size: 200% 100%;
        animation: ${CSS_PREFIX}-shimmer-slide 1.5s ease-in-out infinite;
      }

      @keyframes ${CSS_PREFIX}-shimmer-slide {
        0% { background-position: 100% 0; }
        100% { background-position: -100% 0; }
      }

      /* Pulse animation for status indicators */
      .${CSS_PREFIX}-pulse {
        animation: ${CSS_PREFIX}-pulse-glow 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }

      @keyframes ${CSS_PREFIX}-pulse-glow {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }

      /* ============================================
         MOBILE / RESPONSIVE - BOTTOM SHEET BEHAVIOR
      ============================================ */

      @media (max-width: 640px) {
        .${CSS_PREFIX}-sidebar {
          top: auto;
          right: 0;
          left: 0;
          bottom: 0;
          width: 100%;
          max-width: 100%;
          max-height: 90vh;
          border-radius: 24px 24px 0 0;
          transform: translateY(100%);
          box-shadow:
            0 -16px 48px rgba(0, 0, 0, 0.15),
            0 -4px 16px rgba(0, 0, 0, 0.1);
          border-left: none;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
        }

        .${CSS_PREFIX}-sidebar--visible {
          transform: translateY(0);
        }

        /* Hide desktop backdrop on mobile */
        .${CSS_PREFIX}-sidebar::before {
          display: none;
        }

        .${CSS_PREFIX}-sidebar-header {
          padding: 24px 20px 16px;
          position: relative;
        }

        /* Drag handle for bottom sheet */
        .${CSS_PREFIX}-sidebar-header::before {
          content: '';
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 40px;
          height: 5px;
          background: var(--gc-border-primary, #e3e8ef);
          border-radius: 3px;
          opacity: 0.8;
        }

        /* Larger touch targets */
        .${CSS_PREFIX}-sidebar-close {
          width: 44px;
          height: 44px;
        }

        .${CSS_PREFIX}-nav-btn {
          width: 44px;
          height: 44px;
        }

        .${CSS_PREFIX}-verify-btn {
          padding: 16px 24px;
          min-height: 52px;
        }

        /* Better spacing for touch */
        .${CSS_PREFIX}-sidebar-content {
          padding: 16px 20px 24px;
        }

        .${CSS_PREFIX}-source-card {
          padding: 14px 16px;
        }
      }

      /* Extra small screens */
      @media (max-width: 380px) {
        .${CSS_PREFIX}-sidebar {
          max-height: 95vh;
        }

        .${CSS_PREFIX}-sidebar-header {
          padding: 20px 16px 12px;
        }

        .${CSS_PREFIX}-sidebar-content {
          padding: 12px 16px 20px;
        }
      }

      /* ============================================
         DARK MODE
      ============================================ */

      @media (prefers-color-scheme: dark) {
        .${CSS_PREFIX}-sidebar {
          --gc-bg-primary: #1a1f36;
          --gc-bg-secondary: #252b43;
          --gc-text-primary: #f8fafc;
          --gc-text-secondary: #94a3b8;
          --gc-text-tertiary: #64748b;
          --gc-border-primary: #334155;
          --gc-accent-primary: #818cf8;
          box-shadow: -8px 0 30px rgba(0, 0, 0, 0.4);
        }

        .${CSS_PREFIX}-source-card {
          background: var(--gc-bg-secondary);
        }

        .${CSS_PREFIX}-claim-type-badge {
          background: var(--gc-bg-primary);
        }
      }

      /* ============================================
         REDUCED MOTION
      ============================================ */

      @media (prefers-reduced-motion: reduce) {
        .${CSS_PREFIX}-sidebar {
          transition: none;
        }

        .${CSS_PREFIX}-spinner {
          animation: none;
        }
      }
    `
    document.head.appendChild(style)
  }
}
