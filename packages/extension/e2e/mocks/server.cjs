/**
 * Mock API server for E2E tests
 *
 * This is a simple Express server that mimics the backend API
 * for testing the extension in isolation.
 */

const http = require('http')
const url = require('url')

const PORT = process.env.TEST_PORT || 3001

/**
 * Extract mock claims from text
 */
function extractMockClaims(text, responseId) {
  const claims = []
  let claimIndex = 0

  // Pattern to find sentences with numbers
  const numberPattern = /[A-Z][^.!?]*\d+[^.!?]*[.!?]/g
  const matches = text.match(numberPattern) || []

  for (const match of matches) {
    if (match.length > 20 && match.length < 200) {
      const start = text.indexOf(match)
      claims.push({
        id: `${responseId}-claim-${claimIndex++}`,
        text: match.trim(),
        type: 'factual',
        confidence: 0.85,
        sourceOffset: { start, end: start + match.length },
      })
    }
    if (claims.length >= 5) break
  }

  return claims
}

/**
 * Get mock verification result
 */
function getMockVerification(claimId, claimText) {
  const lowerText = claimText.toLowerCase()

  let status = 'unverified'
  let confidence = 0.5

  if (
    lowerText.includes('earth') ||
    lowerText.includes('sun') ||
    lowerText.includes('million') ||
    lowerText.includes('billion')
  ) {
    status = 'verified'
    confidence = 0.92
  } else if (lowerText.includes('false') || lowerText.includes('incorrect')) {
    status = 'disputed'
    confidence = 0.88
  }

  return {
    claimId,
    status,
    confidence,
    sources: [
      {
        name: 'Mock Fact Checker',
        url: 'https://example.com/factcheck',
        rating: status === 'verified' ? 'True' : status === 'disputed' ? 'False' : 'Unverified',
        snippet: `This claim has been ${status} by our mock fact-checking system.`,
      },
    ],
    verifiedAt: new Date().toISOString(),
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Health check
  if (pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
    return
  }

  // Extract claims
  if (pathname === '/api/extract-claims' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        const { text, responseId } = JSON.parse(body)
        // Handle missing text gracefully
        const claims = text ? extractMockClaims(text, responseId || 'unknown') : []
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            claims,
            responseId: responseId || 'unknown',
            extractedAt: new Date().toISOString(),
          })
        )
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid request' }))
      }
    })
    return
  }

  // Verify claim
  if (pathname === '/api/verify-claim' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        const { claimId, claimText } = JSON.parse(body)
        const verification = getMockVerification(claimId, claimText)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(verification))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid request' }))
      }
    })
    return
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`Mock API server running at http://localhost:${PORT}`)
})
