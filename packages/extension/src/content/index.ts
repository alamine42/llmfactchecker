import { config } from '@/shared/config'
import type { ExtractClaimsRequest, ExtractClaimsResponse, MessageResponse } from '@/shared/types'
import { ChatGPTObserver } from './chatgpt/observer'
import { isTextFactCheckable } from './chatgpt/extractor'
import { OverlayManager } from './ui/overlay'

if (config.isDev) {
  console.log('[GroundCheck] Content script loaded on:', window.location.href)
}

// Platform detection
type Platform = 'chatgpt' | 'claude' | 'unknown'

function detectPlatform(): Platform {
  const hostname = window.location.hostname

  if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) {
    return 'chatgpt'
  }

  if (hostname.includes('claude.ai')) {
    return 'claude'
  }

  return 'unknown'
}

// Send message to background script
async function sendExtractClaimsRequest(
  text: string,
  source: 'chatgpt' | 'claude',
  responseId?: string
): Promise<ExtractClaimsResponse> {
  const request: ExtractClaimsRequest = {
    text,
    source,
    responseId,
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'EXTRACT_CLAIMS', payload: request },
      (response: MessageResponse) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        if (response.status === 'error') {
          reject(new Error(response.error || 'Unknown error'))
          return
        }

        resolve(response.data as ExtractClaimsResponse)
      }
    )
  })
}

// Initialize based on platform
function initialize(): void {
  const platform = detectPlatform()

  if (platform === 'unknown') {
    if (config.isDev) {
      console.log('[GroundCheck] Unknown platform, not initializing')
    }
    return
  }

  if (config.isDev) {
    console.log('[GroundCheck] Detected platform:', platform)
  }

  if (platform === 'chatgpt') {
    initializeChatGPT()
  }

  // Claude support will be added in a future sprint
}

function initializeChatGPT(): void {
  const overlay = new OverlayManager()

  const observer = new ChatGPTObserver({
    onResponseStart: (element, responseId) => {
      // Show checking indicator
      overlay.showIndicator(element, responseId, 'checking')
    },

    onResponseComplete: async (element, responseId, text) => {
      // Check if content is worth fact-checking using pre-extracted text
      // to avoid re-scraping the DOM
      const rawTextLength = element.textContent?.length ?? 0
      if (!isTextFactCheckable(text, rawTextLength)) {
        overlay.removeIndicator(responseId)
        return
      }

      try {
        const result = await sendExtractClaimsRequest(text, 'chatgpt', responseId)

        if (result.claims.length === 0) {
          // No claims found, remove indicator
          overlay.removeIndicator(responseId)
          return
        }

        // Update indicator to complete with claim count
        overlay.updateIndicator(responseId, 'complete', result.claims)

        if (config.isDev) {
          console.log(
            `[GroundCheck] Found ${result.claims.length} claims in response ${responseId}`
          )
        }
      } catch (error) {
        overlay.updateIndicator(responseId, 'error')

        if (config.isDev) {
          console.error('[GroundCheck] Error extracting claims:', error)
        }
      }
    },

    onResponseError: (element, responseId, error) => {
      overlay.updateIndicator(responseId, 'error')

      if (config.isDev) {
        console.error('[GroundCheck] Response error:', error)
      }
    },
  })

  // Start observing
  observer.start()

  if (config.isDev) {
    console.log('[GroundCheck] ChatGPT observer started')
  }

  // Cleanup on page unload
  window.addEventListener('unload', () => {
    observer.stop()
    overlay.clear()
  })
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}
