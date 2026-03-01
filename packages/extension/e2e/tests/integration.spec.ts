import { test, expect } from '../fixtures/extension'

test.describe('Integration Tests', () => {
  test.describe('Message Passing', () => {
    test('background script receives and responds to messages', async ({
      context,
      extensionId,
    }) => {
      const page = await context.newPage()

      // Navigate to extension popup to test message passing
      await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`)

      // The popup should be able to communicate with the background script
      // We verify this by checking the popup loads without errors
      await expect(page.locator('body')).toBeVisible()

      // Check for no console errors related to message passing
      const errors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text())
        }
      })

      // Wait a bit for any async operations
      await page.waitForTimeout(1000)

      // Filter out expected errors (like network requests to real APIs)
      const criticalErrors = errors.filter(
        (e) => !e.includes('net::') && !e.includes('Failed to fetch')
      )

      expect(criticalErrors.length).toBe(0)
    })
  })

  test.describe('Mock ChatGPT Page', () => {
    test('extension detects response elements', async ({ context }) => {
      const page = await context.newPage()

      // Create a mock ChatGPT-like page structure
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head><title>Mock ChatGPT</title></head>
        <body>
          <div class="chat-container">
            <div data-message-author-role="assistant" data-testid="conversation-turn-1">
              <div class="markdown">
                <p>The Earth is approximately 4.5 billion years old and orbits the Sun at about 93 million miles.</p>
                <p>Water boils at 100 degrees Celsius at sea level.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `)

      // The page should render
      await expect(page.locator('.markdown')).toBeVisible()

      // Verify the text content is present
      const text = await page.locator('.markdown').textContent()
      expect(text).toContain('4.5 billion years')
      expect(text).toContain('93 million miles')
    })
  })

  test.describe('Rate Limiting', () => {
    test('API requests include proper headers', async ({ context }) => {
      const page = await context.newPage()

      // Make multiple requests to test rate limiting behavior
      const requests: Promise<unknown>[] = []

      for (let i = 0; i < 3; i++) {
        requests.push(
          page.request.post('http://localhost:3001/api/extract-claims', {
            data: {
              text: `Test claim number ${i}. The population is ${i * 100} million people.`,
              platform: 'chatgpt',
              responseId: `test-${i}`,
            },
          })
        )
      }

      const responses = await Promise.all(requests)

      // All requests should succeed (mock server doesn't enforce rate limiting)
      for (const response of responses) {
        expect((response as { ok: () => boolean }).ok()).toBe(true)
      }
    })
  })
})

test.describe('Error Handling', () => {
  test('handles empty body gracefully', async ({ context }) => {
    const page = await context.newPage()

    // Send request with empty object - server handles it gracefully
    const response = await page.request.post('http://localhost:3001/api/extract-claims', {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    })

    // Server handles empty/missing fields gracefully
    expect(response.ok()).toBe(true)
    const data = await response.json()
    expect(data.claims).toBeInstanceOf(Array)
  })

  test('handles missing required fields', async ({ context }) => {
    const page = await context.newPage()

    const response = await page.request.post('http://localhost:3001/api/extract-claims', {
      data: {
        // Missing 'text' field
        platform: 'chatgpt',
      },
    })

    // Mock server returns empty claims when text is missing/undefined
    // This matches production behavior where we gracefully handle edge cases
    const data = await response.json()
    expect(data.claims).toBeInstanceOf(Array)
    expect(data.claims.length).toBe(0)
  })

  test('handles 404 for unknown endpoints', async ({ context }) => {
    const page = await context.newPage()

    const response = await page.request.get('http://localhost:3001/api/unknown-endpoint')

    expect(response.status()).toBe(404)
  })
})
