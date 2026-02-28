/**
 * Overlay Manager for Fact-Check UI
 *
 * World-class UI with Stripe-level polish, micro-interactions,
 * and optimized experiences for both desktop and mobile.
 */

import type { Claim } from '@/shared/types'

export type IndicatorStatus = 'checking' | 'complete' | 'error'

interface IndicatorState {
  element: HTMLElement
  status: IndicatorStatus
  claims: Claim[]
  panelVisible: boolean
  responseElement: HTMLElement
}

// CSS class prefix for all overlay elements
const CSS_PREFIX = 'gc'

// Inject styles once
let stylesInjected = false

// Detect mobile viewport
function isMobile(): boolean {
  return window.innerWidth < 768 || 'ontouchstart' in window
}

export class OverlayManager {
  private indicators: Map<string, IndicatorState> = new Map()
  private activePanel: string | null = null

  constructor() {
    this.injectStyles()
    this.setupGlobalListeners()
  }

  private setupGlobalListeners(): void {
    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (this.activePanel && !(e.target as HTMLElement).closest(`.${CSS_PREFIX}-wrapper`)) {
        this.hideClaimDetails(this.activePanel)
      }
    })

    // Close panel on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activePanel) {
        this.hideClaimDetails(this.activePanel)
      }
    })

    // Handle viewport resize for responsive behavior
    window.addEventListener('resize', () => {
      if (this.activePanel) {
        this.repositionPanel(this.activePanel)
      }
    })
  }

  showIndicator(element: HTMLElement, id: string, status: IndicatorStatus = 'checking'): void {
    this.removeIndicator(id)

    const indicator = this.createIndicatorElement(id, status)
    this.positionIndicator(element, indicator)

    this.indicators.set(id, {
      element: indicator,
      status,
      claims: [],
      panelVisible: false,
      responseElement: element,
    })

    // Entrance animation
    requestAnimationFrame(() => {
      indicator.classList.add(`${CSS_PREFIX}-indicator--visible`)
    })
  }

  updateIndicator(id: string, status: IndicatorStatus, claims?: Claim[]): void {
    const state = this.indicators.get(id)
    if (!state) return

    const prevStatus = state.status
    state.status = status
    if (claims) state.claims = claims

    // Smooth status transition
    if (prevStatus !== status) {
      state.element.classList.add(`${CSS_PREFIX}-indicator--transitioning`)
      setTimeout(() => {
        this.updateIndicatorElement(state.element, status, claims?.length ?? 0)
        state.element.classList.remove(`${CSS_PREFIX}-indicator--transitioning`)
      }, 150)
    } else {
      this.updateIndicatorElement(state.element, status, claims?.length ?? 0)
    }
  }

  showClaimDetails(id: string, claims: Claim[]): void {
    const state = this.indicators.get(id)
    if (!state) return

    // Close any other open panel first
    if (this.activePanel && this.activePanel !== id) {
      this.hideClaimDetails(this.activePanel)
    }

    this.hideClaimDetails(id)

    state.claims = claims
    state.panelVisible = true
    this.activePanel = id

    const panel = this.createClaimPanel(id, claims)
    const wrapper = state.element.parentElement
    if (wrapper) {
      wrapper.appendChild(panel)
      this.repositionPanel(id)

      // Entrance animation
      requestAnimationFrame(() => {
        panel.classList.add(`${CSS_PREFIX}-panel--visible`)
      })
    }

    // Trap focus in panel for accessibility
    const firstFocusable = panel.querySelector('button')
    firstFocusable?.focus()
  }

  hideClaimDetails(id: string): void {
    const state = this.indicators.get(id)
    if (!state) return

    state.panelVisible = false
    if (this.activePanel === id) this.activePanel = null

    const panel = document.querySelector(`.${CSS_PREFIX}-panel[data-id="${id}"]`) as HTMLElement
    if (panel) {
      panel.classList.remove(`${CSS_PREFIX}-panel--visible`)
      panel.classList.add(`${CSS_PREFIX}-panel--exiting`)
      setTimeout(() => panel.remove(), 200)
    }
  }

  toggleClaimDetails(id: string): void {
    const state = this.indicators.get(id)
    if (!state || state.claims.length === 0) return

    if (state.panelVisible) {
      this.hideClaimDetails(id)
    } else {
      this.showClaimDetails(id, state.claims)
    }
  }

  removeIndicator(id: string): void {
    const state = this.indicators.get(id)
    if (!state) return

    this.hideClaimDetails(id)
    state.element.classList.add(`${CSS_PREFIX}-indicator--exiting`)
    setTimeout(() => {
      state.element.remove()
      this.indicators.delete(id)
    }, 150)
  }

  clear(): void {
    for (const id of this.indicators.keys()) {
      this.removeIndicator(id)
    }
  }

  private repositionPanel(id: string): void {
    const panel = document.querySelector(`.${CSS_PREFIX}-panel[data-id="${id}"]`) as HTMLElement
    const state = this.indicators.get(id)
    if (!panel || !state) return

    const mobile = isMobile()

    if (mobile) {
      // Mobile: bottom sheet style
      panel.classList.add(`${CSS_PREFIX}-panel--mobile`)
      panel.classList.remove(`${CSS_PREFIX}-panel--desktop`)
    } else {
      // Desktop: dropdown style with smart positioning
      panel.classList.add(`${CSS_PREFIX}-panel--desktop`)
      panel.classList.remove(`${CSS_PREFIX}-panel--mobile`)

      // Check if panel would overflow viewport
      const rect = panel.getBoundingClientRect()
      const viewportWidth = window.innerWidth

      if (rect.right > viewportWidth - 16) {
        panel.style.right = '0'
        panel.style.left = 'auto'
      }
      if (rect.left < 16) {
        panel.style.left = '0'
        panel.style.right = 'auto'
      }
    }
  }

  private createIndicatorElement(id: string, status: IndicatorStatus): HTMLElement {
    const indicator = document.createElement('button')
    indicator.className = `${CSS_PREFIX}-indicator ${CSS_PREFIX}-indicator--${status}`
    indicator.setAttribute('data-id', id)
    indicator.setAttribute('aria-label', this.getAriaLabel(status, 0))
    indicator.setAttribute('aria-haspopup', 'dialog')
    indicator.setAttribute('aria-expanded', 'false')

    indicator.addEventListener('click', (e) => {
      e.stopPropagation()
      this.toggleClaimDetails(id)
      indicator.setAttribute(
        'aria-expanded',
        String(this.indicators.get(id)?.panelVisible ?? false)
      )
    })

    indicator.innerHTML = this.getIndicatorContent(status, 0)
    return indicator
  }

  private getAriaLabel(status: IndicatorStatus, count: number): string {
    switch (status) {
      case 'checking':
        return 'Analyzing claims...'
      case 'complete':
        return `${count} claim${count !== 1 ? 's' : ''} found. Click to view.`
      case 'error':
        return 'Error analyzing claims'
    }
  }

  private getIndicatorContent(status: IndicatorStatus, claimCount: number): string {
    switch (status) {
      case 'checking':
        return `<span class="${CSS_PREFIX}-spinner" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
          </svg>
        </span>`
      case 'complete':
        return `<span class="${CSS_PREFIX}-count" aria-hidden="true">${claimCount}</span>
          <span class="${CSS_PREFIX}-icon-check" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
            </svg>
          </span>`
      case 'error':
        return `<span class="${CSS_PREFIX}-icon-error" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM7.25 4.5a.75.75 0 0 1 1.5 0v3.25a.75.75 0 0 1-1.5 0V4.5Zm.75 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>
          </svg>
        </span>`
    }
  }

  private updateIndicatorElement(
    element: HTMLElement,
    status: IndicatorStatus,
    claimCount: number
  ): void {
    element.className = `${CSS_PREFIX}-indicator ${CSS_PREFIX}-indicator--${status} ${CSS_PREFIX}-indicator--visible`
    element.setAttribute('aria-label', this.getAriaLabel(status, claimCount))
    element.innerHTML = this.getIndicatorContent(status, claimCount)
  }

  private positionIndicator(responseElement: HTMLElement, indicator: HTMLElement): void {
    let wrapper = responseElement.querySelector(`.${CSS_PREFIX}-wrapper`) as HTMLElement
    if (!wrapper) {
      wrapper = document.createElement('div')
      wrapper.className = `${CSS_PREFIX}-wrapper`
      responseElement.style.position = 'relative'
      responseElement.appendChild(wrapper)
    }
    wrapper.appendChild(indicator)
  }

  private createClaimPanel(id: string, claims: Claim[]): HTMLElement {
    const panel = document.createElement('div')
    panel.className = `${CSS_PREFIX}-panel`
    panel.setAttribute('data-id', id)
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', `${claims.length} extracted claims`)
    panel.setAttribute('aria-modal', 'true')

    // Header with gradient accent
    const header = document.createElement('header')
    header.className = `${CSS_PREFIX}-panel-header`
    header.innerHTML = `
      <div class="${CSS_PREFIX}-panel-header-content">
        <div class="${CSS_PREFIX}-panel-icon">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="${CSS_PREFIX}-panel-title-group">
          <h2 class="${CSS_PREFIX}-panel-title">Claims Found</h2>
          <span class="${CSS_PREFIX}-panel-subtitle">${claims.length} item${claims.length !== 1 ? 's' : ''} to verify</span>
        </div>
      </div>
      <button class="${CSS_PREFIX}-panel-close" aria-label="Close panel">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/>
        </svg>
      </button>
    `

    const closeBtn = header.querySelector(`.${CSS_PREFIX}-panel-close`)
    closeBtn?.addEventListener('click', () => this.hideClaimDetails(id))

    // Claims list with staggered animations
    const list = document.createElement('ul')
    list.className = `${CSS_PREFIX}-claim-list`

    claims.forEach((claim, index) => {
      const item = this.createClaimItem(claim, index)
      list.appendChild(item)
    })

    // Footer with branding
    const footer = document.createElement('footer')
    footer.className = `${CSS_PREFIX}-panel-footer`
    footer.innerHTML = `
      <span class="${CSS_PREFIX}-panel-brand">
        <svg viewBox="0 0 16 16" fill="currentColor" class="${CSS_PREFIX}-panel-brand-icon">
          <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0ZM5.78 5.22a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l4-4a.75.75 0 1 0-1.06-1.06L7.75 7.19 5.78 5.22Zm5.94 4.5a.75.75 0 1 0-1.06-1.06l-2.5 2.5-1.44-1.44a.75.75 0 1 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3-3Z"/>
        </svg>
        GroundCheck
      </span>
    `

    panel.appendChild(header)
    panel.appendChild(list)
    panel.appendChild(footer)

    return panel
  }

  private createClaimItem(claim: Claim, index: number): HTMLElement {
    const item = document.createElement('li')
    item.className = `${CSS_PREFIX}-claim-item`
    item.style.setProperty('--animation-delay', `${index * 50}ms`)

    const typeConfig = this.getClaimTypeConfig(claim.type)
    const confidenceLevel = this.getConfidenceLevel(claim.confidence)

    item.innerHTML = `
      <div class="${CSS_PREFIX}-claim-header">
        <span class="${CSS_PREFIX}-claim-type ${CSS_PREFIX}-claim-type--${claim.type}" title="${typeConfig.description}">
          <span class="${CSS_PREFIX}-claim-type-icon">${typeConfig.icon}</span>
          <span class="${CSS_PREFIX}-claim-type-label">${typeConfig.label}</span>
        </span>
        <span class="${CSS_PREFIX}-claim-confidence ${CSS_PREFIX}-claim-confidence--${confidenceLevel}" title="Confidence: ${Math.round(claim.confidence * 100)}%">
          <span class="${CSS_PREFIX}-confidence-bar">
            <span class="${CSS_PREFIX}-confidence-fill" style="width: ${claim.confidence * 100}%"></span>
          </span>
          <span class="${CSS_PREFIX}-confidence-value">${Math.round(claim.confidence * 100)}%</span>
        </span>
      </div>
      <p class="${CSS_PREFIX}-claim-text">${this.escapeHtml(claim.text)}</p>
    `

    return item
  }

  private getClaimTypeConfig(type: string): { label: string; icon: string; description: string } {
    const configs: Record<string, { label: string; icon: string; description: string }> = {
      factual: {
        label: 'Factual',
        icon: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4Zm.75 7.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>',
        description: 'A statement of fact that can be verified',
      },
      statistical: {
        label: 'Statistical',
        icon: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M12 2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h8ZM5.5 5a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0v-5a.5.5 0 0 0-.5-.5Zm2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 1 0v-3A.5.5 0 0 0 8 7Zm3 1a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 1 0v-2a.5.5 0 0 0-.5-.5Z"/></svg>',
        description: 'A claim involving numbers or statistics',
      },
      attribution: {
        label: 'Attribution',
        icon: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM6 6.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0V11H7v2.5a.5.5 0 0 1-1 0v-7Z"/></svg>',
        description: 'A claim attributed to a source or person',
      },
      temporal: {
        label: 'Temporal',
        icon: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2ZM1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm7-3.5a.5.5 0 0 1 .5.5v3l2.5 1.5a.5.5 0 0 1-.5.866L8 9V5a.5.5 0 0 1 .5-.5Z"/></svg>',
        description: 'A claim involving dates or time periods',
      },
      comparative: {
        label: 'Comparative',
        icon: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 4.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5Zm0 4a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5Zm0 4a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5Z"/></svg>',
        description: 'A claim comparing two or more things',
      },
    }
    return configs[type] || configs.factual
  }

  private getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.8) return 'high'
    if (confidence >= 0.5) return 'medium'
    return 'low'
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private injectStyles(): void {
    if (stylesInjected) return
    stylesInjected = true

    const style = document.createElement('style')
    style.id = `${CSS_PREFIX}-styles`
    style.textContent = `
      /* ============================================
         DESIGN SYSTEM TOKENS
         Stripe-inspired with custom refinements
      ============================================ */
      :root {
        --gc-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        --gc-font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;

        /* Spacing scale (4px base) */
        --gc-space-1: 4px;
        --gc-space-2: 8px;
        --gc-space-3: 12px;
        --gc-space-4: 16px;
        --gc-space-5: 20px;
        --gc-space-6: 24px;
        --gc-space-8: 32px;

        /* Colors - Light mode */
        --gc-bg-primary: #ffffff;
        --gc-bg-secondary: #f6f8fa;
        --gc-bg-tertiary: #f0f3f6;
        --gc-bg-hover: rgba(0, 0, 0, 0.04);

        --gc-text-primary: #1a1f36;
        --gc-text-secondary: #5e6687;
        --gc-text-tertiary: #8792a2;

        --gc-border-primary: rgba(0, 0, 0, 0.08);
        --gc-border-secondary: rgba(0, 0, 0, 0.05);

        --gc-accent-primary: #635bff;
        --gc-accent-secondary: #0a2540;

        --gc-success: #30d158;
        --gc-success-bg: rgba(48, 209, 88, 0.12);
        --gc-success-border: rgba(48, 209, 88, 0.24);

        --gc-error: #ff453a;
        --gc-error-bg: rgba(255, 69, 58, 0.12);

        --gc-warning: #ff9f0a;
        --gc-warning-bg: rgba(255, 159, 10, 0.12);

        /* Shadows */
        --gc-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
        --gc-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
        --gc-shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.12), 0 3px 10px rgba(0, 0, 0, 0.06);
        --gc-shadow-xl: 0 16px 50px rgba(0, 0, 0, 0.14), 0 6px 20px rgba(0, 0, 0, 0.08);

        /* Transitions */
        --gc-transition-fast: 100ms ease;
        --gc-transition-normal: 200ms ease;
        --gc-transition-slow: 300ms ease;
        --gc-transition-spring: 400ms cubic-bezier(0.34, 1.56, 0.64, 1);

        /* Border radius */
        --gc-radius-sm: 6px;
        --gc-radius-md: 10px;
        --gc-radius-lg: 14px;
        --gc-radius-full: 9999px;
      }

      /* Dark mode overrides */
      @media (prefers-color-scheme: dark) {
        :root {
          --gc-bg-primary: #1c1c1e;
          --gc-bg-secondary: #2c2c2e;
          --gc-bg-tertiary: #3a3a3c;
          --gc-bg-hover: rgba(255, 255, 255, 0.08);

          --gc-text-primary: #f5f5f7;
          --gc-text-secondary: #a1a1a6;
          --gc-text-tertiary: #6e6e73;

          --gc-border-primary: rgba(255, 255, 255, 0.12);
          --gc-border-secondary: rgba(255, 255, 255, 0.06);

          --gc-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2);
          --gc-shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.4), 0 3px 10px rgba(0, 0, 0, 0.3);
          --gc-shadow-xl: 0 16px 50px rgba(0, 0, 0, 0.5), 0 6px 20px rgba(0, 0, 0, 0.4);
        }
      }

      /* ============================================
         WRAPPER & POSITIONING
      ============================================ */
      .${CSS_PREFIX}-wrapper {
        position: absolute;
        top: var(--gc-space-3);
        right: var(--gc-space-3);
        z-index: 10000;
        font-family: var(--gc-font-family);
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      /* ============================================
         INDICATOR BUTTON
      ============================================ */
      .${CSS_PREFIX}-indicator {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: var(--gc-radius-full);
        background: var(--gc-bg-primary);
        color: var(--gc-text-primary);
        font-family: var(--gc-font-family);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        user-select: none;
        box-shadow: var(--gc-shadow-md), inset 0 0 0 1px var(--gc-border-primary);
        opacity: 0;
        transform: scale(0.8) translateY(4px);
        transition:
          transform var(--gc-transition-spring),
          opacity var(--gc-transition-normal),
          box-shadow var(--gc-transition-normal),
          background var(--gc-transition-fast);
      }

      .${CSS_PREFIX}-indicator--visible {
        opacity: 1;
        transform: scale(1) translateY(0);
      }

      .${CSS_PREFIX}-indicator--exiting {
        opacity: 0;
        transform: scale(0.8) translateY(4px);
      }

      .${CSS_PREFIX}-indicator--transitioning {
        transform: scale(0.9);
      }

      .${CSS_PREFIX}-indicator:hover {
        box-shadow: var(--gc-shadow-lg), inset 0 0 0 1px var(--gc-border-primary);
        transform: scale(1.05);
      }

      .${CSS_PREFIX}-indicator:active {
        transform: scale(0.98);
      }

      .${CSS_PREFIX}-indicator:focus-visible {
        outline: none;
        box-shadow:
          var(--gc-shadow-lg),
          inset 0 0 0 1px var(--gc-border-primary),
          0 0 0 3px var(--gc-accent-primary),
          0 0 0 5px rgba(99, 91, 255, 0.25);
      }

      /* Checking state */
      .${CSS_PREFIX}-indicator--checking {
        background: var(--gc-bg-secondary);
      }

      .${CSS_PREFIX}-spinner {
        width: 16px;
        height: 16px;
        color: var(--gc-text-tertiary);
      }

      .${CSS_PREFIX}-spinner svg {
        width: 100%;
        height: 100%;
        animation: ${CSS_PREFIX}-spin 1s linear infinite;
      }

      @keyframes ${CSS_PREFIX}-spin {
        to { transform: rotate(360deg); }
      }

      /* Complete state */
      .${CSS_PREFIX}-indicator--complete {
        background: linear-gradient(135deg, #30d158 0%, #28a745 100%);
        color: white;
        box-shadow:
          var(--gc-shadow-md),
          0 2px 8px rgba(48, 209, 88, 0.35);
      }

      .${CSS_PREFIX}-indicator--complete:hover {
        box-shadow:
          var(--gc-shadow-lg),
          0 4px 12px rgba(48, 209, 88, 0.4);
      }

      .${CSS_PREFIX}-count {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .${CSS_PREFIX}-icon-check {
        display: none;
      }

      /* Error state */
      .${CSS_PREFIX}-indicator--error {
        background: linear-gradient(135deg, #ff453a 0%, #dc3545 100%);
        color: white;
        box-shadow:
          var(--gc-shadow-md),
          0 2px 8px rgba(255, 69, 58, 0.35);
      }

      .${CSS_PREFIX}-icon-error svg {
        width: 16px;
        height: 16px;
      }

      /* ============================================
         PANEL - DESKTOP
      ============================================ */
      .${CSS_PREFIX}-panel {
        position: absolute;
        top: calc(100% + var(--gc-space-2));
        right: 0;
        width: 360px;
        max-height: min(480px, calc(100vh - 120px));
        background: var(--gc-bg-primary);
        border-radius: var(--gc-radius-lg);
        box-shadow: var(--gc-shadow-xl);
        border: 1px solid var(--gc-border-primary);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        opacity: 0;
        transform: translateY(-8px) scale(0.98);
        transform-origin: top right;
        transition:
          opacity var(--gc-transition-normal),
          transform var(--gc-transition-spring);
      }

      .${CSS_PREFIX}-panel--visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      .${CSS_PREFIX}-panel--exiting {
        opacity: 0;
        transform: translateY(-8px) scale(0.98);
        transition:
          opacity var(--gc-transition-fast),
          transform var(--gc-transition-fast);
      }

      /* ============================================
         PANEL - MOBILE (Bottom Sheet)
      ============================================ */
      .${CSS_PREFIX}-panel--mobile {
        position: fixed;
        top: auto;
        right: 0;
        bottom: 0;
        left: 0;
        width: 100%;
        max-height: 70vh;
        border-radius: var(--gc-radius-lg) var(--gc-radius-lg) 0 0;
        transform-origin: bottom center;
        z-index: 10001;
      }

      .${CSS_PREFIX}-panel--mobile::before {
        content: '';
        position: absolute;
        top: var(--gc-space-2);
        left: 50%;
        transform: translateX(-50%);
        width: 36px;
        height: 4px;
        background: var(--gc-text-tertiary);
        border-radius: var(--gc-radius-full);
        opacity: 0.3;
      }

      .${CSS_PREFIX}-panel--mobile .${CSS_PREFIX}-panel-header {
        padding-top: var(--gc-space-6);
      }

      /* ============================================
         PANEL HEADER
      ============================================ */
      .${CSS_PREFIX}-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--gc-space-4) var(--gc-space-4) var(--gc-space-3);
        background: linear-gradient(to bottom, var(--gc-bg-secondary), var(--gc-bg-primary));
        border-bottom: 1px solid var(--gc-border-secondary);
        flex-shrink: 0;
      }

      .${CSS_PREFIX}-panel-header-content {
        display: flex;
        align-items: center;
        gap: var(--gc-space-3);
      }

      .${CSS_PREFIX}-panel-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, var(--gc-accent-primary), #7c3aed);
        border-radius: var(--gc-radius-md);
        color: white;
        box-shadow: 0 2px 8px rgba(99, 91, 255, 0.3);
      }

      .${CSS_PREFIX}-panel-icon svg {
        width: 18px;
        height: 18px;
      }

      .${CSS_PREFIX}-panel-title-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .${CSS_PREFIX}-panel-title {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: var(--gc-text-primary);
        letter-spacing: -0.01em;
      }

      .${CSS_PREFIX}-panel-subtitle {
        font-size: 12px;
        color: var(--gc-text-tertiary);
        font-weight: 500;
      }

      .${CSS_PREFIX}-panel-close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: var(--gc-radius-sm);
        background: transparent;
        color: var(--gc-text-tertiary);
        cursor: pointer;
        transition: all var(--gc-transition-fast);
      }

      .${CSS_PREFIX}-panel-close:hover {
        background: var(--gc-bg-hover);
        color: var(--gc-text-primary);
      }

      .${CSS_PREFIX}-panel-close:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px var(--gc-accent-primary);
      }

      .${CSS_PREFIX}-panel-close svg {
        width: 16px;
        height: 16px;
      }

      /* ============================================
         CLAIMS LIST
      ============================================ */
      .${CSS_PREFIX}-claim-list {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow-y: auto;
        flex: 1;
        overscroll-behavior: contain;
      }

      /* Custom scrollbar */
      .${CSS_PREFIX}-claim-list::-webkit-scrollbar {
        width: 6px;
      }

      .${CSS_PREFIX}-claim-list::-webkit-scrollbar-track {
        background: transparent;
      }

      .${CSS_PREFIX}-claim-list::-webkit-scrollbar-thumb {
        background: var(--gc-text-tertiary);
        border-radius: var(--gc-radius-full);
        opacity: 0.3;
      }

      .${CSS_PREFIX}-claim-list::-webkit-scrollbar-thumb:hover {
        opacity: 0.5;
      }

      /* ============================================
         CLAIM ITEM
      ============================================ */
      .${CSS_PREFIX}-claim-item {
        padding: var(--gc-space-4);
        border-bottom: 1px solid var(--gc-border-secondary);
        opacity: 0;
        transform: translateY(8px);
        animation: ${CSS_PREFIX}-item-enter 0.3s ease forwards;
        animation-delay: var(--animation-delay, 0ms);
      }

      @keyframes ${CSS_PREFIX}-item-enter {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .${CSS_PREFIX}-claim-item:last-child {
        border-bottom: none;
      }

      .${CSS_PREFIX}-claim-item:hover {
        background: var(--gc-bg-hover);
      }

      .${CSS_PREFIX}-claim-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--gc-space-2);
      }

      /* ============================================
         CLAIM TYPE BADGE
      ============================================ */
      .${CSS_PREFIX}-claim-type {
        display: inline-flex;
        align-items: center;
        gap: var(--gc-space-1);
        padding: 3px 8px 3px 6px;
        border-radius: var(--gc-radius-full);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        transition: transform var(--gc-transition-fast);
      }

      .${CSS_PREFIX}-claim-type:hover {
        transform: scale(1.02);
      }

      .${CSS_PREFIX}-claim-type-icon {
        display: flex;
        width: 12px;
        height: 12px;
      }

      .${CSS_PREFIX}-claim-type-icon svg {
        width: 100%;
        height: 100%;
      }

      .${CSS_PREFIX}-claim-type--factual {
        background: #e0e7ff;
        color: #3730a3;
      }

      .${CSS_PREFIX}-claim-type--statistical {
        background: #dcfce7;
        color: #166534;
      }

      .${CSS_PREFIX}-claim-type--attribution {
        background: #fef3c7;
        color: #92400e;
      }

      .${CSS_PREFIX}-claim-type--temporal {
        background: #dbeafe;
        color: #1e40af;
      }

      .${CSS_PREFIX}-claim-type--comparative {
        background: #fce7f3;
        color: #9d174d;
      }

      @media (prefers-color-scheme: dark) {
        .${CSS_PREFIX}-claim-type--factual {
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
        }
        .${CSS_PREFIX}-claim-type--statistical {
          background: rgba(34, 197, 94, 0.2);
          color: #86efac;
        }
        .${CSS_PREFIX}-claim-type--attribution {
          background: rgba(245, 158, 11, 0.2);
          color: #fcd34d;
        }
        .${CSS_PREFIX}-claim-type--temporal {
          background: rgba(59, 130, 246, 0.2);
          color: #93c5fd;
        }
        .${CSS_PREFIX}-claim-type--comparative {
          background: rgba(236, 72, 153, 0.2);
          color: #f9a8d4;
        }
      }

      /* ============================================
         CONFIDENCE INDICATOR
      ============================================ */
      .${CSS_PREFIX}-claim-confidence {
        display: flex;
        align-items: center;
        gap: var(--gc-space-2);
        font-size: 11px;
        font-weight: 500;
        color: var(--gc-text-tertiary);
      }

      .${CSS_PREFIX}-confidence-bar {
        width: 40px;
        height: 4px;
        background: var(--gc-bg-tertiary);
        border-radius: var(--gc-radius-full);
        overflow: hidden;
      }

      .${CSS_PREFIX}-confidence-fill {
        height: 100%;
        border-radius: var(--gc-radius-full);
        transition: width var(--gc-transition-slow);
      }

      .${CSS_PREFIX}-claim-confidence--high .${CSS_PREFIX}-confidence-fill {
        background: linear-gradient(90deg, #30d158, #28a745);
      }

      .${CSS_PREFIX}-claim-confidence--medium .${CSS_PREFIX}-confidence-fill {
        background: linear-gradient(90deg, #ff9f0a, #f59e0b);
      }

      .${CSS_PREFIX}-claim-confidence--low .${CSS_PREFIX}-confidence-fill {
        background: linear-gradient(90deg, #ff453a, #ef4444);
      }

      .${CSS_PREFIX}-confidence-value {
        font-family: var(--gc-font-mono);
        font-size: 10px;
        min-width: 28px;
        text-align: right;
      }

      /* ============================================
         CLAIM TEXT
      ============================================ */
      .${CSS_PREFIX}-claim-text {
        margin: 0;
        font-size: 13px;
        line-height: 1.55;
        color: var(--gc-text-primary);
        word-break: break-word;
      }

      /* ============================================
         PANEL FOOTER
      ============================================ */
      .${CSS_PREFIX}-panel-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--gc-space-3) var(--gc-space-4);
        background: var(--gc-bg-secondary);
        border-top: 1px solid var(--gc-border-secondary);
        flex-shrink: 0;
      }

      .${CSS_PREFIX}-panel-brand {
        display: flex;
        align-items: center;
        gap: var(--gc-space-1);
        font-size: 11px;
        font-weight: 600;
        color: var(--gc-text-tertiary);
        letter-spacing: 0.02em;
      }

      .${CSS_PREFIX}-panel-brand-icon {
        width: 12px;
        height: 12px;
        color: var(--gc-accent-primary);
      }

      /* ============================================
         REDUCED MOTION
      ============================================ */
      @media (prefers-reduced-motion: reduce) {
        .${CSS_PREFIX}-indicator,
        .${CSS_PREFIX}-panel,
        .${CSS_PREFIX}-claim-item,
        .${CSS_PREFIX}-spinner svg {
          animation: none;
          transition: none;
        }

        .${CSS_PREFIX}-indicator--visible {
          opacity: 1;
          transform: none;
        }

        .${CSS_PREFIX}-panel--visible {
          opacity: 1;
          transform: none;
        }

        .${CSS_PREFIX}-claim-item {
          opacity: 1;
          transform: none;
        }
      }

      /* ============================================
         TOUCH DEVICE OPTIMIZATIONS
      ============================================ */
      @media (hover: none) and (pointer: coarse) {
        .${CSS_PREFIX}-indicator {
          width: 40px;
          height: 40px;
        }

        .${CSS_PREFIX}-indicator:hover {
          transform: none;
        }

        .${CSS_PREFIX}-panel-close {
          width: 36px;
          height: 36px;
        }

        .${CSS_PREFIX}-claim-item {
          padding: var(--gc-space-4) var(--gc-space-4);
        }

        .${CSS_PREFIX}-claim-type {
          padding: 4px 10px 4px 8px;
          font-size: 12px;
        }

        .${CSS_PREFIX}-claim-text {
          font-size: 14px;
        }
      }
    `
    document.head.appendChild(style)
  }
}
