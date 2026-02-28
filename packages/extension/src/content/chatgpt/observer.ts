/**
 * ChatGPT DOM Observer
 *
 * Uses MutationObserver to detect new assistant responses in ChatGPT's conversation UI.
 * Debounces streaming text to avoid processing incomplete responses.
 */

// ChatGPT DOM selectors (as of 2025)
export const SELECTORS = {
  conversationTurn: '[data-testid^="conversation-turn-"]',
  assistantMessage: '[data-message-author-role="assistant"]',
  messageContent: '.markdown',
} as const

export interface ChatGPTObserverCallbacks {
  onResponseStart?: (element: HTMLElement, responseId: string) => void
  onResponseComplete: (element: HTMLElement, responseId: string, text: string) => void
  onResponseError?: (element: HTMLElement, responseId: string, error: Error) => void
}

interface PendingResponse {
  element: HTMLElement
  responseId: string
  lastText: string
  debounceTimer: ReturnType<typeof setTimeout> | null
  lastUpdateTime: number
}

export class ChatGPTObserver {
  private observer: MutationObserver | null = null
  private callbacks: ChatGPTObserverCallbacks
  private pendingResponses: Map<string, PendingResponse> = new Map()
  private processedResponseIds: Set<string> = new Set()
  private debounceMs: number

  constructor(callbacks: ChatGPTObserverCallbacks, debounceMs = 500) {
    this.callbacks = callbacks
    this.debounceMs = debounceMs
  }

  start(): void {
    if (this.observer) {
      return
    }

    this.observer = new MutationObserver(this.handleMutations.bind(this))

    // Observe the entire document body for changes
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    // Process any existing responses on the page
    this.scanExistingResponses()
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }

    // Clear all pending debounce timers
    for (const pending of this.pendingResponses.values()) {
      if (pending.debounceTimer) {
        clearTimeout(pending.debounceTimer)
      }
    }
    this.pendingResponses.clear()
  }

  private scanExistingResponses(): void {
    const assistantMessages = document.querySelectorAll(SELECTORS.assistantMessage)

    assistantMessages.forEach((element) => {
      if (element instanceof HTMLElement) {
        this.processAssistantMessage(element)
      }
    })
  }

  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      // Handle new nodes being added
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            this.checkNodeForResponses(node)
          }
        })
      }

      // Handle text content changes (streaming)
      if (mutation.type === 'characterData') {
        const target = mutation.target.parentElement
        if (target instanceof HTMLElement) {
          this.handleTextChange(target)
        }
      }
    }
  }

  private checkNodeForResponses(node: HTMLElement): void {
    // Check if the node itself is an assistant message
    if (node.matches?.(SELECTORS.assistantMessage)) {
      this.processAssistantMessage(node)
      return
    }

    // Check for assistant messages within the node
    const assistantMessages = node.querySelectorAll(SELECTORS.assistantMessage)
    assistantMessages.forEach((element) => {
      if (element instanceof HTMLElement) {
        this.processAssistantMessage(element)
      }
    })
  }

  private handleTextChange(element: HTMLElement): void {
    // Find the closest assistant message container
    const assistantMessage = element.closest(SELECTORS.assistantMessage)
    if (assistantMessage instanceof HTMLElement) {
      this.processAssistantMessage(assistantMessage)
    }
  }

  private processAssistantMessage(element: HTMLElement): void {
    const responseId = this.getResponseId(element)

    // Skip if already fully processed
    if (this.processedResponseIds.has(responseId)) {
      return
    }

    const contentElement = element.querySelector(SELECTORS.messageContent)
    if (!contentElement) {
      return
    }

    const text = this.extractText(contentElement as HTMLElement)

    // Check if we have a pending response for this ID
    const pending = this.pendingResponses.get(responseId)

    if (!pending) {
      // New response detected
      this.callbacks.onResponseStart?.(element, responseId)

      this.pendingResponses.set(responseId, {
        element,
        responseId,
        lastText: text,
        debounceTimer: null,
        lastUpdateTime: Date.now(),
      })
    } else {
      // Update existing pending response
      pending.lastText = text
      pending.lastUpdateTime = Date.now()
    }

    // Reset debounce timer
    const currentPending = this.pendingResponses.get(responseId)
    if (currentPending) {
      if (currentPending.debounceTimer) {
        clearTimeout(currentPending.debounceTimer)
      }

      currentPending.debounceTimer = setTimeout(() => {
        this.finalizeResponse(responseId)
      }, this.debounceMs)
    }
  }

  private finalizeResponse(responseId: string): void {
    const pending = this.pendingResponses.get(responseId)
    if (!pending) {
      return
    }

    // Mark as processed
    this.processedResponseIds.add(responseId)
    this.pendingResponses.delete(responseId)

    // Only call callback if we have meaningful text
    if (pending.lastText.trim().length > 0) {
      this.callbacks.onResponseComplete(pending.element, responseId, pending.lastText)
    }
  }

  private getResponseId(element: HTMLElement): string {
    // Try to get a stable ID from ChatGPT's data attributes
    const turnElement = element.closest(SELECTORS.conversationTurn)
    if (turnElement) {
      const testId = turnElement.getAttribute('data-testid')
      if (testId) {
        return testId
      }
    }

    // Fall back to generating an ID from element position
    const allMessages = document.querySelectorAll(SELECTORS.assistantMessage)
    const index = Array.from(allMessages).indexOf(element)
    return `assistant-message-${index}`
  }

  private extractText(element: HTMLElement): string {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true) as HTMLElement

    // Remove code blocks (not factual claims)
    const codeBlocks = clone.querySelectorAll('pre, code')
    codeBlocks.forEach((block) => block.remove())

    // Get text content
    const text = clone.textContent || ''

    // Clean up whitespace
    return text.replace(/\s+/g, ' ').trim()
  }

  /**
   * Force reprocess a specific response (useful for retry)
   */
  reprocessResponse(responseId: string): void {
    this.processedResponseIds.delete(responseId)

    const element = document.querySelector(
      `${SELECTORS.assistantMessage}[data-testid="${responseId}"]`
    )
    if (element instanceof HTMLElement) {
      this.processAssistantMessage(element)
    }
  }
}
