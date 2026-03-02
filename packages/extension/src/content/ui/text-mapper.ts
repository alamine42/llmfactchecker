/**
 * Text Position Mapper
 *
 * Maps character offsets in normalized text to DOM positions.
 * Handles the challenge of finding claim text in a DOM tree where
 * text may be split across multiple nodes.
 */

import type { ClaimRange } from './highlight-types'

export interface DOMPosition {
  node: Text
  offset: number
}

export class TextPositionMapper {
  /**
   * Normalize text for comparison (collapse whitespace, trim)
   */
  normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim()
  }

  /**
   * Aggressively normalize text for fuzzy matching
   * - Collapses all whitespace
   * - Adds space after punctuation if missing (handles "title:text" -> "title: text")
   * - Adds space between lowercase and uppercase (handles "millionWhy" -> "million Why")
   * - Removes extra spaces
   */
  normalizeForFuzzyMatch(text: string): string {
    return (
      text
        // Add space after punctuation if followed by letter/number (not already spaced)
        .replace(/([.:;,!?])([A-Za-z0-9])/g, '$1 $2')
        // Add space between lowercase letter/number and uppercase letter (camelCase boundaries)
        // Handles "millionWhy" -> "million Why" from concatenated DOM elements
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        // Collapse all whitespace to single space
        .replace(/\s+/g, ' ')
        .trim()
    )
  }

  /**
   * Strip source prefixes from claim text (e.g., "Wikipedia ", "Wikipedia+1 ")
   * These are added by the factcheck service but don't exist in the original text
   */
  stripSourcePrefix(text: string): string {
    // Pattern matches: "SourceName " or "SourceName+N " at the start
    // Source names are single words (no spaces, no colons) like "Wikipedia", "BBC"
    // Examples: "Wikipedia ", "Wikipedia+1 ", "BBC+2 "
    // Should NOT match: "Estimated size: " (has colon, multiple words)
    return text.replace(/^[A-Za-z][A-Za-z0-9]*(?:\+\d+)?\s+/, '')
  }

  /**
   * Find all text nodes in a container, excluding code blocks
   */
  getTextNodes(container: HTMLElement): Text[] {
    const textNodes: Text[] = []
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // Skip text inside code blocks
        const parent = node.parentElement
        if (parent?.closest('pre, code')) {
          return NodeFilter.FILTER_REJECT
        }
        // Skip empty text nodes
        if (!node.textContent || node.textContent.trim().length === 0) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      },
    })

    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      textNodes.push(node)
    }

    return textNodes
  }

  /**
   * Get concatenated text from text nodes with normalized whitespace
   */
  getConcatenatedText(textNodes: Text[]): string {
    return textNodes.map((node) => node.textContent || '').join('')
  }

  /**
   * Map a character offset in normalized text to a DOM position
   */
  findDOMPosition(
    container: HTMLElement,
    normalizedText: string,
    offset: number
  ): DOMPosition | null {
    const textNodes = this.getTextNodes(container)
    if (textNodes.length === 0) return null

    // Build a mapping of normalized positions to actual DOM positions
    let normalizedPos = 0
    let lastWhitespace = true

    for (const node of textNodes) {
      const nodeText = node.textContent || ''

      for (let i = 0; i < nodeText.length; i++) {
        const char = nodeText[i]
        const isWhitespace = /\s/.test(char)

        // In normalized text, consecutive whitespace becomes single space
        if (isWhitespace) {
          if (!lastWhitespace) {
            // This whitespace counts as a single space in normalized text
            if (normalizedPos === offset) {
              return { node, offset: i }
            }
            normalizedPos++
          }
          lastWhitespace = true
        } else {
          // Regular character
          if (normalizedPos === offset) {
            return { node, offset: i }
          }
          normalizedPos++
          lastWhitespace = false
        }
      }
    }

    // If offset is at the end, return end of last node
    if (offset >= normalizedPos && textNodes.length > 0) {
      const lastNode = textNodes[textNodes.length - 1]
      return { node: lastNode, offset: lastNode.textContent?.length || 0 }
    }

    return null
  }

  /**
   * Find claim text in DOM using fuzzy matching
   * This is the fallback when sourceOffset doesn't align
   */
  fuzzyFindClaim(container: HTMLElement, claimText: string): ClaimRange | null {
    // First try with original text, then with stripped source prefix
    const originalNormalized = this.normalizeText(claimText)
    const strippedClaim = this.stripSourcePrefix(claimText)
    const strippedNormalized = this.normalizeText(strippedClaim)

    if (!originalNormalized && !strippedNormalized) return null

    const textNodes = this.getTextNodes(container)
    if (textNodes.length === 0) {
      console.log('[GroundCheck TextMapper] No text nodes found in container')
      return null
    }

    // Build concatenated text from all nodes
    const fullText = this.getConcatenatedText(textNodes)
    const normalizedFull = this.normalizeText(fullText)
    // Also create fuzzy-normalized version for more aggressive matching
    const fuzzyFull = this.normalizeForFuzzyMatch(fullText)

    console.log('[GroundCheck TextMapper] Searching for claim in', normalizedFull.length, 'chars')
    console.log('[GroundCheck TextMapper] Claim to find:', originalNormalized.slice(0, 80), '...')

    // Try original claim first
    let claimIndex = normalizedFull.indexOf(originalNormalized)
    let searchClaim = originalNormalized
    let useFuzzyText = false

    if (claimIndex === -1) {
      // Try case-insensitive search
      claimIndex = normalizedFull.toLowerCase().indexOf(originalNormalized.toLowerCase())
    }

    // If not found, try with stripped source prefix
    if (claimIndex === -1 && strippedNormalized !== originalNormalized) {
      console.log(
        '[GroundCheck TextMapper] Trying with stripped source prefix:',
        strippedNormalized.slice(0, 80),
        '...'
      )
      claimIndex = normalizedFull.indexOf(strippedNormalized)
      if (claimIndex === -1) {
        claimIndex = normalizedFull.toLowerCase().indexOf(strippedNormalized.toLowerCase())
      }
      if (claimIndex !== -1) {
        searchClaim = strippedNormalized
        console.log(
          '[GroundCheck TextMapper] Found match after stripping source prefix at',
          claimIndex
        )
      }
    }

    // If still not found, try fuzzy matching (handles "title:text" vs "title: text")
    if (claimIndex === -1) {
      const fuzzyStripped = this.normalizeForFuzzyMatch(strippedClaim)
      claimIndex = fuzzyFull.indexOf(fuzzyStripped)
      if (claimIndex === -1) {
        claimIndex = fuzzyFull.toLowerCase().indexOf(fuzzyStripped.toLowerCase())
      }
      if (claimIndex !== -1) {
        searchClaim = fuzzyStripped
        useFuzzyText = true
        console.log('[GroundCheck TextMapper] Found match using fuzzy normalization at', claimIndex)
      }
    }

    if (claimIndex === -1) {
      // Try finding a significant substring (first 50 chars) from stripped version
      const shortClaim = this.normalizeForFuzzyMatch(strippedClaim).slice(0, 50)
      claimIndex = fuzzyFull.toLowerCase().indexOf(shortClaim.toLowerCase())
      if (claimIndex !== -1) {
        console.log('[GroundCheck TextMapper] Found partial match at', claimIndex)
        searchClaim = this.normalizeForFuzzyMatch(strippedClaim)
        useFuzzyText = true
        // Try to find the full sentence from this position
        const endIndex = Math.min(claimIndex + searchClaim.length, fuzzyFull.length)
        return this.findRangeForNormalizedPositions(
          container,
          textNodes,
          claimIndex,
          endIndex,
          strippedClaim,
          useFuzzyText
        )
      }
    }

    if (claimIndex === -1) {
      console.log('[GroundCheck TextMapper] Could not find claim in text')
      console.log('[GroundCheck TextMapper] DOM text preview:', normalizedFull.slice(0, 200))
      return null
    }

    console.log('[GroundCheck TextMapper] Found claim at position', claimIndex)

    return this.findRangeForNormalizedPositions(
      container,
      textNodes,
      claimIndex,
      claimIndex + searchClaim.length,
      strippedClaim,
      useFuzzyText
    )
  }

  /**
   * Find claim using sourceOffset from the claim data
   */
  findClaimByOffset(
    container: HTMLElement,
    claimText: string,
    sourceOffset: { start: number; end: number },
    originalText: string
  ): ClaimRange | null {
    // Strip source prefix from claim text if present
    const strippedClaim = this.stripSourcePrefix(claimText)

    // First, verify the offset matches the claim text
    const normalizedOriginal = this.normalizeText(originalText)
    const expectedText = normalizedOriginal.slice(sourceOffset.start, sourceOffset.end)
    const normalizedClaim = this.normalizeText(claimText)
    const normalizedStripped = this.normalizeText(strippedClaim)

    // If offsets align with original or stripped claim, use them directly
    if (expectedText === normalizedClaim || expectedText === normalizedStripped) {
      const textNodes = this.getTextNodes(container)
      return this.findRangeForNormalizedPositions(
        container,
        textNodes,
        sourceOffset.start,
        sourceOffset.end,
        strippedClaim
      )
    }

    // Fall back to fuzzy matching
    return this.fuzzyFindClaim(container, claimText)
  }

  /**
   * Convert normalized text positions to actual DOM range
   */
  private findRangeForNormalizedPositions(
    container: HTMLElement,
    textNodes: Text[],
    startNormalized: number,
    endNormalized: number,
    originalClaimText: string,
    useFuzzyText = false
  ): ClaimRange | null {
    // Map normalized positions to DOM positions
    interface NodeMapping {
      node: Text
      startInNode: number
      normalizedStart: number
      normalizedEnd: number
    }

    const nodeMappings: NodeMapping[] = []
    let normalizedPos = 0
    let lastWhitespace = true
    let lastPunctuation = false

    let lastChar = ''
    for (const node of textNodes) {
      const nodeText = node.textContent || ''
      const nodeStart = normalizedPos

      for (let i = 0; i < nodeText.length; i++) {
        const char = nodeText[i]
        const isWhitespace = /\s/.test(char)
        const isPunctuation = /[.:;,!?]/.test(char)
        const isUppercase = /[A-Z]/.test(char)
        const lastWasLowercaseOrDigit = /[a-z0-9]/.test(lastChar)

        if (isWhitespace) {
          if (!lastWhitespace) {
            normalizedPos++
          }
          lastWhitespace = true
          lastPunctuation = false
        } else {
          // In fuzzy mode, count extra positions for inserted spaces
          if (useFuzzyText) {
            // Space after punctuation if followed by non-space
            if (lastPunctuation && !lastWhitespace) {
              normalizedPos++
            }
            // Space between lowercase/digit and uppercase (camelCase boundary)
            if (lastWasLowercaseOrDigit && isUppercase && !lastWhitespace) {
              normalizedPos++
            }
          }
          normalizedPos++
          lastWhitespace = false
          lastPunctuation = isPunctuation
        }
        lastChar = char
      }

      nodeMappings.push({
        node,
        startInNode: 0,
        normalizedStart: nodeStart,
        normalizedEnd: normalizedPos,
      })
    }

    // Find start and end nodes
    let startNode: Text | null = null
    let startOffset = 0
    let endNode: Text | null = null
    let endOffset = 0

    for (const mapping of nodeMappings) {
      // Check if start falls in this node
      if (
        startNode === null &&
        startNormalized >= mapping.normalizedStart &&
        startNormalized < mapping.normalizedEnd
      ) {
        startNode = mapping.node
        startOffset = this.findActualOffset(
          mapping.node.textContent || '',
          startNormalized - mapping.normalizedStart
        )
      }

      // Check if end falls in this node
      if (endNormalized > mapping.normalizedStart && endNormalized <= mapping.normalizedEnd) {
        endNode = mapping.node
        endOffset = this.findActualOffset(
          mapping.node.textContent || '',
          endNormalized - mapping.normalizedStart
        )
      }
    }

    if (!startNode || !endNode) {
      return null
    }

    return {
      claimId: '', // Will be set by caller
      startNode,
      startOffset,
      endNode,
      endOffset,
      originalText: originalClaimText,
    }
  }

  /**
   * Convert normalized offset within a node to actual character offset
   */
  private findActualOffset(nodeText: string, normalizedOffset: number): number {
    let normalizedPos = 0
    let lastWhitespace = true

    for (let i = 0; i < nodeText.length; i++) {
      if (normalizedPos === normalizedOffset) {
        return i
      }

      const char = nodeText[i]
      const isWhitespace = /\s/.test(char)

      if (isWhitespace) {
        if (!lastWhitespace) {
          normalizedPos++
        }
        lastWhitespace = true
      } else {
        normalizedPos++
        lastWhitespace = false
      }
    }

    return nodeText.length
  }

  /**
   * Check if a claim range is still valid in the DOM
   */
  isRangeValid(range: ClaimRange): boolean {
    // Check if nodes are still in the document
    if (!range.startNode.isConnected || !range.endNode.isConnected) {
      return false
    }

    // Check if offsets are still valid
    const startText = range.startNode.textContent || ''
    const endText = range.endNode.textContent || ''

    if (range.startOffset > startText.length || range.endOffset > endText.length) {
      return false
    }

    return true
  }
}
