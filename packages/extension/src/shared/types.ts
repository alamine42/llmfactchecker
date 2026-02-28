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

export type MessageType = 'EXTRACT_CLAIMS' | 'CLAIMS_RESULT' | 'ERROR'
