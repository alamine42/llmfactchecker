import * as Sentry from '@sentry/node'
import { config } from './config'

export function initSentry() {
  if (config.sentryDsn) {
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.env,
      tracesSampleRate: config.isDev ? 1.0 : 0.1,
    })
  }
}

export { Sentry }
