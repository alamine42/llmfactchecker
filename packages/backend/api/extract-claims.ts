import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initSentry, Sentry } from '../lib/sentry'
import { config } from '../lib/config'
import { ExtractClaimsRequestSchema, ExtractClaimsResponseSchema } from '../lib/schemas'

// Initialize Sentry on cold start
initSentry()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Validate request body with Zod
    const parseResult = ExtractClaimsRequestSchema.safeParse(req.body)

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.issues,
      })
    }

    const validatedRequest = parseResult.data

    // Forward request to Python service
    const pythonResponse = await fetch(`${config.pythonServiceUrl}/api/extract-claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validatedRequest),
    })

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text()
      Sentry.captureMessage(`Python service error: ${pythonResponse.status}`, {
        level: 'error',
        extra: { status: pythonResponse.status, body: errorText },
      })
      return res.status(502).json({
        error: 'Upstream service error',
        status: pythonResponse.status,
      })
    }

    const responseData = await pythonResponse.json()

    // Validate response from Python service
    const responseParseResult = ExtractClaimsResponseSchema.safeParse(responseData)

    if (!responseParseResult.success) {
      Sentry.captureMessage('Invalid response from Python service', {
        level: 'error',
        extra: { issues: responseParseResult.error.issues },
      })
      return res.status(502).json({
        error: 'Invalid upstream response',
      })
    }

    return res.status(200).json(responseParseResult.data)
  } catch (error) {
    Sentry.captureException(error)

    if (error instanceof Error) {
      return res.status(500).json({
        error: 'Internal server error',
        message: config.isDev ? error.message : undefined,
      })
    }

    return res.status(500).json({ error: 'Internal server error' })
  }
}
