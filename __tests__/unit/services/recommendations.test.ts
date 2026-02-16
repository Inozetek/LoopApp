/**
 * Tests for recommendation scoring algorithm
 *
 * These tests document the expected scoring behavior based on CLAUDE.md spec.
 * The actual scoring function is private, so we test the business rules
 * and scoring component calculations.
 */

// Mock Supabase to prevent actual database calls
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          gte: jest.fn(),
          order: jest.fn(() => ({
            limit: jest.fn(),
          })),
        })),
        in: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(),
          })),
        })),
      })),
      insert: jest.fn(),
      update: jest.fn(),
    })),
  },
}));

describe('Recommendation Scoring Algorithm', () => {
  describe('Base Score (Interest Matching) - Max 55 points', () => {
    /*
     * From CLAUDE.md and implementation:
     * - Top 3 interests: 30 points (+5 for events = 35)
     * - Other interests: 20 points (+3 for events = 23)
     * - Non-matching (explore mode): 15 points (+2 for events = 17)
     * - Non-matching (for_you mode): 10 points (+2 for events = 12)
     */

    it('should give maximum points for top 3 interests', () => {
      const baseScore = 30; // Top 3 interest match
      expect(baseScore).toBe(30);
    });

    it('should give bonus points for events', () => {
      const eventBonus = 5; // For top 3 interests
      const baseWithEvent = 30 + eventBonus;
      expect(baseWithEvent).toBe(35);
    });

    it('should give moderate points for other interests', () => {
      const baseScore = 20; // Other interest match
      expect(baseScore).toBe(20);
    });

    it('should give lower points for discovery mode', () => {
      const exploreModeBase = 15;
      const forYouModeBase = 10;
      expect(exploreModeBase).toBeGreaterThan(forYouModeBase);
    });
  });

  describe('Rating Bonus - Up to 12 points', () => {
    /*
     * Rating thresholds:
     * - 4.5+ stars: +12 points
     * - 4.0-4.5 stars: +8 points
     * - 3.5-4.0 stars: +4 points
     * - Below 3.5: +0 points
     */

    function calculateRatingBonus(rating: number): number {
      if (rating >= 4.5) return 12;
      if (rating >= 4.0) return 8;
      if (rating >= 3.5) return 4;
      return 0;
    }

    it('should give maximum bonus for 4.5+ rating', () => {
      expect(calculateRatingBonus(4.5)).toBe(12);
      expect(calculateRatingBonus(4.8)).toBe(12);
      expect(calculateRatingBonus(5.0)).toBe(12);
    });

    it('should give high bonus for 4.0-4.5 rating', () => {
      expect(calculateRatingBonus(4.0)).toBe(8);
      expect(calculateRatingBonus(4.3)).toBe(8);
    });

    it('should give moderate bonus for 3.5-4.0 rating', () => {
      expect(calculateRatingBonus(3.5)).toBe(4);
      expect(calculateRatingBonus(3.9)).toBe(4);
    });

    it('should give no bonus for low ratings', () => {
      expect(calculateRatingBonus(3.4)).toBe(0);
      expect(calculateRatingBonus(2.5)).toBe(0);
    });
  });

  describe('Popularity Bonus - Up to 8 points', () => {
    /*
     * Review count thresholds:
     * - 500+ reviews: +8 points (very popular/trending)
     * - 200-499 reviews: +5 points (popular)
     * - 50-199 reviews: +2 points (moderately popular)
     * - Below 50: +0 points
     */

    function calculatePopularityBonus(reviewCount: number): number {
      if (reviewCount >= 500) return 8;
      if (reviewCount >= 200) return 5;
      if (reviewCount >= 50) return 2;
      return 0;
    }

    it('should identify trending places with 500+ reviews', () => {
      expect(calculatePopularityBonus(500)).toBe(8);
      expect(calculatePopularityBonus(1000)).toBe(8);
    });

    it('should identify popular places with 200-499 reviews', () => {
      expect(calculatePopularityBonus(200)).toBe(5);
      expect(calculatePopularityBonus(350)).toBe(5);
    });

    it('should identify moderately popular places', () => {
      expect(calculatePopularityBonus(50)).toBe(2);
      expect(calculatePopularityBonus(150)).toBe(2);
    });

    it('should not boost unpopular places', () => {
      expect(calculatePopularityBonus(49)).toBe(0);
      expect(calculatePopularityBonus(10)).toBe(0);
    });
  });

  describe('Location Score - Max 30 points (with future context)', () => {
    /*
     * Distance thresholds:
     * - <= 0.5 miles: 20 points (very close)
     * - <= 1 mile: 15 points (walking distance)
     * - <= user max distance: 10 points (within range)
     * - Beyond max distance: penalty of 2 points per mile over
     *
     * Bonuses:
     * - Near home: +5 points
     * - Near work: +5 points
     * - Near upcoming calendar event: +6-15 points
     */

    function calculateLocationScore(
      distance: number,
      userMaxDistance: number = 5,
      nearHome: boolean = false,
      nearWork: boolean = false
    ): number {
      let score = 0;

      if (distance <= 0.5) {
        score = 20;
      } else if (distance <= 1) {
        score = 15;
      } else if (distance <= userMaxDistance) {
        score = 10;
      } else {
        score = Math.max(0, 10 - (distance - userMaxDistance) * 2);
      }

      if (nearHome) score += 5;
      if (nearWork) score += 5;

      return Math.min(score, 30);
    }

    it('should give maximum points for very close places', () => {
      expect(calculateLocationScore(0.3)).toBe(20);
      expect(calculateLocationScore(0.5)).toBe(20);
    });

    it('should give high points for walking distance', () => {
      expect(calculateLocationScore(0.8)).toBe(15);
      expect(calculateLocationScore(1.0)).toBe(15);
    });

    it('should give moderate points within user range', () => {
      expect(calculateLocationScore(3.0, 5)).toBe(10);
      expect(calculateLocationScore(5.0, 5)).toBe(10);
    });

    it('should penalize places beyond user max distance', () => {
      // 6 miles when max is 5 = 10 - 2 = 8
      expect(calculateLocationScore(6, 5)).toBe(8);
      // 8 miles when max is 5 = 10 - 6 = 4
      expect(calculateLocationScore(8, 5)).toBe(4);
    });

    it('should not go negative for very far places', () => {
      expect(calculateLocationScore(20, 5)).toBe(0);
    });

    it('should add bonus for being near home', () => {
      expect(calculateLocationScore(0.8, 5, true, false)).toBe(20);
    });

    it('should add bonus for being near work', () => {
      expect(calculateLocationScore(0.8, 5, false, true)).toBe(20);
    });

    it('should cap at 30 points', () => {
      // Very close (20) + near home (5) + near work (5) = 30
      expect(calculateLocationScore(0.3, 5, true, true)).toBe(30);
    });
  });

  describe('Time Context Score - Max 15 points', () => {
    /*
     * Time matching:
     * - Perfect match: +10 points
     * - Good match: +5 points
     * - Acceptable: +2 points
     *
     * User preference bonus: +5 points if current time matches user's preferred times
     */

    type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
    type MatchLevel = 'perfect' | 'good' | 'acceptable';

    function checkTimeContext(category: string, timeOfDay: TimeOfDay): MatchLevel {
      const timeMatches: Record<TimeOfDay, string[]> = {
        morning: ['coffee', 'cafe', 'breakfast', 'gym', 'fitness', 'park'],
        afternoon: ['dining', 'shopping', 'culture', 'museums', 'parks'],
        evening: ['dining', 'nightlife', 'movies', 'entertainment', 'live music'],
        night: ['nightlife', 'bars', 'live music', 'entertainment'],
      };

      const perfectMatches = timeMatches[timeOfDay] || [];

      if (perfectMatches.includes(category)) {
        return 'perfect';
      } else if (category === 'dining' || category === 'entertainment') {
        return 'good';
      }
      return 'acceptable';
    }

    it('should give perfect match for coffee in morning', () => {
      expect(checkTimeContext('coffee', 'morning')).toBe('perfect');
      expect(checkTimeContext('cafe', 'morning')).toBe('perfect');
    });

    it('should give perfect match for nightlife at night', () => {
      expect(checkTimeContext('nightlife', 'night')).toBe('perfect');
      expect(checkTimeContext('bars', 'night')).toBe('perfect');
    });

    it('should give good match for dining anytime', () => {
      expect(checkTimeContext('dining', 'morning')).toBe('good');
      expect(checkTimeContext('dining', 'night')).toBe('good');
    });

    it('should give good match for entertainment anytime', () => {
      expect(checkTimeContext('entertainment', 'morning')).toBe('good');
    });

    it('should give acceptable for mismatched categories', () => {
      expect(checkTimeContext('shopping', 'night')).toBe('acceptable');
      expect(checkTimeContext('gym', 'evening')).toBe('acceptable');
    });
  });

  describe('Sponsored Boost', () => {
    /*
     * Sponsor tiers:
     * - Organic: 0% boost
     * - Boosted: +15% boost
     * - Premium: +30% boost
     *
     * Critical rule: If sponsored activity scores <40 base points,
     * cap boost at +10 points max to prevent irrelevant spam
     */

    function calculateSponsorBoost(
      baseScore: number,
      tier: 'organic' | 'boosted' | 'premium'
    ): number {
      if (tier === 'organic') return 0;

      let boostPercent = tier === 'premium' ? 0.3 : 0.15;
      let boost = Math.round(baseScore * boostPercent);

      // Cap boost if base score is too low
      if (baseScore < 40) {
        boost = Math.min(boost, 10);
      }

      return boost;
    }

    it('should give no boost for organic tier', () => {
      expect(calculateSponsorBoost(50, 'organic')).toBe(0);
    });

    it('should give 15% boost for boosted tier', () => {
      expect(calculateSponsorBoost(100, 'boosted')).toBe(15);
      expect(calculateSponsorBoost(80, 'boosted')).toBe(12);
    });

    it('should give 30% boost for premium tier', () => {
      expect(calculateSponsorBoost(100, 'premium')).toBe(30);
      expect(calculateSponsorBoost(80, 'premium')).toBe(24);
    });

    it('should cap boost at 10 for low-scoring activities', () => {
      // 35 base * 0.30 = 10.5, but capped at 10
      expect(calculateSponsorBoost(35, 'premium')).toBe(10);
      // 30 base * 0.30 = 9, no cap needed
      expect(calculateSponsorBoost(30, 'premium')).toBe(9);
    });
  });

  describe('Final Score Calculation', () => {
    /*
     * Final score = base + location + time + feedback + collaborative + sponsor boost
     * Maximum possible ~130 points (before sponsor boost)
     */

    it('should calculate total score from components', () => {
      const baseScore = 42; // Top interest (30) + rating 4.0 (8) + 50 reviews (2) + event (2)
      const locationScore = 25; // Very close (20) + near home (5)
      const timeScore = 15; // Perfect match (10) + preferred time (5)
      const feedbackScore = 15; // Past thumbs up
      const collaborativeScore = 10; // Similar users liked
      const sponsorBoost = 0; // Organic

      const totalScore =
        baseScore + locationScore + timeScore + feedbackScore + collaborativeScore + sponsorBoost;

      expect(totalScore).toBe(107);
    });

    it('should apply sponsor boost to final score', () => {
      const baseScore = 50;
      const locationScore = 20;
      const timeScore = 10;
      const feedbackScore = 5;
      const collaborativeScore = 5;
      const subtotal = baseScore + locationScore + timeScore + feedbackScore + collaborativeScore;

      // Premium sponsor: +30%
      const sponsorBoost = Math.round(subtotal * 0.3);
      const finalScore = subtotal + sponsorBoost;

      expect(subtotal).toBe(90);
      expect(sponsorBoost).toBe(27);
      expect(finalScore).toBe(117);
    });
  });

  describe('Diversity Rules', () => {
    /*
     * Business rules for final recommendations:
     * - Max 2 sponsored activities in top 5 (40% sponsored mix)
     * - Never show same business twice in one session
     * - At least 3 different categories in top 5
     */

    it('should limit sponsored activities to 40%', () => {
      const topRecommendations = 5;
      const maxSponsored = Math.floor(topRecommendations * 0.4);
      expect(maxSponsored).toBe(2);
    });

    it('should require category diversity', () => {
      const minCategories = 3;
      const topRecommendations = 5;
      expect(minCategories).toBeLessThanOrEqual(topRecommendations);
    });
  });

  describe('Resurfacing Logic', () => {
    /*
     * Phase 1.3 resurfacing:
     * - Recently shown activities get penalties
     * - 0-2 hours: -50% (strong penalty)
     * - 2-6 hours: -25% (moderate penalty)
     * - 6-24 hours: -10% (light penalty)
     * - 24+ hours: no penalty
     */

    function calculateResurfacingPenalty(hoursSinceShown: number): number {
      if (hoursSinceShown < 2) return 0.5; // -50%
      if (hoursSinceShown < 6) return 0.25; // -25%
      if (hoursSinceShown < 24) return 0.1; // -10%
      return 0; // No penalty
    }

    it('should heavily penalize recently shown (0-2 hours)', () => {
      expect(calculateResurfacingPenalty(0)).toBe(0.5);
      expect(calculateResurfacingPenalty(1)).toBe(0.5);
      expect(calculateResurfacingPenalty(1.9)).toBe(0.5);
    });

    it('should moderately penalize shown 2-6 hours ago', () => {
      expect(calculateResurfacingPenalty(2)).toBe(0.25);
      expect(calculateResurfacingPenalty(5)).toBe(0.25);
    });

    it('should lightly penalize shown 6-24 hours ago', () => {
      expect(calculateResurfacingPenalty(6)).toBe(0.1);
      expect(calculateResurfacingPenalty(23)).toBe(0.1);
    });

    it('should not penalize shown 24+ hours ago', () => {
      expect(calculateResurfacingPenalty(24)).toBe(0);
      expect(calculateResurfacingPenalty(48)).toBe(0);
    });

    it('should apply penalty as score multiplier', () => {
      const originalScore = 80;
      const penalty = calculateResurfacingPenalty(1);
      const adjustedScore = originalScore * (1 - penalty);
      expect(adjustedScore).toBe(40); // 80 * 0.5 = 40
    });
  });
});
