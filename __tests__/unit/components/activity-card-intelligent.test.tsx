/**
 * Tests for Activity Card Intelligent component logic
 *
 * Tests the pure scoring, display, and formatting functions
 * used in the activity card component.
 */

// Mock Supabase to prevent database calls
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}));

describe('Activity Card Intelligent - Pure Logic', () => {
  describe('Score Percentage Calculations', () => {
    /**
     * Mirrors StackedScoreBar logic from activity-card-intelligent.tsx
     * totalActualScore = sum of all component scores
     * Each component's percent = (componentScore / totalActualScore) * 100
     */
    function calculateScorePercentages(scoreBreakdown: {
      baseScore: number;
      locationScore: number;
      timeScore: number;
      feedbackScore: number;
      collaborativeScore: number;
    }) {
      const totalActualScore =
        scoreBreakdown.baseScore +
        scoreBreakdown.locationScore +
        scoreBreakdown.timeScore +
        scoreBreakdown.feedbackScore +
        scoreBreakdown.collaborativeScore;

      return {
        totalActualScore,
        basePercent: totalActualScore > 0 ? (scoreBreakdown.baseScore / totalActualScore) * 100 : 0,
        locationPercent: totalActualScore > 0 ? (scoreBreakdown.locationScore / totalActualScore) * 100 : 0,
        timePercent: totalActualScore > 0 ? (scoreBreakdown.timeScore / totalActualScore) * 100 : 0,
        feedbackPercent: totalActualScore > 0 ? (scoreBreakdown.feedbackScore / totalActualScore) * 100 : 0,
        collaborativePercent: totalActualScore > 0 ? (scoreBreakdown.collaborativeScore / totalActualScore) * 100 : 0,
      };
    }

    it('should calculate percentages proportional to actual scores', () => {
      const result = calculateScorePercentages({
        baseScore: 30,
        locationScore: 20,
        timeScore: 15,
        feedbackScore: 15,
        collaborativeScore: 10,
      });

      // Total = 90
      expect(result.totalActualScore).toBe(90);
      // Base: 30/90 = 33.33%
      expect(result.basePercent).toBeCloseTo(33.33, 1);
      // Location: 20/90 = 22.22%
      expect(result.locationPercent).toBeCloseTo(22.22, 1);
      // Collaborative: 10/90 = 11.11%
      expect(result.collaborativePercent).toBeCloseTo(11.11, 1);
    });

    it('should sum all percentages to 100%', () => {
      const result = calculateScorePercentages({
        baseScore: 30,
        locationScore: 20,
        timeScore: 15,
        feedbackScore: 15,
        collaborativeScore: 10,
      });

      const total =
        result.basePercent +
        result.locationPercent +
        result.timePercent +
        result.feedbackPercent +
        result.collaborativePercent;

      expect(total).toBeCloseTo(100, 1);
    });

    it('should handle all zeros gracefully', () => {
      const result = calculateScorePercentages({
        baseScore: 0,
        locationScore: 0,
        timeScore: 0,
        feedbackScore: 0,
        collaborativeScore: 0,
      });

      expect(result.totalActualScore).toBe(0);
      expect(result.basePercent).toBe(0);
      expect(result.locationPercent).toBe(0);
      expect(result.timePercent).toBe(0);
      expect(result.feedbackPercent).toBe(0);
      expect(result.collaborativePercent).toBe(0);
    });

    it('should handle single component having all points', () => {
      const result = calculateScorePercentages({
        baseScore: 40,
        locationScore: 0,
        timeScore: 0,
        feedbackScore: 0,
        collaborativeScore: 0,
      });

      expect(result.basePercent).toBe(100);
      expect(result.locationPercent).toBe(0);
    });
  });

  describe('getPriceDisplay', () => {
    /**
     * Mirrors getPriceDisplay from activity-card-intelligent.tsx line 314
     */
    function getPriceDisplay(priceRange?: number): string {
      if (!priceRange || priceRange === 0) return 'Free';
      return '$'.repeat(Math.max(1, priceRange));
    }

    it('should return "Free" for undefined price range', () => {
      expect(getPriceDisplay(undefined)).toBe('Free');
    });

    it('should return "Free" for price range 0', () => {
      expect(getPriceDisplay(0)).toBe('Free');
    });

    it('should return "$" for price range 1', () => {
      expect(getPriceDisplay(1)).toBe('$');
    });

    it('should return "$$" for price range 2', () => {
      expect(getPriceDisplay(2)).toBe('$$');
    });

    it('should return "$$$" for price range 3', () => {
      expect(getPriceDisplay(3)).toBe('$$$');
    });

    it('should return "$$$$" for price range 4', () => {
      expect(getPriceDisplay(4)).toBe('$$$$');
    });

    it('should handle negative as truthy (returns dollar signs)', () => {
      // -1 is truthy and !== 0, so it goes through: '$'.repeat(Math.max(1, -1)) = '$'
      expect(getPriceDisplay(-1)).toBe('$');
    });
  });

  describe('getDistanceText', () => {
    /**
     * Mirrors getDistanceText from activity-card-intelligent.tsx line 319
     */
    function getDistanceText(distanceStr?: string): string {
      if (!distanceStr) return 'Nearby';
      return distanceStr;
    }

    it('should return "Nearby" for undefined distance', () => {
      expect(getDistanceText(undefined)).toBe('Nearby');
    });

    it('should return "Nearby" for empty string', () => {
      expect(getDistanceText('')).toBe('Nearby');
    });

    it('should pass through formatted distance string', () => {
      expect(getDistanceText('2.7 mi')).toBe('2.7 mi');
    });

    it('should pass through any non-empty distance string', () => {
      expect(getDistanceText('0.5 mi')).toBe('0.5 mi');
      expect(getDistanceText('15.3 mi')).toBe('15.3 mi');
    });
  });

  describe('formatEventDate', () => {
    /**
     * Mirrors formatEventDate from activity-card-intelligent.tsx line 354
     */
    function formatEventDate(isoString: string): string {
      const date = new Date(isoString);
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      const time = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return `${month} ${day} • ${time}`;
    }

    it('should format ISO date string correctly', () => {
      // Use a fixed UTC date to avoid timezone issues
      const result = formatEventDate('2025-06-15T19:00:00Z');
      // Should contain month, day, and time with bullet separator
      expect(result).toContain('•');
      expect(result).toMatch(/\w+ \d+/); // Month Day pattern
    });

    it('should handle midnight correctly', () => {
      const result = formatEventDate('2025-01-01T00:00:00Z');
      expect(result).toContain('•');
    });
  });

  describe('getBorderColor logic', () => {
    /**
     * Mirrors getBorderColor from activity-card-intelligent.tsx line 374
     * finalScore >= 60 -> strongMatchGlow (top match)
     * finalScore < 60 -> regular border
     */
    function isTopMatch(finalScore: number): boolean {
      return finalScore >= 60;
    }

    it('should identify top match for score >= 60', () => {
      expect(isTopMatch(60)).toBe(true);
      expect(isTopMatch(85)).toBe(true);
      expect(isTopMatch(100)).toBe(true);
    });

    it('should not be top match for score < 60', () => {
      expect(isTopMatch(59)).toBe(false);
      expect(isTopMatch(30)).toBe(false);
      expect(isTopMatch(0)).toBe(false);
    });
  });

  describe('AI Explanation Generation', () => {
    /**
     * Mirrors getAIExplanation from activity-card-intelligent.tsx line 326
     */
    function getAIExplanation(
      score: { baseScore: number; locationScore: number; timeScore: number },
      fallback?: string
    ): string {
      const reasons: string[] = [];
      if (score.baseScore >= 30) reasons.push('Matches your interests');
      if (score.locationScore >= 15) reasons.push('Very close by');
      if (score.timeScore >= 12) reasons.push('Perfect timing');

      if (reasons.length === 0) {
        return fallback || 'Recommended for you';
      }

      return reasons.join(' • ');
    }

    it('should show all three reasons for high scores', () => {
      const result = getAIExplanation({ baseScore: 30, locationScore: 15, timeScore: 12 });
      expect(result).toBe('Matches your interests • Very close by • Perfect timing');
    });

    it('should show only matching reasons', () => {
      const result = getAIExplanation({ baseScore: 30, locationScore: 5, timeScore: 5 });
      expect(result).toBe('Matches your interests');
    });

    it('should use fallback when no reasons qualify', () => {
      const result = getAIExplanation(
        { baseScore: 10, locationScore: 5, timeScore: 5 },
        'Great for weekends'
      );
      expect(result).toBe('Great for weekends');
    });

    it('should use default fallback when no reasons and no custom fallback', () => {
      const result = getAIExplanation({ baseScore: 10, locationScore: 5, timeScore: 5 });
      expect(result).toBe('Recommended for you');
    });
  });

  describe('Match Badge Visibility (discoveryMode gating)', () => {
    /**
     * Mirrors badge render condition from activity-card-intelligent.tsx:
     * isStrongMatch && !isEvent && discoveryMode !== 'explore'
     */
    function shouldShowMatchBadge(
      isStrongMatch: boolean,
      isEvent: boolean,
      discoveryMode?: 'for_you' | 'explore'
    ): boolean {
      return isStrongMatch && !isEvent && discoveryMode !== 'explore';
    }

    it('should show badge for strong match in For You mode', () => {
      expect(shouldShowMatchBadge(true, false, 'for_you')).toBe(true);
    });

    it('should show badge for strong match when discoveryMode is undefined', () => {
      expect(shouldShowMatchBadge(true, false, undefined)).toBe(true);
    });

    it('should hide badge in Explore mode even for strong matches', () => {
      expect(shouldShowMatchBadge(true, false, 'explore')).toBe(false);
    });

    it('should hide badge for events regardless of mode', () => {
      expect(shouldShowMatchBadge(true, true, 'for_you')).toBe(false);
      expect(shouldShowMatchBadge(true, true, 'explore')).toBe(false);
    });

    it('should hide badge for weak matches regardless of mode', () => {
      expect(shouldShowMatchBadge(false, false, 'for_you')).toBe(false);
      expect(shouldShowMatchBadge(false, false, 'explore')).toBe(false);
    });
  });

  describe('Time Context Label', () => {
    /**
     * Mirrors getTimeContextLabel from activity-card-intelligent.tsx
     * No longer depends on timeScore — computed fresh from category + current hour.
     * Hidden in Explore mode (personalization signal).
     */
    function getTimeContextLabel(
      category: string,
      currentHour: number,
      discoveryMode?: 'for_you' | 'explore',
      suggestedTime?: Date
    ): { icon: string; label: string } | null {
      if (discoveryMode === 'explore') return null;

      const cat = category.toLowerCase();

      // If suggestedTime is within 2 hours → "Perfect for now" variants
      if (suggestedTime) {
        const hoursUntil = (new Date(suggestedTime).getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntil >= 0 && hoursUntil <= 2) {
          if (cat.includes('coffee') || cat.includes('cafe')) return { icon: '☕', label: 'Perfect for now' };
          if (cat.includes('dining') || cat.includes('restaurant') || cat.includes('food'))
            return { icon: '🍽️', label: 'Great for now' };
          return { icon: '⏰', label: 'Perfect timing' };
        }
      }

      // Time-of-day contextual labels
      if (currentHour >= 5 && currentHour < 12) {
        if (cat.includes('coffee') || cat.includes('cafe')) return { icon: '☕', label: 'Morning spot' };
        if (cat.includes('fitness') || cat.includes('gym') || cat.includes('yoga')) return { icon: '💪', label: 'Morning workout' };
        if (cat.includes('breakfast') || cat.includes('brunch')) return { icon: '🍳', label: 'Brunch spot' };
      } else if (currentHour >= 12 && currentHour < 17) {
        if (cat.includes('dining') || cat.includes('restaurant') || cat.includes('food')) return { icon: '🍽️', label: 'Lunch spot' };
        if (cat.includes('coffee') || cat.includes('cafe')) return { icon: '☕', label: 'Afternoon pick-me-up' };
        if (cat.includes('shopping') || cat.includes('retail')) return { icon: '🛍️', label: 'Afternoon find' };
      } else if (currentHour >= 17 && currentHour < 21) {
        if (cat.includes('dining') || cat.includes('restaurant') || cat.includes('food')) return { icon: '🍽️', label: 'Dinner spot' };
        if (cat.includes('bar') || cat.includes('nightlife') || cat.includes('pub')) return { icon: '🍸', label: 'Tonight' };
        if (cat.includes('entertainment') || cat.includes('music') || cat.includes('concert')) return { icon: '🎵', label: 'Tonight' };
      } else {
        if (cat.includes('bar') || cat.includes('nightlife') || cat.includes('pub')) return { icon: '🌙', label: 'Late night' };
      }

      return null; // No match for this category at this time → no chip
    }

    // Explore mode gating
    it('should return null in Explore mode regardless of category/time', () => {
      expect(getTimeContextLabel('coffee', 8, 'explore')).toBeNull();
      expect(getTimeContextLabel('bar', 23, 'explore')).toBeNull();
      expect(getTimeContextLabel('dining', 19, 'explore')).toBeNull();
    });

    // Morning (5-11)
    it('should return "Morning spot" for coffee in the morning', () => {
      const result = getTimeContextLabel('coffee', 8, 'for_you');
      expect(result).toEqual({ icon: '☕', label: 'Morning spot' });
    });

    it('should return "Morning workout" for fitness in the morning', () => {
      const result = getTimeContextLabel('fitness', 7, 'for_you');
      expect(result).toEqual({ icon: '💪', label: 'Morning workout' });
    });

    it('should return "Brunch spot" for brunch in the morning', () => {
      const result = getTimeContextLabel('breakfast & brunch', 10, 'for_you');
      expect(result).toEqual({ icon: '🍳', label: 'Brunch spot' });
    });

    // Afternoon (12-16)
    it('should return "Lunch spot" for dining at noon', () => {
      const result = getTimeContextLabel('dining', 12, 'for_you');
      expect(result).toEqual({ icon: '🍽️', label: 'Lunch spot' });
    });

    it('should return "Afternoon pick-me-up" for coffee in afternoon', () => {
      const result = getTimeContextLabel('cafe', 14, 'for_you');
      expect(result).toEqual({ icon: '☕', label: 'Afternoon pick-me-up' });
    });

    it('should return "Afternoon find" for shopping in afternoon', () => {
      const result = getTimeContextLabel('shopping', 15, 'for_you');
      expect(result).toEqual({ icon: '🛍️', label: 'Afternoon find' });
    });

    // Evening (17-20)
    it('should return "Dinner spot" for restaurant in evening', () => {
      const result = getTimeContextLabel('restaurant', 19, 'for_you');
      expect(result).toEqual({ icon: '🍽️', label: 'Dinner spot' });
    });

    it('should return "Tonight" for bar in evening', () => {
      const result = getTimeContextLabel('bar', 20, 'for_you');
      expect(result).toEqual({ icon: '🍸', label: 'Tonight' });
    });

    it('should return "Tonight" for entertainment in evening', () => {
      const result = getTimeContextLabel('entertainment', 19, 'for_you');
      expect(result).toEqual({ icon: '🎵', label: 'Tonight' });
    });

    // Late night (21+)
    it('should return "Late night" for nightlife after 9pm', () => {
      const result = getTimeContextLabel('nightlife', 23, 'for_you');
      expect(result).toEqual({ icon: '🌙', label: 'Late night' });
    });

    // No match — unmatched categories return null (no generic fallback)
    it('should return null for unmatched category at any time', () => {
      expect(getTimeContextLabel('parks', 14, 'for_you')).toBeNull();
      expect(getTimeContextLabel('parks', 8, 'for_you')).toBeNull();
    });

    it('should return null for unmatched category in early morning hours', () => {
      const result = getTimeContextLabel('shopping', 3, 'for_you');
      expect(result).toBeNull();
    });

    // Works without discoveryMode (defaults to showing chips)
    it('should show chips when discoveryMode is undefined', () => {
      const result = getTimeContextLabel('coffee', 8, undefined);
      expect(result).toEqual({ icon: '☕', label: 'Morning spot' });
    });
  });

  describe('Strong Match Badge Threshold', () => {
    /**
     * Mirrors isStrongMatch from activity-card-intelligent.tsx
     * Threshold lowered from 70 → 55 so more For You cards show
     * the AI match badge (most personalized recs score 55-90).
     */
    function isStrongMatch(matchPercentage: number): boolean {
      return matchPercentage >= 55;
    }

    it('should be strong match at exactly 55%', () => {
      expect(isStrongMatch(55)).toBe(true);
    });

    it('should be strong match for high scores', () => {
      expect(isStrongMatch(70)).toBe(true);
      expect(isStrongMatch(85)).toBe(true);
      expect(isStrongMatch(99)).toBe(true);
    });

    it('should NOT be strong match below 55%', () => {
      expect(isStrongMatch(54)).toBe(false);
      expect(isStrongMatch(30)).toBe(false);
      expect(isStrongMatch(0)).toBe(false);
    });
  });

  describe('Match Score Tier Logic', () => {
    /**
     * Mirrors MatchScoreColors tier selection from activity-card-intelligent.tsx
     */
    function getMatchTier(score: number): string {
      if (score >= 85) return 'excellent';
      if (score >= 75) return 'good';
      if (score >= 60) return 'fair';
      if (score >= 35) return 'average';
      return 'low';
    }

    it('should return excellent for scores >= 85', () => {
      expect(getMatchTier(85)).toBe('excellent');
      expect(getMatchTier(100)).toBe('excellent');
    });

    it('should return good for scores 75-84', () => {
      expect(getMatchTier(75)).toBe('good');
      expect(getMatchTier(84)).toBe('good');
    });

    it('should return fair for scores 60-74', () => {
      expect(getMatchTier(60)).toBe('fair');
      expect(getMatchTier(74)).toBe('fair');
    });

    it('should return average for scores 35-59', () => {
      expect(getMatchTier(35)).toBe('average');
      expect(getMatchTier(59)).toBe('average');
    });

    it('should return low for scores < 35', () => {
      expect(getMatchTier(34)).toBe('low');
      expect(getMatchTier(0)).toBe('low');
    });
  });
});
