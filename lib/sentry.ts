/**
 * Sentry Error Tracking Configuration
 *
 * Initializes Sentry for crash reporting and performance monitoring.
 *
 * SETUP: Replace the placeholder DSN below (or set EXPO_PUBLIC_SENTRY_DSN in
 * your .env file) with your real DSN from:
 *   https://sentry.io/settings/<your-org>/projects/<your-project>/keys/
 *
 * The EXPO_PUBLIC_ prefix is required so Expo inlines the value at build time
 * and makes it available in the React Native JS bundle.
 */

import * as Sentry from '@sentry/react-native';

// ---------------------------------------------------------------------------
// DSN resolution
// ---------------------------------------------------------------------------
// Priority: env var → placeholder. The placeholder will show a warning so the
// user knows to configure it before going to production.
const SENTRY_DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN ||
  // Legacy non-public key kept for backward compatibility with env-validator.ts
  process.env.SENTRY_DSN ||
  // TODO: Replace this placeholder with your real Sentry DSN before going live.
  'https://placeholder@o0.ingest.sentry.io/0';

const IS_PLACEHOLDER = SENTRY_DSN.includes('placeholder');

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
export function initSentry(): void {
  if (IS_PLACEHOLDER) {
    console.warn(
      '[Sentry] Using placeholder DSN — errors will NOT be reported to Sentry.\n' +
        '  → Set EXPO_PUBLIC_SENTRY_DSN in your .env file to enable error tracking.'
    );
  }

  Sentry.init({
    dsn: SENTRY_DSN,

    // Capture 20% of transactions for performance monitoring in production.
    // Raise to 1.0 during debugging, lower further in high-traffic production.
    tracesSampleRate: __DEV__ ? 0 : 0.2,

    // Automatically tracks user sessions (start/end, crash-free rate).
    enableAutoSessionTracking: true,

    // Session ending threshold in milliseconds (default 30 s).
    sessionTrackingIntervalMillis: 30000,

    // Use the environment to separate dev/staging/production events in Sentry.
    environment: __DEV__ ? 'development' : 'production',

    // Log Sentry SDK debug output in dev so you can confirm events are firing.
    debug: __DEV__,

    // Attach JS bundle source context to events (requires source maps via EAS).
    attachStacktrace: true,
  });
}

// Re-export the wrap helper so _layout.tsx can use it without importing Sentry directly.
export const wrapWithSentry = Sentry.wrap;

// Re-export the full Sentry namespace for use in error-logger.ts.
export { Sentry };
