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
    const normalizedClaim = this.normalizeText(claimText)
    if (!normalizedClaim) return null

    const textNodes = this.getTextNodes(container)
    if (textNodes.length === 0) {
      console.log('[GroundCheck TextMapper] No text nodes found in container')
      return null
    }

    // Build concatenated text from all nodes
    const fullText = this.getConcatenatedText(textNodes)
    const normalizedFull = this.normalizeText(fullText)

    console.log('[GroundCheck TextMapper] Searching for claim in', normalizedFull.length, 'chars')
    console.log('[GroundCheck TextMapper] Claim to find:', normalizedClaim.slice(0, 80), '...')

    // Find the claim in the normalized full text
    let claimIndex = normalizedFull.indexOf(normalizedClaim)

    if (claimIndex === -1) {
      // Try case-insensitive search
      claimIndex = normalizedFull.toLowerCase().indexOf(normalizedClaim.toLowerCase())
    }

    if (claimIndex === -1) {
      // Try finding a significant substring (first 50 chars)
      const shortClaim = normalizedClaim.slice(0, 50)
      claimIndex = normalizedFull.toLowerCase().indexOf(shortClaim.toLowerCase())
      if (claimIndex !== -1) {
        console.log('[GroundCheck TextMapper] Found partial match at', claimIndex)
        // Try to find the full sentence from this position
        const endIndex = Math.min(claimIndex + normalizedClaim.length, normalizedFull.length)
        return this.findRangeForNormalizedPositions(
          container,
          textNodes,
          claimIndex,
          endIndex,
          claimText
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
      claimIndex + normalizedClaim.length,
      claimText
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
    // First, verify the offset matches the claim text
    const normalizedOriginal = this.normalizeText(originalText)
    const expectedText = normalizedOriginal.slice(sourceOffset.start, sourceOffset.end)
    const normalizedClaim = this.normalizeText(claimText)

    // If offsets align, use them directly
    if (expectedText === normalizedClaim) {
      const textNodes = this.getTextNodes(container)
      return this.findRangeForNormalizedPositions(
        container,
        textNodes,
        sourceOffset.start,
        sourceOffset.end,
        claimText
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
    originalClaimText: string
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

    for (const node of textNodes) {
      const nodeText = node.textContent || ''
      const nodeStart = normalizedPos

      for (let i = 0; i < nodeText.length; i++) {
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
