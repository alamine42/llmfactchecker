/**
 * Type definitions for inline claim highlighting
 */

import type { VerificationResult, VerifiedClaim } from '@/shared/types'

/**
 * Represents the DOM range for a highlighted claim
 */
export interface ClaimRange {
  claimId: string
  startNode: Text
  startOffset: number
  endNode: Text
  endOffset: number
  originalText: string
}

/**
 * Represents a claim that has been highlighted in the DOM
 */
export interface HighlightedClaim {
  claimId: string
  wrapper: HTMLElement // The <span> wrapping the claim text
  indicator: HTMLElement // The inline badge
  verification?: VerificationResult
}

/**
 * Options for controlling highlight behavior
 */
export interface HighlightOptions {
  showIndicatorBadge: boolean // Show inline [✓] badge
  showUnderline: boolean // Show colored underline
  autoVerify: boolean // Auto-trigger verification on highlight
}

/**
 * Callback interface for highlight events
 */
export interface HighlightEventCallbacks {
  onClaimClick?: (claimId: string, claim: VerifiedClaim) => void
  onClaimHover?: (claimId: string, claim: VerifiedClaim, isHovering: boolean) => void
  onVerificationRequest?: (claimId: string, claim: VerifiedClaim) => void
}

/**
 * Maps response IDs to their highlighted claims
 */
export type ResponseHighlights = Map<string, HighlightedClaim[]>
