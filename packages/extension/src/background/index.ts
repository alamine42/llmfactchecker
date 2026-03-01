import * as Sentry from '@sentry/browser'
import { config } from '@/shared/config'
import type {
  ExtractClaimsRequest,
  ExtractClaimsResponse,
  VerifyClaimRequest,
  VerifyClaimResponse,
  MessageType,
  MessageResponse,
} from '@/shared/types'

// Initialize Sentry for error tracking (disable console breadcrumbs to prevent leaking chat data)
if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.env,
    release: `groundcheck@${chrome.runtime.getManifest().version}`,
    integrations: (defaults) => defaults.filter((i) => i.name !== 'Breadcrumbs'),
    beforeSend(event) {
      // Scrub any potential sensitive data from error reports
      if (event.extra) {
        delete event.extra.message
      }
      return event
    },
  })
}

if (config.isDev) {
  console.log('[GroundCheck] Background service worker loaded')
}

// Rate limiting: max 10 extract requests per minute per tab
// Uses chrome.storage.session to persist state across service worker restarts
const EXTRACT_RATE_LIMIT_MAX = 10
const EXTRACT_RATE_LIMIT_WINDOW_MS = 60 * 1000
const EXTRACT_RATE_LIMIT_STORAGE_KEY = 'extractRateLimits'

// Rate limiting: max 5 verify requests per minute per tab
const VERIFY_RATE_LIMIT_MAX = 5
const VERIFY_RATE_LIMIT_WINDOW_MS = 60 * 1000
const VERIFY_RATE_LIMIT_STORAGE_KEY = 'verifyRateLimits'

interface RateLimitEntry {
  count: number
  windowStart: number
}

interface RateLimitStorage {
  [tabId: string]: RateLimitEntry
}

async function checkRateLimit(
  tabId: number,
  storageKey: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now()
  const key = String(tabId)

  try {
    const result = await chrome.storage.session.get(storageKey)
    const storage: RateLimitStorage = result[storageKey] || {}
    const entry = storage[key]

    if (!entry || now - entry.windowStart > windowMs) {
      // Start new window
      storage[key] = { count: 1, windowStart: now }
      await chrome.storage.session.set({ [storageKey]: storage })
      return true
    }

    if (entry.count >= maxRequests) {
      return false
    }

    entry.count++
    await chrome.storage.session.set({ [storageKey]: storage })
    return true
  } catch {
    // If storage fails, allow the request but log in dev
    if (config.isDev) {
      console.warn('[GroundCheck] Rate limit storage error, allowing request')
    }
    return true
  }
}

async function checkExtractRateLimit(tabId: number): Promise<boolean> {
  return checkRateLimit(
    tabId,
    EXTRACT_RATE_LIMIT_STORAGE_KEY,
    EXTRACT_RATE_LIMIT_MAX,
    EXTRACT_RATE_LIMIT_WINDOW_MS
  )
}

async function checkVerifyRateLimit(tabId: number): Promise<boolean> {
  return checkRateLimit(
    tabId,
    VERIFY_RATE_LIMIT_STORAGE_KEY,
    VERIFY_RATE_LIMIT_MAX,
    VERIFY_RATE_LIMIT_WINDOW_MS
  )
}

// Clean up rate limit entries for closed tabs
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const extractResult = await chrome.storage.session.get(EXTRACT_RATE_LIMIT_STORAGE_KEY)
    const extractStorage: RateLimitStorage = extractResult[EXTRACT_RATE_LIMIT_STORAGE_KEY] || {}
    delete extractStorage[String(tabId)]
    await chrome.storage.session.set({ [EXTRACT_RATE_LIMIT_STORAGE_KEY]: extractStorage })

    const verifyResult = await chrome.storage.session.get(VERIFY_RATE_LIMIT_STORAGE_KEY)
    const verifyStorage: RateLimitStorage = verifyResult[VERIFY_RATE_LIMIT_STORAGE_KEY] || {}
    delete verifyStorage[String(tabId)]
    await chrome.storage.session.set({ [VERIFY_RATE_LIMIT_STORAGE_KEY]: verifyStorage })
  } catch {
    // Ignore cleanup errors
  }
})

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    if (config.isDev) {
      console.log('[GroundCheck] Extension installed')
    }
  } else if (details.reason === 'update') {
    if (config.isDev) {
      console.log('[GroundCheck] Extension updated')
    }
  }
})

interface ExtractClaimsMessage {
  type: 'EXTRACT_CLAIMS'
  payload: ExtractClaimsRequest
}

interface VerifyClaimMessage {
  type: 'VERIFY_CLAIM'
  payload: VerifyClaimRequest
}

interface GenericMessage {
  type: Exclude<MessageType, 'EXTRACT_CLAIMS' | 'VERIFY_CLAIM'>
  payload?: unknown
}

type Message = ExtractClaimsMessage | VerifyClaimMessage | GenericMessage

function isExtractClaimsMessage(message: Message): message is ExtractClaimsMessage {
  return message.type === 'EXTRACT_CLAIMS'
}

function isVerifyClaimMessage(message: Message): message is VerifyClaimMessage {
  return message.type === 'VERIFY_CLAIM'
}

async function handleExtractClaims(payload: ExtractClaimsRequest): Promise<ExtractClaimsResponse> {
  const response = await fetch(`${config.apiUrl}/api/extract-claims`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

async function handleVerifyClaim(payload: VerifyClaimRequest): Promise<VerifyClaimResponse> {
  const response = await fetch(`${config.apiUrl}/api/verify-claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

// Message listener for content script communication
chrome.runtime.onMessage.addListener(
  (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    // Security: Only accept messages from our own extension
    if (sender.id !== chrome.runtime.id) {
      sendResponse({ status: 'error', error: 'Unauthorized sender' })
      return true
    }

    // Note: Do not log message contents to avoid leaking sensitive chat data

    if (isExtractClaimsMessage(message)) {
      const tabId = sender.tab?.id

      // Handle async rate limit check and extraction
      ;(async () => {
        // Check rate limit
        if (tabId && !(await checkExtractRateLimit(tabId))) {
          sendResponse({
            status: 'error',
            error: 'Rate limit exceeded. Please wait before making more requests.',
          })
          return
        }

        try {
          const data = await handleExtractClaims(message.payload)
          sendResponse({ status: 'ok', data })
        } catch (err) {
          if (config.isDev) {
            console.error('[GroundCheck] Extract claims error:', err)
          }
          Sentry.captureException(err)
          sendResponse({
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      })()

      return true // Indicates async response
    }

    if (isVerifyClaimMessage(message)) {
      const tabId = sender.tab?.id

      // Handle async rate limit check and verification
      ;(async () => {
        // Check rate limit
        if (tabId && !(await checkVerifyRateLimit(tabId))) {
          sendResponse({
            status: 'error',
            error: 'Verification rate limit exceeded. Please wait before verifying more claims.',
          })
          return
        }

        try {
          const data = await handleVerifyClaim(message.payload)
          sendResponse({ status: 'ok', data })
        } catch (err) {
          if (config.isDev) {
            console.error('[GroundCheck] Verify claim error:', err)
          }
          Sentry.captureException(err)
          sendResponse({
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      })()

      return true // Indicates async response
    }

    sendResponse({ status: 'ok' })
    return true
  }
)
