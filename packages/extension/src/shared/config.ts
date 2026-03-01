export const config = {
  env: import.meta.env.MODE,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN || '',
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,

  // Supabase configuration
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',

  // Usage limits
  dailyVerificationLimit: 10,
}
