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
      <circle cx="8" cy="8" r="6" stroke-opacity="0.12"/>
      <path d="M8 2a6 6 0 0 1 6 6" stroke-linecap="round" class="gc-spinner-arc"/>
    </svg>`,
    color: '#6366f1',
    glowColor: 'rgba(99, 102, 241, 0.45)',
    bgColor: 'rgba(99, 102, 241, 0.1)',
    bgColorHover: 'rgba(99, 102, 241, 0.18)',
    bgColorActive: 'rgba(99, 102, 241, 0.26)',
    tooltip: 'Verifying claim...',
    ringColor: 'rgba(99, 102, 241, 0.25)',
  },
  verified: {
    icon: `<svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.1"/>
      <path d="M5.5 8.5l2 2 3.5-4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="gc-check-path"/>
    </svg>`,
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    bgColorHover: 'rgba(16, 185, 129, 0.2)',
    bgColorActive: 'rgba(16, 185, 129, 0.28)',
    tooltip: 'Verified by fact-checkers',
    ringColor: 'rgba(16, 185, 129, 0.3)',
  },
  disputed: {
    icon: `<svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.1"/>
      <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" class="gc-x-path"/>
    </svg>`,
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.4)',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    bgColorHover: 'rgba(239, 68, 68, 0.2)',
    bgColorActive: 'rgba(239, 68, 68, 0.28)',
    tooltip: 'Disputed claim',
    ringColor: 'rgba(239, 68, 68, 0.3)',
  },
  unverified: {
    icon: `<svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.06"/>
      <path d="M8 5v3.5M8 11v.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    </svg>`,
    color: '#6b7280',
    glowColor: 'rgba(107, 114, 128, 0.3)',
    bgColor: 'rgba(107, 114, 128, 0.1)',
    bgColorHover: 'rgba(107, 114, 128, 0.18)',
    bgColorActive: 'rgba(107, 114, 128, 0.25)',
    tooltip: 'No fact-check found',
    ringColor: 'rgba(107, 114, 128, 0.2)',
  },
  error: {
    icon: `<svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.08"/>
      <path d="M8 5v4M8 11v.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    </svg>`,
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    bgColorHover: 'rgba(245, 158, 11, 0.2)',
    bgColorActive: 'rgba(245, 158, 11, 0.28)',
    tooltip: 'Verification failed - tap to retry',
    ringColor: 'rgba(245, 158, 11, 0.3)',
  },
  none: {
    icon: `<svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.25" stroke-dasharray="3 2.5" opacity="0.6" class="gc-dashed-circle"/>
      <circle cx="8" cy="8" r="2.5" fill="currentColor" opacity="0.35"/>
    </svg>`,
    color: '#8b5cf6',
    glowColor: 'rgba(139, 92, 246, 0.25)',
    bgColor: 'rgba(139, 92, 246, 0.08)',
    bgColorHover: 'rgba(139, 92, 246, 0.15)',
    bgColorActive: 'rgba(139, 92, 246, 0.22)',
    tooltip: 'Tap to verify this claim',
    ringColor: 'rgba(139, 92, 246, 0.2)',
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
           DESIGN TOKENS - STRIPE-LEVEL REFINEMENT
           Premium spring physics and visual hierarchy
        ============================================ */
        :host {
          /* Size tokens - 8px grid system */
          --gc-badge-size: 20px;
          --gc-badge-icon-size: 14px;

          /* Spring-based easing for natural motion */
          --gc-spring-smooth: cubic-bezier(0.4, 0, 0.2, 1);
          --gc-spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
          --gc-spring-snappy: cubic-bezier(0.22, 1, 0.36, 1);
          --gc-spring-gentle: cubic-bezier(0.25, 0.46, 0.45, 0.94);

          /* Timing tokens */
          --gc-duration-instant: 100ms;
          --gc-duration-fast: 150ms;
          --gc-duration-normal: 200ms;
          --gc-duration-slow: 300ms;
          --gc-duration-enter: 400ms;

          display: inline-flex;
          vertical-align: middle;
          margin-left: 4px;
          position: relative;
          /* Prevent layout shift during animations */
          contain: layout style;
        }

        /* ============================================
           BADGE BUTTON - PREMIUM DESKTOP EXPERIENCE
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
          /* Multi-property transition with spring physics */
          transition:
            transform var(--gc-duration-fast) var(--gc-spring-bounce),
            box-shadow var(--gc-duration-normal) var(--gc-spring-smooth),
            background-color var(--gc-duration-instant) var(--gc-spring-smooth);
          will-change: transform, box-shadow;
          /* Hardware acceleration */
          transform: translateZ(0);
          backface-visibility: hidden;
        }

        /* Glow ring for depth and premium feel */
        .gc-inline-badge::before {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          background: radial-gradient(circle, ${config.glowColor} 0%, transparent 70%);
          opacity: 0;
          transition: opacity var(--gc-duration-normal) var(--gc-spring-smooth);
          z-index: -1;
          pointer-events: none;
        }

        /* Interactive pulse ring for clickable states - refined animation */
        ${
          isInteractive
            ? `
        .gc-inline-badge::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1.5px dashed ${config.color};
          opacity: 0.35;
          animation: gc-pulse-ring 2.5s var(--gc-spring-gentle) infinite;
          pointer-events: none;
        }
        `
            : ''
        }

        /* Desktop hover - lift and glow */
        .gc-inline-badge:hover {
          transform: scale(1.15) translateY(-1px);
          background: ${config.bgColorHover};
          box-shadow: 0 4px 12px ${config.glowColor};
        }

        .gc-inline-badge:hover::before {
          opacity: 1;
        }

        .gc-inline-badge:focus {
          outline: none;
        }

        /* Premium focus ring with offset */
        .gc-inline-badge:focus-visible {
          box-shadow:
            0 0 0 2.5px white,
            0 0 0 5px ${config.color},
            0 4px 12px ${config.glowColor};
        }

        /* Active/pressed state - quick scale down */
        .gc-inline-badge:active {
          transform: scale(0.95);
          transition-duration: 50ms;
          background: ${config.bgColorActive};
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
          animation: gc-draw-check 0.4s var(--gc-spring-smooth) 0.1s forwards;
        }

        @keyframes gc-draw-check {
          to { stroke-dashoffset: 0; }
        }

        /* X mark animation */
        .gc-x-path {
          stroke-dasharray: 6;
          stroke-dashoffset: 6;
          animation: gc-draw-x 0.3s var(--gc-spring-smooth) forwards;
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
           TOOLTIP - PREMIUM STRIPE-STYLE
        ============================================ */
        .gc-badge-tooltip {
          position: absolute;
          bottom: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%) translateY(6px) scale(0.96);
          padding: 8px 12px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: #f1f5f9;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.01em;
          line-height: 1.4;
          white-space: nowrap;
          border-radius: 8px;
          opacity: 0;
          visibility: hidden;
          transition:
            opacity var(--gc-duration-normal) var(--gc-spring-snappy),
            transform var(--gc-duration-normal) var(--gc-spring-snappy),
            visibility 0ms linear var(--gc-duration-normal);
          pointer-events: none;
          z-index: 10001;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
          box-shadow:
            0 8px 24px rgba(0, 0, 0, 0.2),
            0 2px 6px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px) saturate(1.2);
          -webkit-backdrop-filter: blur(12px) saturate(1.2);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        /* Tooltip arrow - refined with pseudo shadow */
        .gc-badge-tooltip::before {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: rgba(0, 0, 0, 0.1);
          filter: blur(1px);
        }

        .gc-badge-tooltip::after {
          content: '';
          position: absolute;
          top: calc(100% - 1px);
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: #16213e;
        }

        /* Status indicator dot in tooltip - enhanced glow */
        .gc-tooltip-status {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: ${config.color};
          margin-right: 8px;
          vertical-align: middle;
          box-shadow:
            0 0 8px ${config.glowColor},
            inset 0 1px 1px rgba(255, 255, 255, 0.3);
          animation: ${this.status === 'pending' ? 'gc-status-pulse 1.5s ease-in-out infinite' : 'none'};
        }

        @keyframes gc-status-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.9); }
        }

        .gc-badge-wrapper {
          position: relative;
          display: inline-flex;
          z-index: 1000;
        }

        /* Tooltip entrance with spring physics */
        .gc-badge-wrapper:hover .gc-badge-tooltip,
        .gc-inline-badge:focus-visible + .gc-badge-tooltip {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0) scale(1);
          transition-delay: 80ms, 80ms, 0ms;
        }

        /* ============================================
           ENTRANCE ANIMATION - PREMIUM SPRING
        ============================================ */
        :host {
          animation: gc-badge-enter var(--gc-duration-enter) var(--gc-spring-bounce);
        }

        @keyframes gc-badge-enter {
          0% {
            opacity: 0;
            transform: scale(0.3) rotate(-8deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.08) rotate(2deg);
          }
          70% {
            transform: scale(0.95) rotate(-1deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0);
          }
        }

        /* Success celebration animation for verified state */
        ${
          this.status === 'verified'
            ? `
        :host {
          animation: gc-badge-enter var(--gc-duration-enter) var(--gc-spring-bounce),
                     gc-success-glow 1s ease-out 0.3s;
        }

        @keyframes gc-success-glow {
          0% { filter: drop-shadow(0 0 0 transparent); }
          30% { filter: drop-shadow(0 0 12px ${config.glowColor}); }
          100% { filter: drop-shadow(0 0 0 transparent); }
        }
        `
            : ''
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
           MOBILE / TOUCH OPTIMIZATION - 44px TARGETS
        ============================================ */
        @media (hover: none) and (pointer: coarse) {
          :host {
            /* Larger visual badge for touch */
            --gc-badge-size: 24px;
            --gc-badge-icon-size: 16px;
            margin-left: 6px;
          }

          /* Invisible touch target expansion to 44px minimum */
          .gc-inline-badge {
            position: relative;
          }

          .gc-inline-badge::before {
            content: '';
            position: absolute;
            /* Expands to ~44px touch target */
            inset: -10px;
            background: transparent;
            border-radius: 50%;
            /* Ensure touch target is always reachable */
            min-width: 44px;
            min-height: 44px;
          }

          /* Disable hover states on touch devices */
          .gc-inline-badge:hover {
            transform: none;
            background: ${config.bgColor};
            box-shadow: none;
          }

          .gc-inline-badge:hover::before {
            opacity: 0;
          }

          /* Active state for touch feedback - haptic feel */
          .gc-inline-badge:active {
            transform: scale(0.88);
            background: ${config.bgColorActive};
            transition-duration: 50ms;
          }

          /* Tooltip adjustments for mobile */
          .gc-badge-tooltip {
            font-size: 13px;
            padding: 10px 16px;
            border-radius: 10px;
            /* Position higher on mobile to avoid finger */
            bottom: calc(100% + 14px);
          }

          /* Disable pulse animation on mobile for battery */
          .gc-inline-badge::after {
            animation: none;
            opacity: 0.25;
          }
        }

        /* ============================================
           SMALL SCREENS - COMPACT MODE
        ============================================ */
        @media (max-width: 480px) {
          :host {
            --gc-badge-size: 22px;
            --gc-badge-icon-size: 14px;
          }

          .gc-badge-tooltip {
            max-width: 200px;
            white-space: normal;
            text-align: center;
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
