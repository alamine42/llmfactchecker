import { test as base, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Custom Playwright fixture that loads the GroundCheck Chrome extension
 *
 * Usage:
 *   test('my test', async ({ context, extensionId }) => {
 *     const page = await context.newPage()
 *     // Extension is loaded and ready
 *   })
 */
export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, '../../dist')

    const context = await chromium.launchPersistentContext('', {
      headless: false, // Extensions require headed mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
    })

    await use(context)
    await context.close()
  },

  extensionId: async ({ context }, use) => {
    // Wait for service worker to be ready
    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }

    // Extract extension ID from service worker URL
    const extensionId = background.url().split('/')[2]
    await use(extensionId)
  },
})

export { expect } from '@playwright/test'
