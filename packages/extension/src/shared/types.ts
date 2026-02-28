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
