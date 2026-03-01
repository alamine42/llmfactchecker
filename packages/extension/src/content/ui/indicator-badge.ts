/**
 * Indicator Badge Component
 *
 * Inline badge showing verification status next to claim text.
 * Uses Shadow DOM for complete style isolation from ChatGPT's CSS.
 */

import type { VerificationResult, VerificationStatus, VerifiedClaim } from '@/shared/types'

export type BadgeStatus = VerificationStatus | 'none'

interface BadgeConfig {
  icon: string
  color: string
  bgColor: string
  tooltip: string
}

const BADGE_CONFIGS: Record<BadgeStatus, BadgeConfig> = {
  pending: {
    icon: `<svg class="gc-badge-spinner" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="8" cy="8" r="6" stroke-opacity="0.25"/>
      <path d="M8 2a6 6 0 0 1 6 6" stroke-linecap="round"/>
    </svg>`,
    color: '#635bff',
    bgColor: 'rgba(99, 91, 255, 0.1)',
    tooltip: 'Checking...',
  },
  verified: {
    icon: `<svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.78 5.28-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06L6.75 9.19l3.97-3.97a.75.75 0 1 1 1.06 1.06Z"/>
    </svg>`,
    color: '#30d158',
    bgColor: 'rgba(48, 209, 88, 0.12)',
    tooltip: 'Verified by fact-checkers',
  },
  disputed: {
    icon: `<svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM6.28 5.22a.75.75 0 0 0-1.06 1.06L6.94 8 5.22 9.72a.75.75 0 1 0 1.06 1.06L8 9.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 8l1.72-1.72a.75.75 0 0 0-1.06-1.06L8 6.94 6.28 5.22Z"/>
    </svg>`,
    color: '#ff453a',
    bgColor: 'rgba(255, 69, 58, 0.12)',
    tooltip: 'Disputed - click for details',
  },
  unverified: {
    icon: `<svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4Zm.75 7.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>
    </svg>`,
    color: '#8792a2',
    bgColor: 'rgba(135, 146, 162, 0.12)',
    tooltip: 'No fact-check found',
  },
  error: {
    icon: `<svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4Zm.75 7.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>
    </svg>`,
    color: '#ff9f0a',
    bgColor: 'rgba(255, 159, 10, 0.12)',
    tooltip: 'Verification failed',
  },
  none: {
    icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="8" cy="8" r="6"/>
    </svg>`,
    color: '#8792a2',
    bgColor: 'transparent',
    tooltip: 'Click to verify',
  },
}

export class IndicatorBadge {
  private shadowHost: HTMLElement
  private shadowRoot: ShadowRoot
  private status: BadgeStatus = 'none'
  private claim: VerifiedClaim

  constructor(claim: VerifiedClaim) {
    this.claim = claim
    this.status = claim.verification?.status || 'none'
    this.shadowHost = document.createElement('span')
    this.shadowRoot = this.shadowHost.attachShadow({ mode: 'open' })
    this.createShadowDOM()
  }

  /**
   * Create Shadow DOM structure with isolated styles
   */
  private createShadowDOM(): void {
    const config = BADGE_CONFIGS[this.status]

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          vertical-align: middle;
          margin-left: 2px;
        }

        .gc-inline-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          background: ${config.bgColor};
          color: ${config.color};
          border: none;
          padding: 0;
          font: inherit;
        }

        .gc-inline-badge:hover {
          transform: scale(1.15);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .gc-inline-badge:focus {
          outline: none;
          box-shadow: 0 0 0 2px ${config.color}40;
        }

        .gc-inline-badge:active {
          transform: scale(1.05);
        }

        .gc-inline-badge svg {
          width: 12px;
          height: 12px;
        }

        .gc-badge-spinner {
          animation: gc-spin 1s linear infinite;
        }

        @keyframes gc-spin {
          to { transform: rotate(360deg); }
        }

        /* Tooltip */
        .gc-badge-tooltip {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          padding: 4px 8px;
          background: #1a1f36;
          color: #fff;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
          border-radius: 4px;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s ease, visibility 0.15s ease;
          pointer-events: none;
          z-index: 10001;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .gc-badge-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 4px solid transparent;
          border-top-color: #1a1f36;
        }

        .gc-badge-wrapper {
          position: relative;
          display: inline-flex;
          z-index: 1000;
        }

        .gc-badge-wrapper:hover .gc-badge-tooltip,
        .gc-inline-badge:focus + .gc-badge-tooltip {
          opacity: 1;
          visibility: visible;
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .gc-inline-badge,
          .gc-badge-tooltip {
            transition: none;
          }
          .gc-badge-spinner {
            animation: none;
          }
        }

        /* Dark mode */
        @media (prefers-color-scheme: dark) {
          .gc-badge-tooltip {
            background: #f5f5f7;
            color: #1a1f36;
          }
          .gc-badge-tooltip::after {
            border-top-color: #f5f5f7;
          }
        }

        /* Touch device: larger targets */
        @media (hover: none) and (pointer: coarse) {
          .gc-inline-badge {
            width: 24px;
            height: 24px;
            min-width: 44px;
            min-height: 44px;
            margin: -14px -14px;
            padding: 14px;
            background-clip: content-box;
          }

          .gc-inline-badge svg {
            width: 14px;
            height: 14px;
          }
        }
      </style>
      <span class="gc-badge-wrapper">
        <button
          class="gc-inline-badge"
          type="button"
          aria-label="${config.tooltip}"
          data-status="${this.status}"
        >
          ${config.icon}
        </button>
        <span class="gc-badge-tooltip" role="tooltip">${config.tooltip}</span>
      </span>
    `
  }

  /**
   * Get the badge element to insert into DOM
   */
  render(): HTMLElement {
    this.shadowHost.className = 'gc-indicator-badge'
    this.shadowHost.setAttribute('data-claim-id', this.claim.id)
    return this.shadowHost
  }

  /**
   * Update badge when verification status changes
   */
  update(verification: VerificationResult): void {
    this.status = verification.status
    this.createShadowDOM() // Re-render with new status
  }

  /**
   * Get current status
   */
  getStatus(): BadgeStatus {
    return this.status
  }

  /**
   * Add click handler
   */
  onClick(handler: (claimId: string) => void): void {
    const button = this.shadowRoot.querySelector('.gc-inline-badge')
    button?.addEventListener('click', (e) => {
      e.stopPropagation()
      handler(this.claim.id)
    })
  }

  /**
   * Focus the badge button for keyboard navigation
   */
  focus(): void {
    const button = this.shadowRoot.querySelector('.gc-inline-badge') as HTMLButtonElement
    button?.focus()
  }

  /**
   * Remove the badge from DOM
   */
  remove(): void {
    this.shadowHost.remove()
  }
}
