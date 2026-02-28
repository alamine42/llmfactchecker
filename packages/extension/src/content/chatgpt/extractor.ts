/**
 * Text Extractor for ChatGPT Messages
 *
 * Extracts clean text from ChatGPT message elements,
 * stripping code blocks and normalizing whitespace.
 */

import { SELECTORS } from './observer'

export interface ExtractedContent {
  text: string
  responseId: string
  hasCodeBlocks: boolean
  wordCount: number
}

/**
 * Extract text content from a ChatGPT message element
 */
export function extractTextFromElement(element: HTMLElement): string {
  // Find the markdown content container
  const contentElement = element.querySelector(SELECTORS.messageContent)
  if (!contentElement) {
    return ''
  }

  return extractCleanText(contentElement as HTMLElement)
}

/**
 * Extract clean text from an element, removing code blocks
 */
export function extractCleanText(element: HTMLElement): string {
  // Clone to avoid modifying the original
  const clone = element.cloneNode(true) as HTMLElement

  // Remove code blocks - these aren't factual claims
  const codeBlocks = clone.querySelectorAll('pre, code')
  codeBlocks.forEach((block) => block.remove())

  // Remove any script or style elements
  const scripts = clone.querySelectorAll('script, style')
  scripts.forEach((el) => el.remove())

  // Get text content
  let text = clone.textContent || ''

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

/**
 * Generate a stable response ID from an element
 */
export function generateResponseId(element: HTMLElement): string {
  // Try to get from ChatGPT's data attributes
  const turnElement = element.closest(SELECTORS.conversationTurn)
  if (turnElement) {
    const testId = turnElement.getAttribute('data-testid')
    if (testId) {
      return testId
    }
  }

  // Fall back to position-based ID
  const allMessages = document.querySelectorAll(SELECTORS.assistantMessage)
  const index = Array.from(allMessages).indexOf(element)

  if (index >= 0) {
    return `chatgpt-response-${index}`
  }

  // Last resort: timestamp-based
  return `chatgpt-response-${Date.now()}`
}

/**
 * Extract full content with metadata
 */
export function extractContent(element: HTMLElement): ExtractedContent {
  const responseId = generateResponseId(element)
  const contentElement = element.querySelector(SELECTORS.messageContent)

  if (!contentElement) {
    return {
      text: '',
      responseId,
      hasCodeBlocks: false,
      wordCount: 0,
    }
  }

  // Check for code blocks before removing them
  const hasCodeBlocks = contentElement.querySelectorAll('pre, code').length > 0

  const text = extractCleanText(contentElement as HTMLElement)
  const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length

  return {
    text,
    responseId,
    hasCodeBlocks,
    wordCount,
  }
}

/**
 * Check if text is meaningful for fact-checking (text-based version)
 * Use this when you already have the extracted text to avoid re-scraping DOM
 */
export function isTextFactCheckable(text: string, rawTextLength?: number): boolean {
  const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length

  // Need at least some text
  if (wordCount < 5) {
    return false
  }

  // Check if it's mostly code (if raw length provided)
  if (rawTextLength !== undefined && rawTextLength > 0) {
    const codeRatio = (rawTextLength - text.length) / rawTextLength
    if (codeRatio > 0.8) {
      return false
    }
  }

  return true
}

/**
 * Check if an element contains meaningful text for fact-checking
 * @deprecated Use isTextFactCheckable with pre-extracted text to avoid double DOM scraping
 */
export function hasFactCheckableContent(element: HTMLElement): boolean {
  const { text, wordCount } = extractContent(element)

  // Need at least some text
  if (wordCount < 5) {
    return false
  }

  // Check if it's mostly code (by comparing with raw content)
  const rawText = element.textContent || ''
  const codeRatio = (rawText.length - text.length) / rawText.length

  // If more than 80% was code, skip
  if (codeRatio > 0.8) {
    return false
  }

  return true
}
