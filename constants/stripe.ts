/**
 * Stripe Configuration Constants
 *
 * Contains price IDs, product references, and configuration for Stripe integration.
 * All secret-key operations are handled server-side via Supabase Edge Functions.
 *
 * TODO: Replace placeholder price IDs with real ones from your Stripe Dashboard.
 * Create products and prices at: https://dashboard.stripe.com/products
 */

// ---------------------------------------------------------------------------
// Publishable key (safe for client-side)
// ---------------------------------------------------------------------------
export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

// ---------------------------------------------------------------------------
// Price IDs — replace with real Stripe price IDs from your dashboard
// Use test-mode IDs during development (prefix: price_...)
// ---------------------------------------------------------------------------
export const STRIPE_PRICES = {
  /** Loop Plus monthly: $5.99/mo */
  LOOP_PLUS_MONTHLY: 'price_REPLACE_WITH_LOOP_PLUS_MONTHLY_ID',

  /** Loop Plus annual: $49.99/yr (~$4.17/mo) */
  LOOP_PLUS_ANNUAL: 'price_REPLACE_WITH_LOOP_PLUS_ANNUAL_ID',

  /** Business Boosted tier: $49/mo */
  BUSINESS_BOOSTED: 'price_REPLACE_WITH_BUSINESS_BOOSTED_ID',

  /** Business Premium tier: $149/mo */
  BUSINESS_PREMIUM: 'price_REPLACE_WITH_BUSINESS_PREMIUM_ID',
} as const;

// ---------------------------------------------------------------------------
// Map billing cycle selection to the correct price ID
// ---------------------------------------------------------------------------
export const USER_PRICE_MAP = {
  monthly: STRIPE_PRICES.LOOP_PLUS_MONTHLY,
  annual: STRIPE_PRICES.LOOP_PLUS_ANNUAL,
} as const;

export const BUSINESS_PRICE_MAP: Record<'boosted' | 'premium', string> = {
  boosted: STRIPE_PRICES.BUSINESS_BOOSTED,
  premium: STRIPE_PRICES.BUSINESS_PREMIUM,
} as const;

// ---------------------------------------------------------------------------
// Deep link URLs for Stripe Checkout redirect
// These must match your app scheme configured in app.config.ts
// ---------------------------------------------------------------------------
export const STRIPE_REDIRECT_URLS = {
  /** Redirect after successful checkout */
  SUCCESS: 'loopapp://stripe/success',
  /** Redirect if user cancels checkout */
  CANCEL: 'loopapp://stripe/cancel',
} as const;

// ---------------------------------------------------------------------------
// Supabase Edge Function names
// ---------------------------------------------------------------------------
export const STRIPE_EDGE_FUNCTIONS = {
  CHECKOUT: 'stripe-checkout',
  WEBHOOK: 'stripe-webhook',
} as const;
