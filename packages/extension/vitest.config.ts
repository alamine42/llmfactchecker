import { defineConfig, configDefaults } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    passWithNoTests: true,
    environment: 'jsdom',
    // Merge with Vitest's default excludes to keep ignoring .git, .turbo, .cache, etc.
    exclude: [...configDefaults.exclude, '**/e2e/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
