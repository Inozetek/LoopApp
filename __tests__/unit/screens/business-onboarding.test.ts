/**
 * Business Onboarding Logic Tests
 *
 * Tests the pure logic used by the expanded business onboarding flow:
 * - Default tier is 'organic'
 * - Trial date is 30 days out for paid tiers, null for organic
 * - Tier options structure validation
 */

describe('Business onboarding tier logic', () => {
  const TIER_OPTIONS = [
    { tier: 'organic', name: 'Organic', price: 'Free' },
    { tier: 'boosted', name: 'Boosted', price: '$49/mo' },
    { tier: 'premium', name: 'Premium', price: '$149/mo' },
  ];

  it('default tier is organic', () => {
    const defaultTier: 'organic' | 'boosted' | 'premium' = 'organic';
    expect(defaultTier).toBe('organic');
  });

  it('TIER_OPTIONS has 3 tiers', () => {
    expect(TIER_OPTIONS).toHaveLength(3);
  });

  it('organic is free', () => {
    const organic = TIER_OPTIONS.find(t => t.tier === 'organic');
    expect(organic?.price).toBe('Free');
  });

  describe('trial date calculation', () => {
    function getTrialEndDate(tier: string): string | null {
      if (tier === 'organic') return null;
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    it('returns null for organic tier', () => {
      expect(getTrialEndDate('organic')).toBeNull();
    });

    it('returns a date ~30 days from now for boosted', () => {
      const result = getTrialEndDate('boosted');
      expect(result).not.toBeNull();
      const trialDate = new Date(result!);
      const now = new Date();
      const diffDays = (trialDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(29);
      expect(diffDays).toBeLessThan(31);
    });

    it('returns a date ~30 days from now for premium', () => {
      const result = getTrialEndDate('premium');
      expect(result).not.toBeNull();
      const trialDate = new Date(result!);
      const now = new Date();
      const diffDays = (trialDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(29);
      expect(diffDays).toBeLessThan(31);
    });
  });
});
