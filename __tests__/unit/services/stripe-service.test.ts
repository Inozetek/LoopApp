/**
 * Stripe Service Stub Tests
 */

import {
  BUSINESS_PLANS,
  initiateBusinessSubscription,
  cancelBusinessSubscription,
  getBusinessSubscriptionStatus,
} from '@/services/stripe-service';

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

describe('initiateBusinessSubscription', () => {
  it('returns success with subscriptionId for valid tier', async () => {
    const result = await initiateBusinessSubscription('user-1', 'boosted');
    expect(result.success).toBe(true);
    expect(result.subscriptionId).toContain('sub_stub_user-1_boosted');
  });

  it('returns error for unknown tier', async () => {
    const result = await initiateBusinessSubscription('user-1', 'unknown' as any);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tier');
  });
});

describe('cancelBusinessSubscription', () => {
  it('returns success', async () => {
    const result = await cancelBusinessSubscription('sub_123');
    expect(result.success).toBe(true);
  });
});

describe('getBusinessSubscriptionStatus', () => {
  it('returns default organic/active for any user', async () => {
    const result = await getBusinessSubscriptionStatus('user-1');
    expect(result.tier).toBe('organic');
    expect(result.status).toBe('active');
  });
});
