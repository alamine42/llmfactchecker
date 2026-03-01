export interface HealthResponse {
  status: 'ok' | 'error'
  service: string
  timestamp?: string
  version?: string
}

export interface Message {
  type: string
  payload?: unknown
}

export interface MessageResponse {
  status: 'ok' | 'error'
  data?: unknown
  error?: string
}

// Claim types for fact-checking
export type ClaimType = 'factual' | 'statistical' | 'attribution' | 'temporal' | 'comparative'

export interface Claim {
  id: string
  text: string
  type: ClaimType
  confidence: number
  sourceOffset?: { start: number; end: number }
}

export interface ExtractClaimsRequest {
  text: string
  source: 'chatgpt' | 'claude'
  responseId?: string
}

export interface ExtractClaimsResponse {
  claims: Claim[]
  processingTime?: number
}

export type MessageType = 'EXTRACT_CLAIMS' | 'CLAIMS_RESULT' | 'VERIFY_CLAIM' | 'ERROR'

// Verification types
export type VerificationStatus = 'pending' | 'verified' | 'disputed' | 'unverified' | 'error'

export interface VerificationSource {
  name: string // "PolitiFact", "Snopes"
  url: string // Link to fact-check article
  verdict: string // "True", "False", "Misleading"
  publishedDate?: string | null
}

export interface VerificationResult {
  status: VerificationStatus
  sources: VerificationSource[]
  confidence: number // 0-1 aggregated
  verifiedAt: string
}

export interface VerifiedClaim extends Claim {
  verification?: VerificationResult
}

export interface VerifyClaimRequest {
  claimId: string
  claimText: string
  claimType: ClaimType
}

export interface VerifyClaimResponse {
  claimId: string
  verification: VerificationResult
}
