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
 *
 * IMPORTANT: The native @sentry/react-native module is NEVER loaded unless a
 * real (non-placeholder) DSN is configured. On Android, the Sentry native
 * module installs error handlers at require() time that can cause a remount
 * loop (rapid white/black flashing). By gating on DSN first, we avoid loading
 * the native module entirely during development with no DSN configured.
 */

// ---------------------------------------------------------------------------
// DSN resolution — must happen BEFORE any require('@sentry/react-native')
// ---------------------------------------------------------------------------
const SENTRY_DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN ||
  process.env.SENTRY_DSN ||
  'https://placeholder@o0.ingest.sentry.io/0';

const IS_PLACEHOLDER = SENTRY_DSN.includes('placeholder');

// ---------------------------------------------------------------------------
// Conditional import: only load native Sentry when we have a real DSN
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Sentry: any;
let SENTRY_NATIVE_AVAILABLE = false;

// No-op stubs used when Sentry native module is not loaded.
const SENTRY_STUBS = {
  init: () => {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wrap: (component: any) => component,
  captureException: () => {},
  captureMessage: () => {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withScope: (cb: any) => cb({ setContext: () => {} }),
  setUser: () => {},
  addBreadcrumb: () => {},
};

if (!IS_PLACEHOLDER) {
  // Only attempt to load the native Sentry module when a real DSN is set.
  try {
    Sentry = require('@sentry/react-native');
    SENTRY_NATIVE_AVAILABLE = true;
  } catch (_e) {
    console.warn(
      '[Sentry] Native module not available — using no-op stubs.\n' +
        '  → Use a dev build (npx expo run:android) for full Sentry support.',
    );
    Sentry = SENTRY_STUBS;
  }
} else {
  // Placeholder DSN → skip loading the native module entirely.
  // This prevents @sentry/react-native from installing native error handlers
  // that can cause a remount loop on Android.
  Sentry = SENTRY_STUBS;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
export function initSentry(): void {
  if (!SENTRY_NATIVE_AVAILABLE) {
    if (__DEV__) {
      console.warn(
        IS_PLACEHOLDER
          ? '[Sentry] Using placeholder DSN — Sentry is disabled.\n' +
              '  → Set EXPO_PUBLIC_SENTRY_DSN in your .env file to enable error tracking.'
          : '[Sentry] Skipping init — native module not available (Expo Go?).\n' +
              '  → Use a dev build (npx expo run:android) for full Sentry support.',
      );
    } else if (IS_PLACEHOLDER) {
      console.error(
        '[Sentry] CRITICAL: No Sentry DSN configured for production build!\n' +
          '  → Crash reporting is DISABLED. Set EXPO_PUBLIC_SENTRY_DSN before releasing.',
      );
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: __DEV__ ? 0 : 0.2,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    environment: __DEV__ ? 'development' : 'production',
    debug: false,
    attachStacktrace: true,
  });
}

// Re-export the wrap helper so _layout.tsx can use it without importing Sentry directly.
// When Sentry isn't loaded, use a passthrough to avoid the native error boundary
// wrapper crashing and causing a remount loop on Android.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const wrapWithSentry = SENTRY_NATIVE_AVAILABLE
  ? Sentry.wrap
  : ((component: any) => component);

// Re-export the Sentry namespace for use in error-logger.ts.
// When native module is not loaded, this exports the no-op stubs.
export { Sentry };
