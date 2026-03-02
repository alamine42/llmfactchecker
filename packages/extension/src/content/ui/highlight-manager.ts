/**
 * Highlight Manager
 *
 * Orchestrates inline highlighting of claims within ChatGPT responses.
 * Handles DOM manipulation, mutation observation, and coordination
 * with the overlay panel.
 */

import type { VerificationResult, VerifiedClaim } from '@/shared/types'
import type {
  ClaimRange,
  HighlightedClaim,
  HighlightEventCallbacks,
  HighlightOptions,
} from './highlight-types'
import { IndicatorBadge } from './indicator-badge'
import { TextPositionMapper } from './text-mapper'

// CSS class prefix
const CSS_PREFIX = 'gc'

// Debounce time for mutation handling
const MUTATION_DEBOUNCE_MS = 100

export class HighlightManager {
  private highlights: Map<string, HighlightedClaim> = new Map()
  private responseHighlights: Map<string, string[]> = new Map() // responseId -> claimIds
  private claims: Map<string, VerifiedClaim> = new Map() // claimId -> claim
  private textMapper: TextPositionMapper
  private observer: MutationObserver | null = null
  private options: HighlightOptions
  private callbacks: HighlightEventCallbacks = {}
  private mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null
  private pendingMutationElements: Set<HTMLElement> = new Set()

  constructor(options: Partial<HighlightOptions> = {}) {
    this.options = {
      showIndicatorBadge: true,
      showUnderline: true,
      autoVerify: false,
      ...options,
    }
    this.textMapper = new TextPositionMapper()
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: HighlightEventCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * Highlight claims in a response element
   */
  highlightClaims(
    responseElement: HTMLElement,
    claims: VerifiedClaim[],
    originalText: string,
    responseId: string
  ): void {
    console.log('[GroundCheck] highlightClaims called with', claims.length, 'claims')

    // Clear existing highlights for this response
    this.clearHighlights(responseId)

    if (claims.length === 0) return

    // Store claims for later reference
    const claimIds: string[] = []
    for (const claim of claims) {
      this.claims.set(claim.id, claim)
      claimIds.push(claim.id)
    }
    this.responseHighlights.set(responseId, claimIds)

    // Find the markdown content container
    const contentElement = responseElement.querySelector('.markdown') as HTMLElement
    if (!contentElement) {
      console.warn('[GroundCheck] Could not find .markdown container in response')
      return
    }
    console.log('[GroundCheck] Found markdown container')

    // Process claims in reverse order of position to avoid offset issues
    const sortedClaims = [...claims].sort((a, b) => {
      const aStart = a.sourceOffset?.start ?? 0
      const bStart = b.sourceOffset?.start ?? 0
      return bStart - aStart // Reverse order
    })

    // Track animation index - reversed so first claim in reading order animates first
    const totalClaims = sortedClaims.length
    for (let i = 0; i < totalClaims; i++) {
      const claim = sortedClaims[i]
      // Reverse the animation index so top-to-bottom reading order gets staggered correctly
      const animationIndex = totalClaims - 1 - i
      this.highlightSingleClaim(contentElement, claim, originalText, animationIndex)
    }

    // Start observing mutations for this element
    this.observeElement(contentElement, responseId)
  }

  /**
   * Highlight a single claim
   */
  private highlightSingleClaim(
    container: HTMLElement,
    claim: VerifiedClaim,
    originalText: string,
    responseClaimIndex: number = 0
  ): void {
    console.log('[GroundCheck] Highlighting claim:', claim.text.slice(0, 50), '...')
    console.log('[GroundCheck] Claim sourceOffset:', claim.sourceOffset)

    // Find the claim in the DOM
    let range: ClaimRange | null = null

    if (claim.sourceOffset) {
      range = this.textMapper.findClaimByOffset(
        container,
        claim.text,
        claim.sourceOffset,
        originalText
      )
      console.log('[GroundCheck] findClaimByOffset result:', range ? 'found' : 'not found')
    }

    // Fall back to fuzzy matching
    if (!range) {
      console.log('[GroundCheck] Trying fuzzy matching...')
      range = this.textMapper.fuzzyFindClaim(container, claim.text)
      console.log('[GroundCheck] fuzzyFindClaim result:', range ? 'found' : 'not found')
    }

    if (!range) {
      console.warn(
        `[GroundCheck] Could not find claim text in DOM: "${claim.text.slice(0, 50)}..."`
      )
      return
    }

    range.claimId = claim.id

    // Create highlight wrapper - pass responseClaimIndex for staggered animation
    const wrapper = this.wrapClaimText(range, claim, responseClaimIndex)
    if (!wrapper) {
      console.warn('[GroundCheck] Could not create wrapper for claim')
      return
    }
    console.log('[GroundCheck] Created wrapper for claim:', claim.id)

    // Create indicator badge
    const badge = new IndicatorBadge(claim)
    badge.onClick((claimId) => {
      console.log('[GroundCheck] Badge clicked for claim:', claimId)
      const c = this.claims.get(claimId)
      if (c) {
        this.callbacks.onClaimClick?.(claimId, c)
      }
    })

    // Insert badge after the wrapper
    const badgeElement = badge.render()
    wrapper.appendChild(badgeElement)
    console.log('[GroundCheck] Badge appended to wrapper')

    // Store highlight reference
    this.highlights.set(claim.id, {
      claimId: claim.id,
      wrapper,
      indicator: badgeElement,
      verification: claim.verification,
    })

    // Add event listeners
    this.setupClaimEventListeners(wrapper, claim)
    console.log('[GroundCheck] Successfully highlighted claim:', claim.id)
  }

  /**
   * Wrap claim text in a highlight span
   * Enhanced with staggered entrance animations and haptic-style feedback
   */
  private wrapClaimText(
    range: ClaimRange,
    claim: VerifiedClaim,
    responseClaimIndex: number = 0
  ): HTMLElement | null {
    try {
      // Create a DOM Range
      const domRange = document.createRange()
      domRange.setStart(range.startNode, range.startOffset)
      domRange.setEnd(range.endNode, range.endOffset)

      // Create wrapper element
      const wrapper = document.createElement('mark')
      wrapper.className = this.getHighlightClasses(claim)
      wrapper.setAttribute('data-claim-id', claim.id)
      wrapper.setAttribute('role', 'mark')
      wrapper.setAttribute('tabindex', '0')

      // Set aria-describedby for accessibility
      const statusDescription = this.getStatusDescription(claim.verification?.status)
      wrapper.setAttribute('aria-label', `Claim: ${claim.text}. ${statusDescription}`)

      // Add staggered entrance animation delay based on position within current response
      // Cap at 400ms so animations remain snappy
      const entranceDelay = Math.min(responseClaimIndex * 80, 400)
      wrapper.style.setProperty('--gc-entrance-delay', `${entranceDelay}ms`)

      // Try surroundContents first (works for same-element ranges)
      try {
        domRange.surroundContents(wrapper)
      } catch {
        // surroundContents fails when range spans multiple elements
        // Use extractContents + appendChild instead
        console.log('[GroundCheck] Using extractContents fallback for cross-element range')

        // Extract the contents (removes them from DOM)
        const contents = domRange.extractContents()

        // Put them in the wrapper
        wrapper.appendChild(contents)

        // Insert the wrapper where the range was
        domRange.insertNode(wrapper)
      }

      // Trigger entrance animation after DOM insertion
      requestAnimationFrame(() => {
        wrapper.classList.add(`${CSS_PREFIX}-claim-highlight--entering`)
        // Remove entrance class after animation completes
        setTimeout(() => {
          wrapper.classList.remove(`${CSS_PREFIX}-claim-highlight--entering`)
        }, 400 + entranceDelay)
      })

      return wrapper
    } catch (error) {
      // Still catch any unexpected errors
      console.warn('[GroundCheck] Could not wrap claim text:', error)
      return null
    }
  }

  /**
   * Get CSS classes for highlight based on verification status
   */
  private getHighlightClasses(claim: VerifiedClaim): string {
    const classes = [`${CSS_PREFIX}-claim-highlight`]

    if (this.options.showUnderline) {
      const status = claim.verification?.status || 'none'
      classes.push(`${CSS_PREFIX}-claim-highlight--${status}`)
    }

    return classes.join(' ')
  }

  /**
   * Get status description for accessibility
   */
  private getStatusDescription(status?: string): string {
    switch (status) {
      case 'pending':
        return 'Verification in progress'
      case 'verified':
        return 'Verified by fact-checkers'
      case 'disputed':
        return 'Disputed by fact-checkers'
      case 'unverified':
        return 'No fact-check found'
      case 'error':
        return 'Verification failed'
      default:
        return 'Click to verify'
    }
  }

  /**
   * Set up event listeners for a highlighted claim
   * Enhanced with micro-interactions and visual feedback
   */
  private setupClaimEventListeners(wrapper: HTMLElement, claim: VerifiedClaim): void {
    // Track interaction state
    let isPressed = false

    // Click handler with ripple effect
    wrapper.addEventListener('click', (e) => {
      e.stopPropagation()
      this.triggerClickFeedback(wrapper, e)
      this.callbacks.onClaimClick?.(claim.id, claim)
    })

    // Enhanced keyboard handler with visual feedback
    wrapper.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        wrapper.classList.add(`${CSS_PREFIX}-claim-highlight--active`)
        this.callbacks.onClaimClick?.(claim.id, claim)
        setTimeout(() => {
          wrapper.classList.remove(`${CSS_PREFIX}-claim-highlight--active`)
        }, 150)
      }
    })

    // Mouse down/up for pressed state
    wrapper.addEventListener('mousedown', () => {
      isPressed = true
      wrapper.classList.add(`${CSS_PREFIX}-claim-highlight--pressed`)
    })

    wrapper.addEventListener('mouseup', () => {
      if (isPressed) {
        isPressed = false
        wrapper.classList.remove(`${CSS_PREFIX}-claim-highlight--pressed`)
      }
    })

    wrapper.addEventListener('mouseleave', () => {
      if (isPressed) {
        isPressed = false
        wrapper.classList.remove(`${CSS_PREFIX}-claim-highlight--pressed`)
      }
      this.callbacks.onClaimHover?.(claim.id, claim, false)
    })

    // Hover handlers with enhanced states
    wrapper.addEventListener('mouseenter', () => {
      this.callbacks.onClaimHover?.(claim.id, claim, true)
    })

    // Touch support for mobile with haptic-style feedback
    wrapper.addEventListener(
      'touchstart',
      () => {
        wrapper.classList.add(`${CSS_PREFIX}-claim-highlight--pressed`)
      },
      { passive: true }
    )

    wrapper.addEventListener(
      'touchend',
      () => {
        wrapper.classList.remove(`${CSS_PREFIX}-claim-highlight--pressed`)
      },
      { passive: true }
    )

    wrapper.addEventListener(
      'touchcancel',
      () => {
        wrapper.classList.remove(`${CSS_PREFIX}-claim-highlight--pressed`)
      },
      { passive: true }
    )
  }

  /**
   * Create subtle click feedback animation
   */
  private triggerClickFeedback(wrapper: HTMLElement, event: MouseEvent): void {
    // Skip on touch devices - they have their own feedback
    if ('ontouchstart' in window) return

    const rect = wrapper.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Create ripple element
    const ripple = document.createElement('span')
    ripple.className = `${CSS_PREFIX}-claim-ripple`
    ripple.style.left = `${x}px`
    ripple.style.top = `${y}px`
    wrapper.appendChild(ripple)

    // Remove after animation
    setTimeout(() => ripple.remove(), 600)
  }

  /**
   * Update verification status for a claim
   */
  updateClaimStatus(claimId: string, verification: VerificationResult): void {
    const highlight = this.highlights.get(claimId)
    if (!highlight) return

    // Update stored claim
    const claim = this.claims.get(claimId)
    if (claim) {
      claim.verification = verification
    }

    // Update wrapper classes
    highlight.wrapper.className = this.getHighlightClasses(
      claim || ({ verification } as VerifiedClaim)
    )

    // Update accessibility label
    const statusDescription = this.getStatusDescription(verification.status)
    highlight.wrapper.setAttribute(
      'aria-label',
      `Claim: ${claim?.text || ''}. ${statusDescription}`
    )

    // Update indicator badge
    const badge = new IndicatorBadge({ ...claim!, verification })
    badge.onClick((id) => {
      const c = this.claims.get(id)
      if (c) {
        this.callbacks.onClaimClick?.(id, c)
      }
    })

    // Replace old badge
    highlight.indicator.remove()
    const newBadge = badge.render()
    highlight.wrapper.appendChild(newBadge)
    highlight.indicator = newBadge
    highlight.verification = verification
  }

  /**
   * Remove all highlights for a response
   */
  clearHighlights(responseId: string): void {
    const claimIds = this.responseHighlights.get(responseId)
    if (!claimIds) return

    for (const claimId of claimIds) {
      this.removeHighlight(claimId)
    }

    this.responseHighlights.delete(responseId)
  }

  /**
   * Remove a single highlight
   */
  private removeHighlight(claimId: string): void {
    const highlight = this.highlights.get(claimId)
    if (!highlight) return

    // Unwrap the content
    const wrapper = highlight.wrapper
    const parent = wrapper.parentNode
    if (parent) {
      // Move all children out of wrapper
      while (wrapper.firstChild) {
        // Skip the badge element
        if (wrapper.firstChild === highlight.indicator) {
          wrapper.removeChild(wrapper.firstChild)
        } else {
          parent.insertBefore(wrapper.firstChild, wrapper)
        }
      }
      parent.removeChild(wrapper)
    }

    this.highlights.delete(claimId)
    this.claims.delete(claimId)
  }

  /**
   * Remove all highlights
   */
  clearAll(): void {
    for (const responseId of this.responseHighlights.keys()) {
      this.clearHighlights(responseId)
    }
    this.stopObserving()
  }

  /**
   * Start observing DOM mutations for an element
   */
  private observeElement(element: HTMLElement, responseId: string): void {
    if (this.observer) {
      // Already observing
      return
    }

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations, responseId)
    })

    this.observer.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  /**
   * Handle DOM mutations (debounced)
   */
  private handleMutations(mutations: MutationRecord[], responseId: string): void {
    // Check if any of our highlights were affected
    let affected = false

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Check if any highlights were removed
        for (const node of Array.from(mutation.removedNodes)) {
          if (
            node instanceof HTMLElement &&
            node.classList?.contains(`${CSS_PREFIX}-claim-highlight`)
          ) {
            affected = true
            break
          }
        }
      }
    }

    if (!affected) return

    // Debounce re-highlighting
    if (this.mutationDebounceTimer) {
      clearTimeout(this.mutationDebounceTimer)
    }

    this.mutationDebounceTimer = setTimeout(() => {
      this.reapplyHighlights(responseId)
    }, MUTATION_DEBOUNCE_MS)
  }

  /**
   * Re-apply highlights after DOM changes
   */
  private reapplyHighlights(responseId: string): void {
    const claimIds = this.responseHighlights.get(responseId)
    if (!claimIds) return

    // Check each highlight for validity
    for (const claimId of claimIds) {
      const highlight = this.highlights.get(claimId)
      if (!highlight) continue

      // If wrapper is no longer in DOM, we need to re-highlight
      if (!highlight.wrapper.isConnected) {
        // Would need to re-find and re-highlight
        // For now, just clean up the reference
        this.highlights.delete(claimId)
      }
    }
  }

  /**
   * Stop observing mutations
   */
  private stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }

    if (this.mutationDebounceTimer) {
      clearTimeout(this.mutationDebounceTimer)
      this.mutationDebounceTimer = null
    }
  }

  /**
   * Get a highlighted claim by ID
   */
  getHighlight(claimId: string): HighlightedClaim | undefined {
    return this.highlights.get(claimId)
  }

  /**
   * Get all claims for a response
   */
  getClaimsForResponse(responseId: string): VerifiedClaim[] {
    const claimIds = this.responseHighlights.get(responseId)
    if (!claimIds) return []

    return claimIds
      .map((id) => this.claims.get(id))
      .filter((c): c is VerifiedClaim => c !== undefined)
  }

  /**
   * Scroll to and focus a specific claim
   */
  focusClaim(claimId: string): void {
    const highlight = this.highlights.get(claimId)
    if (!highlight) return

    highlight.wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlight.wrapper.focus()
  }
}
