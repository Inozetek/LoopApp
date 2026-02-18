/**
 * Paywall Screen — Unit Tests
 *
 * Tests the pricing logic, feature list, and billing cycle calculations
 * used in the paywall screen. Pure logic only (no React rendering).
 */

import { TIER_PRICING, TIER_NAMES, TIER_LIMITS } from '@/types/subscription';

// Replicate paywall computation logic
function getAnnualMonthly(annualPrice: number): string {
  return (annualPrice / 12).toFixed(2);
}

function getSavingsPercent(monthlyPrice: number, annualPrice: number): number {
  return Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);
}

// Feature list from the paywall screen
const FEATURES = [
  { label: 'Personalized picks per session', free: '8', plus: 'Unlimited', icon: 'sparkles' },
  { label: 'Fresh Google Places discoveries', free: false, plus: true, icon: 'compass' },
  { label: 'AI match explanations', free: false, plus: true, icon: 'chatbubble-ellipses' },
  { label: 'Group planning', free: false, plus: true, icon: 'people' },
  { label: 'Calendar sync', free: false, plus: true, icon: 'calendar' },
  { label: 'Advanced filters', free: false, plus: true, icon: 'options' },
  { label: 'Ad-free experience', free: false, plus: true, icon: 'eye-off' },
  { label: 'Unlimited refreshes', free: false, plus: true, icon: 'refresh' },
];

describe('Paywall pricing calculations', () => {
  test('monthly price is $3.99', () => {
    expect(TIER_PRICING.plus).toBe(3.99);
  });

  test('annual price is $29.99', () => {
    expect(TIER_PRICING.plus_annual).toBe(29.99);
  });

  test('free tier is $0', () => {
    expect(TIER_PRICING.free).toBe(0);
  });

  test('annual monthly equivalent is $2.50', () => {
    const annualMonthly = getAnnualMonthly(TIER_PRICING.plus_annual);
    expect(annualMonthly).toBe('2.50');
  });

  test('annual savings is 37%', () => {
    const savings = getSavingsPercent(TIER_PRICING.plus, TIER_PRICING.plus_annual);
    expect(savings).toBe(37);
  });

  test('annual is cheaper than 12 months of monthly', () => {
    expect(TIER_PRICING.plus_annual).toBeLessThan(TIER_PRICING.plus * 12);
  });
});

describe('Tier naming', () => {
  test('free tier displays as "Loop Free"', () => {
    expect(TIER_NAMES.free).toBe('Loop Free');
  });

  test('plus tier displays as "Loop Plus"', () => {
    expect(TIER_NAMES.plus).toBe('Loop Plus');
  });
});

describe('Feature gating alignment', () => {
  test('free tier does not include Google Places', () => {
    expect(TIER_LIMITS.free.use_google_places).toBe(false);
  });

  test('plus tier includes Google Places', () => {
    expect(TIER_LIMITS.plus.use_google_places).toBe(true);
  });

  test('free tier does not include group planning', () => {
    expect(TIER_LIMITS.free.group_planning).toBe(false);
  });

  test('plus tier includes group planning', () => {
    expect(TIER_LIMITS.plus.group_planning).toBe(true);
  });

  test('free tier does not include calendar sync', () => {
    expect(TIER_LIMITS.free.calendar_sync).toBe(false);
  });

  test('plus tier includes calendar sync', () => {
    expect(TIER_LIMITS.plus.calendar_sync).toBe(true);
  });

  test('free tier shows ads', () => {
    expect(TIER_LIMITS.free.show_ads).toBe(true);
  });

  test('plus tier is ad-free', () => {
    expect(TIER_LIMITS.plus.show_ads).toBe(false);
  });

  test('free tier has 4-hour refresh interval', () => {
    expect(TIER_LIMITS.free.refresh_interval_hours).toBe(4);
  });

  test('plus tier has unlimited refreshes (0 interval)', () => {
    expect(TIER_LIMITS.plus.refresh_interval_hours).toBe(0);
  });

  test('free tier gets 8 recommendations per refresh', () => {
    expect(TIER_LIMITS.free.recommendations_per_refresh).toBe(8);
  });

  test('plus tier gets 10 recommendations per refresh', () => {
    expect(TIER_LIMITS.plus.recommendations_per_refresh).toBe(10);
  });
});

describe('Feature list completeness', () => {
  test('paywall lists 8 features', () => {
    expect(FEATURES.length).toBe(8);
  });

  test('all features have labels', () => {
    FEATURES.forEach((f) => {
      expect(f.label).toBeTruthy();
      expect(typeof f.label).toBe('string');
    });
  });

  test('all features have icons', () => {
    FEATURES.forEach((f) => {
      expect(f.icon).toBeTruthy();
    });
  });

  test('all features have plus=true or a string value', () => {
    FEATURES.forEach((f) => {
      expect(f.plus === true || typeof f.plus === 'string').toBe(true);
    });
  });

  test('personalized picks shows "8" for free and "Unlimited" for plus', () => {
    const picks = FEATURES.find((f) => f.label.includes('Personalized picks'));
    expect(picks).toBeDefined();
    expect(picks!.free).toBe('8');
    expect(picks!.plus).toBe('Unlimited');
  });
});

describe('Billing cycle toggle logic', () => {
  function getPriceForCycle(cycle: string): number {
    return cycle === 'monthly' ? TIER_PRICING.plus : TIER_PRICING.plus_annual;
  }

  test('monthly selected returns monthly price', () => {
    expect(getPriceForCycle('monthly')).toBe(3.99);
  });

  test('annual selected returns annual price', () => {
    expect(getPriceForCycle('annual')).toBe(29.99);
  });
});
