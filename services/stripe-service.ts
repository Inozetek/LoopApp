/**
 * Stripe Service — Stub
 *
 * Placeholder service for business subscription management.
 * Real Stripe integration will replace the stubs once the Stripe SDK is added.
 */

export interface BusinessPlan {
  tier: 'boosted' | 'premium';
  name: string;
  priceMonthly: number;      // e.g. 49
  priceCents: number;         // e.g. 4900
  features: string[];
}

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

export interface SubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
}

/**
 * Initiate a business subscription (stub).
 * In production this would create a Stripe Checkout session.
 */
export async function initiateBusinessSubscription(
  userId: string,
  tier: 'boosted' | 'premium',
): Promise<SubscriptionResult> {
  // Stub: simulate Stripe subscription creation
  const plan = BUSINESS_PLANS.find(p => p.tier === tier);
  if (!plan) {
    return { success: false, error: `Unknown tier: ${tier}` };
  }
  return {
    success: true,
    subscriptionId: `sub_stub_${userId}_${tier}_${Date.now()}`,
  };
}

/**
 * Cancel a business subscription (stub).
 */
export async function cancelBusinessSubscription(
  subscriptionId: string,
): Promise<{ success: boolean }> {
  return { success: true };
}

/**
 * Get business subscription status (stub).
 */
export async function getBusinessSubscriptionStatus(
  userId: string,
): Promise<{ tier: 'organic' | 'boosted' | 'premium'; status: 'active' | 'cancelled' | 'trialing' }> {
  return { tier: 'organic', status: 'active' };
}
