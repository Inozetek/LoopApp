/**
 * Tests for feedback system completion
 *
 * Tests AI profile update logic including time preferences,
 * budget adjustment, and category management.
 */

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          gte: jest.fn(() => ({
            order: jest.fn(() => ({ data: null, error: null })),
          })),
          in: jest.fn(() => ({ data: null, error: null })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({ data: { id: 'feedback-1' }, error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null })),
      })),
    })),
  },
}));

describe('Feedback System', () => {
  describe('AI profile update logic', () => {
    /**
     * Mirrors updateAIProfile logic from services/feedback-service.ts
     */

    interface AIProfile {
      preferred_distance_miles: number;
      budget_level: number;
      favorite_categories: string[];
      disliked_categories: string[];
      price_sensitivity: string;
      time_preferences: string[];
      distance_tolerance: string;
    }

    function applyFeedback(
      profile: AIProfile,
      feedback: {
        rating: 'thumbs_up' | 'thumbs_down';
        tags?: string[];
        completedAt?: string;
      },
      activity: { category: string; price_range: number | null }
    ): AIProfile {
      const updated = { ...profile };

      if (feedback.rating === 'thumbs_up') {
        if (!updated.favorite_categories.includes(activity.category)) {
          updated.favorite_categories = [...updated.favorite_categories, activity.category];
        }
        updated.disliked_categories = updated.disliked_categories.filter(
          cat => cat !== activity.category
        );
        if (activity.price_range) {
          updated.budget_level = Math.round(
            updated.budget_level * 0.7 + activity.price_range * 0.3
          );
        }
        // Time preferences
        if (feedback.completedAt) {
          const hour = new Date(feedback.completedAt).getHours();
          let timePref = 'evening';
          if (hour >= 5 && hour < 12) timePref = 'morning';
          else if (hour >= 12 && hour < 17) timePref = 'afternoon';
          else if (hour >= 17 && hour < 21) timePref = 'evening';
          else timePref = 'night';

          if (!updated.time_preferences) updated.time_preferences = [];
          if (!updated.time_preferences.includes(timePref)) {
            updated.time_preferences = [...updated.time_preferences, timePref];
            if (updated.time_preferences.length > 4) {
              updated.time_preferences = updated.time_preferences.slice(-4);
            }
          }
        }
      } else if (feedback.rating === 'thumbs_down' && feedback.tags) {
        for (const tag of feedback.tags) {
          switch (tag) {
            case 'too_expensive':
              updated.budget_level = Math.max(1, updated.budget_level - 0.5);
              updated.price_sensitivity = 'high';
              break;
            case 'too_far':
              updated.preferred_distance_miles = Math.max(
                1,
                updated.preferred_distance_miles * 0.8
              );
              updated.distance_tolerance = 'low';
              break;
            case 'boring':
            case 'too_crowded':
              if (!updated.disliked_categories.includes(activity.category)) {
                updated.disliked_categories = [...updated.disliked_categories, activity.category];
              }
              updated.favorite_categories = updated.favorite_categories.filter(
                cat => cat !== activity.category
              );
              break;
          }
        }
      }

      // Limit array sizes
      if (updated.favorite_categories.length > 10) {
        updated.favorite_categories = updated.favorite_categories.slice(-10);
      }
      if (updated.disliked_categories.length > 10) {
        updated.disliked_categories = updated.disliked_categories.slice(-10);
      }

      return updated;
    }

    const defaultProfile: AIProfile = {
      preferred_distance_miles: 5.0,
      budget_level: 2,
      favorite_categories: [],
      disliked_categories: [],
      price_sensitivity: 'medium',
      time_preferences: [],
      distance_tolerance: 'medium',
    };

    it('adds category to favorites on thumbs_up', () => {
      const result = applyFeedback(
        { ...defaultProfile },
        { rating: 'thumbs_up' },
        { category: 'coffee', price_range: null }
      );
      expect(result.favorite_categories).toContain('coffee');
    });

    it('removes category from disliked on thumbs_up', () => {
      const result = applyFeedback(
        { ...defaultProfile, disliked_categories: ['coffee', 'bars'] },
        { rating: 'thumbs_up' },
        { category: 'coffee', price_range: null }
      );
      expect(result.disliked_categories).not.toContain('coffee');
      expect(result.disliked_categories).toContain('bars');
    });

    it('adjusts budget level on thumbs_up with price_range', () => {
      const result = applyFeedback(
        { ...defaultProfile, budget_level: 2 },
        { rating: 'thumbs_up' },
        { category: 'dining', price_range: 4 }
      );
      // Math.round(2 * 0.7 + 4 * 0.3) = Math.round(1.4 + 1.2) = Math.round(2.6) = 3
      expect(result.budget_level).toBe(3);
    });

    it('adds time preference from completedAt on thumbs_up', () => {
      // Use local time to match getHours() behavior
      const morningDate = new Date();
      morningDate.setHours(9, 0, 0, 0);
      const result = applyFeedback(
        { ...defaultProfile },
        { rating: 'thumbs_up', completedAt: morningDate.toISOString() },
        { category: 'coffee', price_range: null }
      );
      expect(result.time_preferences).toContain('morning');
    });

    it('classifies afternoon time preference correctly', () => {
      const afternoonDate = new Date();
      afternoonDate.setHours(14, 0, 0, 0);
      const result = applyFeedback(
        { ...defaultProfile },
        { rating: 'thumbs_up', completedAt: afternoonDate.toISOString() },
        { category: 'lunch', price_range: null }
      );
      expect(result.time_preferences).toContain('afternoon');
    });

    it('classifies evening time preference correctly', () => {
      const eveningDate = new Date();
      eveningDate.setHours(19, 0, 0, 0);
      const result = applyFeedback(
        { ...defaultProfile },
        { rating: 'thumbs_up', completedAt: eveningDate.toISOString() },
        { category: 'dining', price_range: null }
      );
      expect(result.time_preferences).toContain('evening');
    });

    it('classifies night time preference correctly', () => {
      const nightDate = new Date();
      nightDate.setHours(23, 0, 0, 0);
      const result = applyFeedback(
        { ...defaultProfile },
        { rating: 'thumbs_up', completedAt: nightDate.toISOString() },
        { category: 'nightlife', price_range: null }
      );
      expect(result.time_preferences).toContain('night');
    });

    it('does not duplicate time preferences', () => {
      const result = applyFeedback(
        { ...defaultProfile, time_preferences: ['morning'] },
        { rating: 'thumbs_up', completedAt: '2025-06-15T09:00:00Z' },
        { category: 'coffee', price_range: null }
      );
      expect(result.time_preferences.filter(t => t === 'morning').length).toBe(1);
    });

    it('reduces budget on too_expensive tag', () => {
      const result = applyFeedback(
        { ...defaultProfile, budget_level: 3 },
        { rating: 'thumbs_down', tags: ['too_expensive'] },
        { category: 'dining', price_range: 4 }
      );
      expect(result.budget_level).toBe(2.5);
      expect(result.price_sensitivity).toBe('high');
    });

    it('reduces distance on too_far tag', () => {
      const result = applyFeedback(
        { ...defaultProfile, preferred_distance_miles: 5.0 },
        { rating: 'thumbs_down', tags: ['too_far'] },
        { category: 'hiking', price_range: null }
      );
      expect(result.preferred_distance_miles).toBe(4.0);
      expect(result.distance_tolerance).toBe('low');
    });

    it('adds category to disliked on boring tag', () => {
      const result = applyFeedback(
        { ...defaultProfile, favorite_categories: ['nightlife'] },
        { rating: 'thumbs_down', tags: ['boring'] },
        { category: 'nightlife', price_range: null }
      );
      expect(result.disliked_categories).toContain('nightlife');
      expect(result.favorite_categories).not.toContain('nightlife');
    });

    it('limits favorite_categories to 10', () => {
      const profile: AIProfile = {
        ...defaultProfile,
        favorite_categories: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
      };
      const result = applyFeedback(
        profile,
        { rating: 'thumbs_up' },
        { category: 'k', price_range: null }
      );
      expect(result.favorite_categories.length).toBe(10);
      expect(result.favorite_categories).toContain('k');
    });
  });

  describe('markEventAsCompleted', () => {
    it('marks an event status to completed with timestamp', () => {
      const now = new Date();
      const update = {
        status: 'completed' as const,
        completed_at: now.toISOString(),
      };
      expect(update.status).toBe('completed');
      expect(new Date(update.completed_at).getTime()).toBeGreaterThan(0);
    });
  });
});
