// src/instrumentation.ts (Next.js instrumentation file)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Sentry in production
    if (process.env.NODE_ENV === 'production') {
      const { initSentry } = await import('./lib/monitoring/sentry')
      initSentry()
    }
  }
}