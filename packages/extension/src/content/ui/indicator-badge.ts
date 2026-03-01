/**
 * Indicator Badge Component
 *
 * Premium inline badge showing verification status next to claim text.
 * Uses Shadow DOM for complete style isolation from ChatGPT's CSS.
 *
 * Design: Refined luxury aesthetic with sophisticated micro-interactions.
 * Inspired by Stripe's precision and Linear's elegance.
 */

import type { VerificationResult, VerificationStatus, VerifiedClaim } from '@/shared/types'

export type BadgeStatus = VerificationStatus | 'none'

interface BadgeConfig {
  icon: string
  color: string
  glowColor: string
  bgColor: string
  bgColorHover: string
  bgColorActive: string
  tooltip: string
  ringColor: string
}

const BADGE_CONFIGS: Record<BadgeStatus, BadgeConfig> = {
  pending: {
    icon: `<svg class="gc-badge-spinner" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="8" cy="8" r="6" stroke-opacity="0.15"/>
      <path d="M8 2a6 6 0 0 1 6 6" stroke-linecap="round" class="gc-spinner-arc"/>
    </svg>`,
    color: '#6366f1',
    glowColor: 'rgba(99, 102, 241, 0.4)',
    bgColor: 'rgba(99, 102, 241, 0.08)',
    bgColorHover: 'rgba(99, 102, 241, 0.15)',
    bgColorActive: 'rgba(99, 102, 241, 0.22)',
    tooltip: 'Verifying claim...',
    ringColor: 'rgba(99, 102, 241, 0.2)',
  },
  verified: {
    icon: `<svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.12"/>
      <path d="M5.5 8.5l2 2 3.5-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="gc-check-path"/>
    </svg>`,
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.35)',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    bgColorHover: 'rgba(16, 185, 129, 0.18)',
    bgColorActive: 'rgba(16, 185, 129, 0.25)',
    tooltip: 'Verified by fact-checkers',
    ringColor: 'rgba(16, 185, 129, 0.25)',
  },
  disputed: {
    icon: `<svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.12"/>
      <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" class="gc-x-path"/>
    </svg>`,
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.35)',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    bgColorHover: 'rgba(239, 68, 68, 0.18)',
    bgColorActive: 'rgba(239, 68, 68, 0.25)',
    tooltip: 'Disputed claim',
    ringColor: 'rgba(239, 68, 68, 0.25)',
  },
  unverified: {
    icon: `<svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.08"/>
      <path d="M8 5v3.5M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    color: '#6b7280',
    glowColor: 'rgba(107, 114, 128, 0.25)',
    bgColor: 'rgba(107, 114, 128, 0.08)',
    bgColorHover: 'rgba(107, 114, 128, 0.15)',
    bgColorActive: 'rgba(107, 114, 128, 0.22)',
    tooltip: 'No fact-check found',
    ringColor: 'rgba(107, 114, 128, 0.15)',
  },
  error: {
    icon: `<svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.1"/>
      <path d="M8 5v4M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.35)',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    bgColorHover: 'rgba(245, 158, 11, 0.18)',
    bgColorActive: 'rgba(245, 158, 11, 0.25)',
    tooltip: 'Verification failed',
    ringColor: 'rgba(245, 158, 11, 0.25)',
  },
  none: {
    icon: `<svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.25" stroke-dasharray="2 2" opacity="0.5"/>
      <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.4"/>
    </svg>`,
    color: '#9ca3af',
    glowColor: 'rgba(156, 163, 175, 0.2)',
    bgColor: 'rgba(156, 163, 175, 0.06)',
    bgColorHover: 'rgba(156, 163, 175, 0.12)',
    bgColorActive: 'rgba(156, 163, 175, 0.18)',
    tooltip: 'Click to verify',
    ringColor: 'rgba(156, 163, 175, 0.15)',
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
   * Premium design with sophisticated micro-interactions
   */
  private createShadowDOM(): void {
    const config = BADGE_CONFIGS[this.status]
    const isInteractive = this.status === 'none' || this.status === 'error'

    this.shadowRoot.innerHTML = `
      <style>
        /* ============================================
           DESIGN TOKENS
           Refined luxury palette
        ============================================ */
        :host {
          --gc-badge-size: 18px;
          --gc-badge-icon-size: 14px;
          --gc-transition-smooth: cubic-bezier(0.4, 0, 0.2, 1);
          --gc-transition-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
          --gc-transition-fast: 150ms;
          --gc-transition-normal: 250ms;

          display: inline-flex;
          vertical-align: middle;
          margin-left: 3px;
          position: relative;
        }

        /* ============================================
           BADGE BUTTON - DESKTOP
        ============================================ */
        .gc-inline-badge {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: var(--gc-badge-size);
          height: var(--gc-badge-size);
          border-radius: 50%;
          cursor: pointer;
          border: none;
          padding: 0;
          font: inherit;
          background: ${config.bgColor};
          color: ${config.color};
          transition:
            transform var(--gc-transition-fast) var(--gc-transition-bounce),
            box-shadow var(--gc-transition-normal) var(--gc-transition-smooth),
            background-color var(--gc-transition-fast) var(--gc-transition-smooth);
          will-change: transform;
        }

        /* Subtle ring for depth */
        .gc-inline-badge::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 50%;
          background: ${config.ringColor};
          opacity: 0;
          transition: opacity var(--gc-transition-fast) var(--gc-transition-smooth);
          z-index: -1;
        }

        /* Interactive pulse ring for clickable states */
        ${
          isInteractive
            ? `
        .gc-inline-badge::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 1.5px dashed ${config.color};
          opacity: 0.3;
          animation: gc-pulse-ring 2s ease-in-out infinite;
        }
        `
            : ''
        }

        .gc-inline-badge:hover {
          transform: scale(1.12);
          background: ${config.bgColorHover};
        }

        .gc-inline-badge:hover::before {
          opacity: 1;
        }

        .gc-inline-badge:focus {
          outline: none;
        }

        .gc-inline-badge:focus-visible {
          box-shadow:
            0 0 0 2px white,
            0 0 0 4px ${config.color};
        }

        .gc-inline-badge:active {
          transform: scale(1.02);
          transition-duration: 50ms;
        }

        /* ============================================
           ICONS
        ============================================ */
        .gc-inline-badge svg {
          width: var(--gc-badge-icon-size);
          height: var(--gc-badge-icon-size);
          flex-shrink: 0;
        }

        /* Checkmark draw animation */
        .gc-check-path {
          stroke-dasharray: 12;
          stroke-dashoffset: 12;
          animation: gc-draw-check 0.4s var(--gc-transition-smooth) 0.1s forwards;
        }

        @keyframes gc-draw-check {
          to { stroke-dashoffset: 0; }
        }

        /* X mark animation */
        .gc-x-path {
          stroke-dasharray: 6;
          stroke-dashoffset: 6;
          animation: gc-draw-x 0.3s var(--gc-transition-smooth) forwards;
        }

        @keyframes gc-draw-x {
          to { stroke-dashoffset: 0; }
        }

        /* Spinner with smooth arc */
        .gc-badge-spinner {
          animation: gc-spin 0.9s linear infinite;
        }

        .gc-spinner-arc {
          stroke-linecap: round;
        }

        @keyframes gc-spin {
          to { transform: rotate(360deg); }
        }

        /* Pulse ring for interactive badges */
        @keyframes gc-pulse-ring {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.15;
            transform: scale(1.1);
          }
        }

        /* ============================================
           TOOLTIP - REFINED
        ============================================ */
        .gc-badge-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%) translateY(4px);
          padding: 6px 10px;
          background: linear-gradient(135deg, #1e1e2e 0%, #2d2d3d 100%);
          color: #f8fafc;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.01em;
          white-space: nowrap;
          border-radius: 6px;
          opacity: 0;
          visibility: hidden;
          transition:
            opacity var(--gc-transition-fast) var(--gc-transition-smooth),
            transform var(--gc-transition-fast) var(--gc-transition-smooth),
            visibility var(--gc-transition-fast);
          pointer-events: none;
          z-index: 10001;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
          box-shadow:
            0 4px 12px rgba(0, 0, 0, 0.15),
            0 1px 3px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        /* Tooltip arrow */
        .gc-badge-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: #2d2d3d;
          filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
        }

        /* Status indicator dot in tooltip */
        .gc-tooltip-status {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${config.color};
          margin-right: 6px;
          vertical-align: middle;
          box-shadow: 0 0 6px ${config.glowColor};
        }

        .gc-badge-wrapper {
          position: relative;
          display: inline-flex;
          z-index: 1000;
        }

        .gc-badge-wrapper:hover .gc-badge-tooltip,
        .gc-inline-badge:focus-visible + .gc-badge-tooltip {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }

        /* ============================================
           ENTRANCE ANIMATION
        ============================================ */
        :host {
          animation: gc-badge-enter 0.3s var(--gc-transition-bounce);
        }

        @keyframes gc-badge-enter {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* ============================================
           REDUCED MOTION
        ============================================ */
        @media (prefers-reduced-motion: reduce) {
          :host {
            animation: none;
          }
          .gc-inline-badge,
          .gc-badge-tooltip {
            transition: none;
          }
          .gc-badge-spinner,
          .gc-check-path,
          .gc-x-path {
            animation: none;
          }
          .gc-check-path,
          .gc-x-path {
            stroke-dashoffset: 0;
          }
          .gc-inline-badge::after {
            animation: none;
          }
        }

        /* ============================================
           DARK MODE REFINEMENTS
        ============================================ */
        @media (prefers-color-scheme: dark) {
          .gc-badge-tooltip {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            color: #1e1e2e;
          }
          .gc-badge-tooltip::after {
            border-top-color: #e2e8f0;
          }
          .gc-inline-badge:focus-visible {
            box-shadow:
              0 0 0 2px #1e1e2e,
              0 0 0 4px ${config.color};
          }
        }

        /* ============================================
           MOBILE / TOUCH OPTIMIZATION
        ============================================ */
        @media (hover: none) and (pointer: coarse) {
          :host {
            --gc-badge-size: 22px;
            --gc-badge-icon-size: 16px;
            margin-left: 4px;
          }

          /* Invisible touch target expansion */
          .gc-inline-badge {
            position: relative;
          }

          .gc-inline-badge::before {
            content: '';
            position: absolute;
            inset: -12px;
            background: transparent;
            border-radius: 50%;
          }

          /* Disable hover states on touch */
          .gc-inline-badge:hover {
            transform: none;
            background: ${config.bgColor};
          }

          /* Active state for touch feedback */
          .gc-inline-badge:active {
            transform: scale(0.92);
            background: ${config.bgColorActive};
          }

          /* Tooltip appears on focus for touch */
          .gc-badge-tooltip {
            font-size: 13px;
            padding: 8px 14px;
            border-radius: 8px;
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
        <span class="gc-badge-tooltip" role="tooltip">
          <span class="gc-tooltip-status"></span>${config.tooltip}
        </span>
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
