import * as Sentry from '@sentry/browser'
import { config } from '@/shared/config'

// Initialize Sentry for error tracking (disable console breadcrumbs to prevent leaking chat data)
if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.env,
    release: `groundcheck@${chrome.runtime.getManifest().version}`,
    integrations: (defaults) => defaults.filter((i) => i.name !== 'Breadcrumbs'),
    beforeSend(event) {
      // Scrub any potential sensitive data from error reports
      if (event.extra) {
        delete event.extra.message
      }
      return event
    },
  })
}

if (config.isDev) {
  console.log('[GroundCheck] Background service worker loaded')
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    if (config.isDev) {
      console.log('[GroundCheck] Extension installed')
    }
  } else if (details.reason === 'update') {
    if (config.isDev) {
      console.log('[GroundCheck] Extension updated')
    }
  }
})

// Message listener for content script communication
chrome.runtime.onMessage.addListener((_message, _sender, sendResponse) => {
  // Note: Do not log message contents to avoid leaking sensitive chat data
  sendResponse({ status: 'ok' })
  return true
})
