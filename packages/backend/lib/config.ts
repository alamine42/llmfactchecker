export const config = {
  env: process.env.NODE_ENV || 'development',
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  sentryDsn: process.env.SENTRY_DSN || '',
  isDev: process.env.NODE_ENV !== 'production',

  // Supabase configuration
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Usage limits
  dailyVerificationLimit: {
    free: 10,
    pro: -1, // unlimited
  },
}
