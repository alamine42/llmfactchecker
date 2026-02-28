import * as Sentry from '@sentry/browser'
import { config } from '@/shared/config'
import type {
  ExtractClaimsRequest,
  ExtractClaimsResponse,
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

// Rate limiting: max 10 requests per minute per tab
// Uses chrome.storage.session to persist state across service worker restarts
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_STORAGE_KEY = 'rateLimits'

interface RateLimitEntry {
  count: number
  windowStart: number
}

interface RateLimitStorage {
  [tabId: string]: RateLimitEntry
}

async function checkRateLimit(tabId: number): Promise<boolean> {
  const now = Date.now()
  const key = String(tabId)

  try {
    const result = await chrome.storage.session.get(RATE_LIMIT_STORAGE_KEY)
    const storage: RateLimitStorage = result[RATE_LIMIT_STORAGE_KEY] || {}
    const entry = storage[key]

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      // Start new window
      storage[key] = { count: 1, windowStart: now }
      await chrome.storage.session.set({ [RATE_LIMIT_STORAGE_KEY]: storage })
      return true
    }

    if (entry.count >= RATE_LIMIT_MAX) {
      return false
    }

    entry.count++
    await chrome.storage.session.set({ [RATE_LIMIT_STORAGE_KEY]: storage })
    return true
  } catch {
    // If storage fails, allow the request but log in dev
    if (config.isDev) {
      console.warn('[GroundCheck] Rate limit storage error, allowing request')
    }
    return true
  }
}

// Clean up rate limit entries for closed tabs
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const result = await chrome.storage.session.get(RATE_LIMIT_STORAGE_KEY)
    const storage: RateLimitStorage = result[RATE_LIMIT_STORAGE_KEY] || {}
    delete storage[String(tabId)]
    await chrome.storage.session.set({ [RATE_LIMIT_STORAGE_KEY]: storage })
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

interface GenericMessage {
  type: Exclude<MessageType, 'EXTRACT_CLAIMS'>
  payload?: unknown
}

type Message = ExtractClaimsMessage | GenericMessage

function isExtractClaimsMessage(message: Message): message is ExtractClaimsMessage {
  return message.type === 'EXTRACT_CLAIMS'
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

// Message listener for content script communication
chrome.runtime.onMessage.addListener(
  (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    // Note: Do not log message contents to avoid leaking sensitive chat data

    if (isExtractClaimsMessage(message)) {
      const tabId = sender.tab?.id

      // Handle async rate limit check and extraction
      ;(async () => {
        // Check rate limit
        if (tabId && !(await checkRateLimit(tabId))) {
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

    sendResponse({ status: 'ok' })
    return true
  }
)
