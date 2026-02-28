export const config = {
  env: process.env.NODE_ENV || 'development',
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  sentryDsn: process.env.SENTRY_DSN || '',
  isDev: process.env.NODE_ENV !== 'production',
}
