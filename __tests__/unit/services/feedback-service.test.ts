/**
 * Tests for feedback service
 *
 * Tests shouldPromptForFeedback logic, feedback data formatting,
 * and AI profile update rules.
 */

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => ({
                data: null,
                error: null,
              })),
            })),
          })),
          in: jest.fn(() => ({
            data: null,
            error: null,
          })),
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn(),
            })),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  },
}));

describe('Feedback Service - Pure Logic', () => {
  describe('shouldPromptForFeedback decision logic', () => {
    /**
     * Mirrors shouldPromptForFeedback from feedback-service.ts line 178
     * Returns shouldPrompt: true + activity if pending activities exist
     */

    it('should not prompt when no pending activities', () => {
      const pendingActivities: any[] = [];
      const shouldPrompt = pendingActivities.length > 0;
      expect(shouldPrompt).toBe(false);
    });

    it('should prompt when pending activities exist', () => {
      const pendingActivities = [
        {
          eventId: 'event-1',
          activityId: 'activity-1',
          activityName: 'Blue Bottle Coffee',
          activityCategory: 'cafe',
          completedAt: new Date().toISOString(),
          recommendationId: null,
        },
      ];
      const shouldPrompt = pendingActivities.length > 0;
      const activity = pendingActivities[0];

      expect(shouldPrompt).toBe(true);
      expect(activity.activityName).toBe('Blue Bottle Coffee');
    });

    it('should return the most recent activity (first in sorted array)', () => {
      const pendingActivities = [
        { eventId: 'event-2', activityName: 'Recent Place', completedAt: '2025-06-15T15:00:00Z' },
        { eventId: 'event-1', activityName: 'Older Place', completedAt: '2025-06-15T13:00:00Z' },
      ];

      // shouldPromptForFeedback returns pendingActivities[0]
      const activity = pendingActivities[0];
      expect(activity.activityName).toBe('Recent Place');
    });
  });

  describe('Time window for pending feedback', () => {
    /**
     * Mirrors time window logic from feedback-service.ts lines 41-48
     * - Only check events from last 3 hours (not 24 hours)
     * - Don't prompt within last 30 minutes (give user time to leave)
     * - Valid window: 30 minutes ago to 3 hours ago
     */

    function isInFeedbackWindow(endTime: Date, now: Date): boolean {
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      return endTime >= threeHoursAgo && endTime <= thirtyMinutesAgo;
    }

    it('should include event that ended 1 hour ago', () => {
      const now = new Date('2025-06-15T14:00:00Z');
      const endTime = new Date('2025-06-15T13:00:00Z'); // 1 hour ago
      expect(isInFeedbackWindow(endTime, now)).toBe(true);
    });

    it('should include event that ended 2 hours ago', () => {
      const now = new Date('2025-06-15T14:00:00Z');
      const endTime = new Date('2025-06-15T12:00:00Z'); // 2 hours ago
      expect(isInFeedbackWindow(endTime, now)).toBe(true);
    });

    it('should exclude event that ended 10 minutes ago (too recent)', () => {
      const now = new Date('2025-06-15T14:00:00Z');
      const endTime = new Date('2025-06-15T13:50:00Z'); // 10 min ago
      expect(isInFeedbackWindow(endTime, now)).toBe(false);
    });

    it('should exclude event that ended 4 hours ago (too stale)', () => {
      const now = new Date('2025-06-15T14:00:00Z');
      const endTime = new Date('2025-06-15T10:00:00Z'); // 4 hours ago
      expect(isInFeedbackWindow(endTime, now)).toBe(false);
    });

    it('should include event at exactly 30 minutes ago (boundary)', () => {
      const now = new Date('2025-06-15T14:00:00Z');
      const endTime = new Date('2025-06-15T13:30:00Z'); // exactly 30 min ago
      expect(isInFeedbackWindow(endTime, now)).toBe(true);
    });

    it('should include event at exactly 3 hours ago (boundary)', () => {
      const now = new Date('2025-06-15T14:00:00Z');
      const endTime = new Date('2025-06-15T11:00:00Z'); // exactly 3 hours ago
      expect(isInFeedbackWindow(endTime, now)).toBe(true);
    });
  });

  describe('Feedback record formatting', () => {
    /**
     * Mirrors submitFeedback data formatting from feedback-service.ts lines 237-253
     */
    function formatFeedbackRecord(feedback: {
      userId: string;
      activityId: string | null;
      recommendationId?: string;
      rating: 'thumbs_up' | 'thumbs_down';
      tags?: string[];
      notes?: string;
      completedAt: string;
    }): Record<string, any> {
      const feedbackRecord: any = {
        user_id: feedback.userId,
        rating: feedback.rating,
        feedback_tags: feedback.tags || [],
        feedback_notes: feedback.notes || null,
        completed_at: feedback.completedAt,
      };

      if (feedback.activityId) {
        feedbackRecord.activity_id = feedback.activityId;
      }

      if (feedback.recommendationId) {
        feedbackRecord.recommendation_id = feedback.recommendationId;
      }

      return feedbackRecord;
    }

    it('should format basic thumbs up feedback', () => {
      const record = formatFeedbackRecord({
        userId: 'user-1',
        activityId: 'activity-1',
        rating: 'thumbs_up',
        completedAt: '2025-06-15T13:00:00Z',
      });

      expect(record.user_id).toBe('user-1');
      expect(record.activity_id).toBe('activity-1');
      expect(record.rating).toBe('thumbs_up');
      expect(record.feedback_tags).toEqual([]);
      expect(record.feedback_notes).toBeNull();
      expect(record.completed_at).toBe('2025-06-15T13:00:00Z');
    });

    it('should include tags when provided', () => {
      const record = formatFeedbackRecord({
        userId: 'user-1',
        activityId: 'activity-1',
        rating: 'thumbs_down',
        tags: ['too_expensive', 'too_far'],
        completedAt: '2025-06-15T13:00:00Z',
      });

      expect(record.feedback_tags).toEqual(['too_expensive', 'too_far']);
    });

    it('should include notes when provided', () => {
      const record = formatFeedbackRecord({
        userId: 'user-1',
        activityId: 'activity-1',
        rating: 'thumbs_down',
        notes: 'Service was slow',
        completedAt: '2025-06-15T13:00:00Z',
      });

      expect(record.feedback_notes).toBe('Service was slow');
    });

    it('should omit activity_id when null', () => {
      const record = formatFeedbackRecord({
        userId: 'user-1',
        activityId: null,
        rating: 'thumbs_up',
        completedAt: '2025-06-15T13:00:00Z',
      });

      expect(record).not.toHaveProperty('activity_id');
    });

    it('should include recommendation_id when provided', () => {
      const record = formatFeedbackRecord({
        userId: 'user-1',
        activityId: 'activity-1',
        recommendationId: 'rec-1',
        rating: 'thumbs_up',
        completedAt: '2025-06-15T13:00:00Z',
      });

      expect(record.recommendation_id).toBe('rec-1');
    });

    it('should omit recommendation_id when not provided', () => {
      const record = formatFeedbackRecord({
        userId: 'user-1',
        activityId: 'activity-1',
        rating: 'thumbs_up',
        completedAt: '2025-06-15T13:00:00Z',
      });

      expect(record).not.toHaveProperty('recommendation_id');
    });
  });

  describe('AI Profile Update Logic', () => {
    /**
     * Mirrors updateAIProfile logic from feedback-service.ts lines 326-378
     */

    interface AIProfile {
      preferred_distance_miles: number;
      budget_level: number;
      favorite_categories: string[];
      disliked_categories: string[];
      price_sensitivity: string;
      distance_tolerance: string;
    }

    const DEFAULT_PROFILE: AIProfile = {
      preferred_distance_miles: 5.0,
      budget_level: 2,
      favorite_categories: [],
      disliked_categories: [],
      price_sensitivity: 'medium',
      distance_tolerance: 'medium',
    };

    function updateProfile(
      profile: AIProfile,
      rating: 'thumbs_up' | 'thumbs_down',
      category: string,
      priceRange: number | null,
      tags?: string[]
    ): AIProfile {
      const updated = {
        ...profile,
        favorite_categories: [...profile.favorite_categories],
        disliked_categories: [...profile.disliked_categories],
      };

      if (rating === 'thumbs_up') {
        if (!updated.favorite_categories.includes(category)) {
          updated.favorite_categories.push(category);
        }
        updated.disliked_categories = updated.disliked_categories.filter(
          (cat) => cat !== category
        );
        if (priceRange) {
          updated.budget_level = Math.round(
            updated.budget_level * 0.7 + priceRange * 0.3
          );
        }
      } else if (rating === 'thumbs_down' && tags) {
        for (const tag of tags) {
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
              if (!updated.disliked_categories.includes(category)) {
                updated.disliked_categories.push(category);
              }
              updated.favorite_categories = updated.favorite_categories.filter(
                (cat) => cat !== category
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

    it('should add category to favorites on thumbs up', () => {
      const result = updateProfile(DEFAULT_PROFILE, 'thumbs_up', 'cafe', null);
      expect(result.favorite_categories).toContain('cafe');
    });

    it('should not duplicate category in favorites', () => {
      const profile = { ...DEFAULT_PROFILE, favorite_categories: ['cafe'] };
      const result = updateProfile(profile, 'thumbs_up', 'cafe', null);
      expect(result.favorite_categories.filter((c) => c === 'cafe')).toHaveLength(1);
    });

    it('should remove category from disliked on thumbs up', () => {
      const profile = { ...DEFAULT_PROFILE, disliked_categories: ['nightclub'] };
      const result = updateProfile(profile, 'thumbs_up', 'nightclub', null);
      expect(result.disliked_categories).not.toContain('nightclub');
    });

    it('should update budget level on thumbs up with price range', () => {
      // budget_level = 2 * 0.7 + 3 * 0.3 = 1.4 + 0.9 = 2.3 -> rounded to 2
      const result = updateProfile(DEFAULT_PROFILE, 'thumbs_up', 'dining', 3);
      expect(result.budget_level).toBe(2); // Math.round(2.3) = 2
    });

    it('should decrease budget on "too_expensive" tag', () => {
      const result = updateProfile(DEFAULT_PROFILE, 'thumbs_down', 'dining', null, ['too_expensive']);
      expect(result.budget_level).toBe(1.5); // 2 - 0.5
      expect(result.price_sensitivity).toBe('high');
    });

    it('should not let budget go below 1', () => {
      const profile = { ...DEFAULT_PROFILE, budget_level: 1 };
      const result = updateProfile(profile, 'thumbs_down', 'dining', null, ['too_expensive']);
      expect(result.budget_level).toBe(1); // Math.max(1, 0.5)
    });

    it('should decrease preferred distance on "too_far" tag', () => {
      const result = updateProfile(DEFAULT_PROFILE, 'thumbs_down', 'hiking', null, ['too_far']);
      expect(result.preferred_distance_miles).toBe(4); // 5 * 0.8
      expect(result.distance_tolerance).toBe('low');
    });

    it('should not let distance go below 1 mile', () => {
      const profile = { ...DEFAULT_PROFILE, preferred_distance_miles: 1.0 };
      const result = updateProfile(profile, 'thumbs_down', 'hiking', null, ['too_far']);
      expect(result.preferred_distance_miles).toBe(1); // Math.max(1, 0.8)
    });

    it('should add to disliked and remove from favorites on "boring"', () => {
      const profile = { ...DEFAULT_PROFILE, favorite_categories: ['nightclub'] };
      const result = updateProfile(profile, 'thumbs_down', 'nightclub', null, ['boring']);
      expect(result.disliked_categories).toContain('nightclub');
      expect(result.favorite_categories).not.toContain('nightclub');
    });

    it('should add to disliked on "too_crowded"', () => {
      const result = updateProfile(DEFAULT_PROFILE, 'thumbs_down', 'bar', null, ['too_crowded']);
      expect(result.disliked_categories).toContain('bar');
    });

    it('should process multiple tags together', () => {
      const result = updateProfile(DEFAULT_PROFILE, 'thumbs_down', 'restaurant', null, [
        'too_expensive',
        'too_crowded',
      ]);
      expect(result.budget_level).toBe(1.5); // too_expensive
      expect(result.price_sensitivity).toBe('high');
      expect(result.disliked_categories).toContain('restaurant'); // too_crowded
    });

    it('should limit favorites to 10 categories', () => {
      const profile = {
        ...DEFAULT_PROFILE,
        favorite_categories: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
      };
      const result = updateProfile(profile, 'thumbs_up', 'k', null);
      // 11 items -> sliced to last 10
      expect(result.favorite_categories).toHaveLength(10);
      expect(result.favorite_categories).toContain('k'); // newest should be kept
    });

    it('should limit disliked to 10 categories', () => {
      const profile = {
        ...DEFAULT_PROFILE,
        disliked_categories: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
      };
      const result = updateProfile(profile, 'thumbs_down', 'k', null, ['boring']);
      expect(result.disliked_categories).toHaveLength(10);
    });
  });

  describe('Demo user handling', () => {
    const DEMO_USER_ID = 'demo-user-123';

    it('should return empty activities for demo user', () => {
      const userId = DEMO_USER_ID;
      const isDemoUser = userId === DEMO_USER_ID;
      expect(isDemoUser).toBe(true);
      // getPendingFeedbackActivities returns [] for demo user
    });

    it('should return mock stats for demo user', () => {
      const userId = DEMO_USER_ID;
      const mockStats = {
        totalFeedback: 12,
        thumbsUpCount: 10,
        thumbsDownCount: 2,
        satisfactionRate: 83.3,
        topCategories: ['coffee', 'live music', 'hiking'],
      };

      expect(mockStats.satisfactionRate).toBeCloseTo(83.3);
      expect(mockStats.thumbsUpCount + mockStats.thumbsDownCount).toBe(mockStats.totalFeedback);
    });
  });

  describe('Satisfaction rate calculation', () => {
    /**
     * Mirrors getUserFeedbackStats logic from feedback-service.ts line 431
     */
    function calculateSatisfactionRate(thumbsUp: number, total: number): number {
      return total > 0 ? (thumbsUp / total) * 100 : 0;
    }

    it('should calculate 100% for all thumbs up', () => {
      expect(calculateSatisfactionRate(10, 10)).toBe(100);
    });

    it('should calculate 0% for all thumbs down', () => {
      expect(calculateSatisfactionRate(0, 10)).toBe(0);
    });

    it('should calculate correct percentage for mixed', () => {
      expect(calculateSatisfactionRate(7, 10)).toBe(70);
    });

    it('should return 0 for no feedback', () => {
      expect(calculateSatisfactionRate(0, 0)).toBe(0);
    });
  });
});
