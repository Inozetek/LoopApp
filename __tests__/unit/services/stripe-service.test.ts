/**
 * Stripe Service Tests
 *
 * Tests for Stripe integration service layer.
 * All Supabase calls are mocked — no real network requests.
 */

// Mock supabase before importing anything that uses it
const mockInvoke = jest.fn();
const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    from: mockFrom,
  },
}));

import {
  BUSINESS_PLANS,
  createUserCheckoutSession,
  getUserSubscriptionStatus,
  cancelUserSubscription,
  createBusinessCheckoutSession,
  getBusinessSubscriptionStatus,
  cancelBusinessSubscription,
  createCustomerPortalSession,
  restoreUserSubscription,
  initiateBusinessSubscription,
} from '@/services/stripe-service';

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// BUSINESS_PLANS constants
// ---------------------------------------------------------------------------

describe('BUSINESS_PLANS', () => {
  it('has exactly 2 plans', () => {
    expect(BUSINESS_PLANS).toHaveLength(2);
  });

  it('boosted plan has correct price', () => {
    const boosted = BUSINESS_PLANS.find(p => p.tier === 'boosted');
    expect(boosted).toBeDefined();
    expect(boosted!.priceMonthly).toBe(49);
    expect(boosted!.priceCents).toBe(4900);
  });

  it('premium plan has correct price', () => {
    const premium = BUSINESS_PLANS.find(p => p.tier === 'premium');
    expect(premium).toBeDefined();
    expect(premium!.priceMonthly).toBe(149);
    expect(premium!.priceCents).toBe(14900);
  });

  it('each plan has a non-empty features array', () => {
    for (const plan of BUSINESS_PLANS) {
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// User checkout session
// ---------------------------------------------------------------------------

describe('createUserCheckoutSession', () => {
  it('returns a checkout URL on success', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { url: 'https://checkout.stripe.com/session_123' },
      error: null,
    });

    const result = await createUserCheckoutSession('user-1', 'monthly');

    expect(result.url).toBe('https://checkout.stripe.com/session_123');
    expect(result.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith('stripe-checkout', {
      body: expect.objectContaining({
        action: 'create_user_checkout',
        userId: 'user-1',
      }),
    });
  });

  it('returns error when edge function fails', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Edge function unavailable' },
    });

    const result = await createUserCheckoutSession('user-1', 'annual');

    expect(result.url).toBeNull();
    expect(result.error).toBe('Edge function unavailable');
  });

  it('returns error when edge function returns error in body', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { error: 'Missing priceId' },
      error: null,
    });

    const result = await createUserCheckoutSession('user-1', 'monthly');

    expect(result.url).toBeNull();
    expect(result.error).toBe('Missing priceId');
  });

  it('handles unexpected exceptions gracefully', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Network error'));

    const result = await createUserCheckoutSession('user-1', 'monthly');

    expect(result.url).toBeNull();
    expect(result.error).toContain('not available');
  });
});

// ---------------------------------------------------------------------------
// User subscription status (reads from DB)
// ---------------------------------------------------------------------------

describe('getUserSubscriptionStatus', () => {
  it('returns user subscription data from database', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        subscription_tier: 'plus',
        subscription_status: 'active',
        subscription_end_date: '2026-03-15T00:00:00Z',
      },
      error: null,
    });

    const result = await getUserSubscriptionStatus('user-1');

    expect(result.tier).toBe('plus');
    expect(result.status).toBe('active');
    expect(result.currentPeriodEnd).toBe('2026-03-15T00:00:00Z');
  });

  it('returns free/none defaults when user not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getUserSubscriptionStatus('user-unknown');

    expect(result.tier).toBe('free');
    expect(result.status).toBe('none');
  });

  it('returns free/none defaults on database error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB error' },
    });

    const result = await getUserSubscriptionStatus('user-1');

    expect(result.tier).toBe('free');
    expect(result.status).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Cancel user subscription
// ---------------------------------------------------------------------------

describe('cancelUserSubscription', () => {
  it('returns success on successful cancellation', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const result = await cancelUserSubscription('user-1');

    expect(result.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('stripe-checkout', {
      body: expect.objectContaining({
        action: 'cancel_user_subscription',
        userId: 'user-1',
      }),
    });
  });

  it('returns error when cancellation fails', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'No active subscription found' },
    });

    const result = await cancelUserSubscription('user-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No active subscription found');
  });
});

// ---------------------------------------------------------------------------
// Business checkout session
// ---------------------------------------------------------------------------

describe('createBusinessCheckoutSession', () => {
  it('returns a checkout URL for boosted tier', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { url: 'https://checkout.stripe.com/biz_session_456' },
      error: null,
    });

    const result = await createBusinessCheckoutSession('biz-1', 'boosted');

    expect(result.url).toBe('https://checkout.stripe.com/biz_session_456');
    expect(result.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith('stripe-checkout', {
      body: expect.objectContaining({
        action: 'create_business_checkout',
        businessId: 'biz-1',
        tier: 'boosted',
      }),
    });
  });

  it('returns a checkout URL for premium tier', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { url: 'https://checkout.stripe.com/biz_session_789' },
      error: null,
    });

    const result = await createBusinessCheckoutSession('biz-2', 'premium');

    expect(result.url).toBe('https://checkout.stripe.com/biz_session_789');
    expect(result.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Business subscription status (reads from DB)
// ---------------------------------------------------------------------------

describe('getBusinessSubscriptionStatus', () => {
  it('returns business subscription data from database', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        business_tier: 'boosted',
        business_subscription_status: 'active',
        trial_ends_at: '2026-04-01T00:00:00Z',
      },
      error: null,
    });

    const result = await getBusinessSubscriptionStatus('biz-1');

    expect(result.tier).toBe('boosted');
    expect(result.status).toBe('active');
  });

  it('returns organic defaults when business not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getBusinessSubscriptionStatus('biz-unknown');

    expect(result.tier).toBe('organic');
    expect(result.status).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// Cancel business subscription
// ---------------------------------------------------------------------------

describe('cancelBusinessSubscription', () => {
  it('returns success on successful cancellation', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const result = await cancelBusinessSubscription('biz-1');

    expect(result.success).toBe(true);
  });

  it('returns error on failure', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'No active subscription found' },
    });

    const result = await cancelBusinessSubscription('biz-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No active subscription found');
  });
});

// ---------------------------------------------------------------------------
// Customer portal session
// ---------------------------------------------------------------------------

describe('createCustomerPortalSession', () => {
  it('returns a portal URL on success', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { url: 'https://billing.stripe.com/portal_123' },
      error: null,
    });

    const result = await createCustomerPortalSession('user-1');

    expect(result.url).toBe('https://billing.stripe.com/portal_123');
    expect(result.error).toBeNull();
  });

  it('returns error when no Stripe customer exists', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { error: 'No Stripe customer found. Subscribe first.' },
      error: null,
    });

    const result = await createCustomerPortalSession('user-no-sub');

    expect(result.url).toBeNull();
    expect(result.error).toContain('No Stripe customer found');
  });
});

// ---------------------------------------------------------------------------
// Restore subscription
// ---------------------------------------------------------------------------

describe('restoreUserSubscription', () => {
  it('returns plus tier when subscription is found', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { tier: 'plus', status: 'active' },
      error: null,
    });

    const result = await restoreUserSubscription('user-1');

    expect(result.success).toBe(true);
    expect(result.tier).toBe('plus');
  });

  it('returns free tier when no subscription exists', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { tier: 'free', status: 'none' },
      error: null,
    });

    const result = await restoreUserSubscription('user-free');

    expect(result.success).toBe(true);
    expect(result.tier).toBe('free');
  });

  it('returns error on failure', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Service unavailable' },
    });

    const result = await restoreUserSubscription('user-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Service unavailable');
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility: initiateBusinessSubscription
// ---------------------------------------------------------------------------

describe('initiateBusinessSubscription (backward compat)', () => {
  it('returns success with URL as subscriptionId for valid tier', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { url: 'https://checkout.stripe.com/compat_session' },
      error: null,
    });

    const result = await initiateBusinessSubscription('user-1', 'boosted');

    expect(result.success).toBe(true);
    expect(result.subscriptionId).toBe('https://checkout.stripe.com/compat_session');
  });

  it('returns error for unknown tier', async () => {
    const result = await initiateBusinessSubscription('user-1', 'unknown' as any);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tier');
  });

  it('returns error when edge function fails', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Server error' },
    });

    const result = await initiateBusinessSubscription('user-1', 'premium');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Server error');
  });
});
