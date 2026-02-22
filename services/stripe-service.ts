/**
 * Stripe Service
 *
 * Production-ready Stripe integration for Loop App.
 *
 * Architecture:
 *   Client (this file) -> Supabase Edge Function -> Stripe API
 *
 * The client NEVER touches the Stripe secret key. All operations that require
 * the secret key (creating checkout sessions, managing subscriptions, etc.)
 * are delegated to Supabase Edge Functions.
 *
 * The client-side Stripe SDK is used only for:
 *   - Initializing the Stripe provider (publishable key)
 *   - Opening payment sheets / collecting card info (future)
 *
 * Edge function endpoint: supabase.functions.invoke('stripe-checkout', { body })
 */

import { supabase } from '@/lib/supabase';
import {
  STRIPE_PRICES,
  STRIPE_REDIRECT_URLS,
  STRIPE_EDGE_FUNCTIONS,
  BUSINESS_PRICE_MAP,
  USER_PRICE_MAP,
} from '@/constants/stripe';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusinessPlan {
  tier: 'boosted' | 'premium';
  name: string;
  priceMonthly: number;      // e.g. 49
  priceCents: number;         // e.g. 4900
  features: string[];
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
}

export interface CheckoutSessionResult {
  url: string | null;
  error: string | null;
}

export interface SubscriptionStatus {
  tier: 'free' | 'plus' | 'premium';
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'none';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface BusinessSubscriptionStatus {
  tier: 'organic' | 'boosted' | 'premium';
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'inactive';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface CustomerPortalResult {
  url: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Business plan constants (unchanged from original for backward compatibility)
// ---------------------------------------------------------------------------

export const BUSINESS_PLANS: BusinessPlan[] = [
  {
    tier: 'boosted',
    name: 'Boosted',
    priceMonthly: 49,
    priceCents: 4900,
    features: [
      '+15% algorithm score boost',
      '"Sponsored" label on cards',
      'Basic analytics (impressions, clicks)',
      '500-1,000 targeted users/month',
    ],
  },
  {
    tier: 'premium',
    name: 'Premium',
    priceMonthly: 149,
    priceCents: 14900,
    features: [
      '+30% algorithm score boost',
      'Top placement in recommendations',
      '"Featured" label on cards',
      'Full analytics dashboard',
      'Dedicated account manager',
      '1,500-3,000 targeted users/month',
    ],
  },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Invoke a Supabase Edge Function for Stripe operations.
 * Returns { data, error } with typed response.
 */
async function invokeStripeFunction<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      STRIPE_EDGE_FUNCTIONS.CHECKOUT,
      {
        body: { action, ...payload },
      },
    );

    if (error) {
      console.error(`[Stripe] Edge function error (${action}):`, error);
      return {
        data: null,
        error: error.message || 'An error occurred with the payment service.',
      };
    }

    // Edge functions return the response body directly
    // If the function returned an error field in the JSON body, propagate it
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      return { data: null, error: data.error as string };
    }

    return { data: data as T, error: null };
  } catch (err) {
    console.error(`[Stripe] Unexpected error (${action}):`, err);
    return {
      data: null,
      error:
        'Payment service is not available right now. Please try again later.',
    };
  }
}

// ---------------------------------------------------------------------------
// User subscription functions (Loop Plus)
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Checkout session for a Loop Plus subscription.
 *
 * @param userId - The Supabase user ID
 * @param billingCycle - 'monthly' or 'annual'
 * @returns An object with `url` to open in a browser, or `error`.
 */
export async function createUserCheckoutSession(
  userId: string,
  billingCycle: 'monthly' | 'annual',
): Promise<CheckoutSessionResult> {
  const priceId = USER_PRICE_MAP[billingCycle];

  const { data, error } = await invokeStripeFunction<{ url: string }>(
    'create_user_checkout',
    {
      userId,
      priceId,
      successUrl: STRIPE_REDIRECT_URLS.SUCCESS,
      cancelUrl: STRIPE_REDIRECT_URLS.CANCEL,
    },
  );

  if (error || !data?.url) {
    return { url: null, error: error || 'Failed to create checkout session.' };
  }

  return { url: data.url, error: null };
}

/**
 * Get the current user subscription status by reading the users table.
 * This avoids an extra Edge Function call for simple status checks.
 */
export async function getUserSubscriptionStatus(
  userId: string,
): Promise<SubscriptionStatus> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('subscription_tier, subscription_status, subscription_end_date')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return {
        tier: 'free',
        status: 'none',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    return {
      tier: data.subscription_tier || 'free',
      status: data.subscription_status || 'none',
      currentPeriodEnd: data.subscription_end_date || null,
      cancelAtPeriodEnd: data.subscription_status === 'cancelled',
    };
  } catch {
    return {
      tier: 'free',
      status: 'none',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
}

/**
 * Cancel the current user subscription.
 * The subscription will remain active until the end of the billing period.
 */
export async function cancelUserSubscription(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await invokeStripeFunction('cancel_user_subscription', {
    userId,
  });

  if (error) {
    return { success: false, error };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Business subscription functions (Boosted / Premium)
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Checkout session for a business subscription.
 *
 * @param businessId - The business profile ID
 * @param tier - 'boosted' or 'premium'
 * @returns An object with `url` to open in a browser, or `error`.
 */
export async function createBusinessCheckoutSession(
  businessId: string,
  tier: 'boosted' | 'premium',
): Promise<CheckoutSessionResult> {
  const priceId = BUSINESS_PRICE_MAP[tier];

  const { data, error } = await invokeStripeFunction<{ url: string }>(
    'create_business_checkout',
    {
      businessId,
      priceId,
      tier,
      successUrl: STRIPE_REDIRECT_URLS.SUCCESS,
      cancelUrl: STRIPE_REDIRECT_URLS.CANCEL,
    },
  );

  if (error || !data?.url) {
    return { url: null, error: error || 'Failed to create checkout session.' };
  }

  return { url: data.url, error: null };
}

/**
 * Get the current business subscription status by reading the business_profiles table.
 */
export async function getBusinessSubscriptionStatus(
  businessId: string,
): Promise<BusinessSubscriptionStatus> {
  try {
    const { data, error } = await supabase
      .from('business_profiles')
      .select(
        'business_tier, business_subscription_status, trial_ends_at',
      )
      .eq('id', businessId)
      .maybeSingle();

    if (error || !data) {
      return {
        tier: 'organic',
        status: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    return {
      tier: data.business_tier || 'organic',
      status: data.business_subscription_status || 'active',
      currentPeriodEnd: data.trial_ends_at || null,
      cancelAtPeriodEnd: data.business_subscription_status === 'cancelled',
    };
  } catch {
    return {
      tier: 'organic',
      status: 'active',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
}

/**
 * Cancel the current business subscription.
 */
export async function cancelBusinessSubscription(
  businessId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await invokeStripeFunction(
    'cancel_business_subscription',
    { businessId },
  );

  if (error) {
    return { success: false, error };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Backward-compatible alias (used by old code / tests)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use createBusinessCheckoutSession instead.
 * Kept for backward compatibility with existing code.
 */
export async function initiateBusinessSubscription(
  userId: string,
  tier: 'boosted' | 'premium',
): Promise<SubscriptionResult> {
  const plan = BUSINESS_PLANS.find((p) => p.tier === tier);
  if (!plan) {
    return { success: false, error: `Unknown tier: ${tier}` };
  }

  const result = await createBusinessCheckoutSession(userId, tier);

  if (result.error) {
    return { success: false, error: result.error };
  }

  // Return the checkout URL as the subscriptionId for backward compat
  return {
    success: true,
    subscriptionId: result.url || undefined,
  };
}

// ---------------------------------------------------------------------------
// Customer Portal (manage existing subscription)
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Customer Portal session.
 * Allows the user to manage their subscription, update payment method, etc.
 */
export async function createCustomerPortalSession(
  userId: string,
): Promise<CustomerPortalResult> {
  const { data, error } = await invokeStripeFunction<{ url: string }>(
    'create_portal_session',
    {
      userId,
      returnUrl: STRIPE_REDIRECT_URLS.SUCCESS,
    },
  );

  if (error || !data?.url) {
    return {
      url: null,
      error: error || 'Failed to create customer portal session.',
    };
  }

  return { url: data.url, error: null };
}

// ---------------------------------------------------------------------------
// Restore purchases (verify subscription status from Stripe via Edge Function)
// ---------------------------------------------------------------------------

/**
 * Verify and restore a user's subscription status by checking Stripe directly.
 * Useful when local DB state may be stale (e.g., after re-install).
 */
export async function restoreUserSubscription(
  userId: string,
): Promise<{ success: boolean; tier: string; error?: string }> {
  const { data, error } = await invokeStripeFunction<{
    tier: string;
    status: string;
  }>('restore_subscription', { userId });

  if (error) {
    return { success: false, tier: 'free', error };
  }

  return {
    success: true,
    tier: data?.tier || 'free',
  };
}
