/**
 * Tests for personality-generator utility
 */

import {
  generatePersonalitySummary,
  getModifier,
  getArchetype,
  getCurrentTier,
  getNextTier,
  getTierProgress,
  LOOP_TIERS,
  type PersonalityInput,
} from '@/utils/personality-generator';

// Helper to create a default input
function createInput(overrides: Partial<PersonalityInput> = {}): PersonalityInput {
  return {
    interests: ['Dining', 'Coffee & Cafes', 'Live Music'],
    aiProfile: {
      budget_level: 2,
      preferred_distance_miles: 5,
      time_preferences: [],
      favorite_categories: [],
      distance_tolerance: 'medium',
    },
    feedbackCount: 0,
    streakDays: 0,
    loopScore: 0,
    ...overrides,
  };
}

describe('personality-generator', () => {
  // ---- getModifier ----

  describe('getModifier', () => {
    it('returns "Night Owl" when evening is in time_preferences', () => {
      const input = createInput({
        aiProfile: { time_preferences: ['evening'], budget_level: 2 },
      });
      expect(getModifier(input)).toBe('Night Owl');
    });

    it('returns "Night Owl" when night is in time_preferences', () => {
      const input = createInput({
        aiProfile: { time_preferences: ['night'], budget_level: 2 },
      });
      expect(getModifier(input)).toBe('Night Owl');
    });

    it('returns "Early Bird" when morning is in time_preferences', () => {
      const input = createInput({
        aiProfile: { time_preferences: ['morning'], budget_level: 2 },
      });
      expect(getModifier(input)).toBe('Early Bird');
    });

    it('returns "Dedicated" for streak >= 7', () => {
      const input = createInput({ streakDays: 7 });
      expect(getModifier(input)).toBe('Dedicated');
    });

    it('returns "Budget-Savvy" for budget_level <= 1', () => {
      const input = createInput({
        aiProfile: { budget_level: 1, time_preferences: [] },
      });
      expect(getModifier(input)).toBe('Budget-Savvy');
    });

    it('returns "Premium" for budget_level >= 3', () => {
      const input = createInput({
        aiProfile: { budget_level: 3, time_preferences: [] },
      });
      expect(getModifier(input)).toBe('Premium');
    });

    it('returns "Local" for distance_tolerance low', () => {
      const input = createInput({
        aiProfile: { budget_level: 2, time_preferences: [], distance_tolerance: 'low' },
      });
      expect(getModifier(input)).toBe('Local');
    });

    it('returns "Seasoned" for feedbackCount >= 20', () => {
      const input = createInput({ feedbackCount: 20 });
      expect(getModifier(input)).toBe('Seasoned');
    });

    it('returns "Legendary" for loopScore >= 400', () => {
      const input = createInput({ loopScore: 400 });
      expect(getModifier(input)).toBe('Legendary');
    });

    it('returns "Weekend" as default', () => {
      const input = createInput();
      expect(getModifier(input)).toBe('Weekend');
    });

    it('first match wins: evening beats streak >= 7', () => {
      const input = createInput({
        aiProfile: { time_preferences: ['evening'], budget_level: 2 },
        streakDays: 10,
      });
      expect(getModifier(input)).toBe('Night Owl');
    });

    it('handles null aiProfile gracefully', () => {
      const input = createInput({ aiProfile: null });
      expect(getModifier(input)).toBe('Weekend');
    });
  });

  // ---- getArchetype ----

  describe('getArchetype', () => {
    it('returns "Foodie" for food-dominant interests', () => {
      expect(getArchetype(['Dining', 'Coffee & Cafes', 'Desserts & Treats'])).toBe('Foodie');
    });

    it('returns "Culture Buff" for entertainment-dominant interests', () => {
      expect(getArchetype(['Live Music', 'Movies & Cinema', 'Comedy & Theater'])).toBe('Culture Buff');
    });

    it('returns "Fitness Fanatic" for fitness-dominant', () => {
      expect(getArchetype(['Fitness & Gym', 'Outdoor Sports', 'Yoga & Mindfulness'])).toBe('Fitness Fanatic');
    });

    it('returns "Adventure Seeker" for outdoor-dominant', () => {
      expect(getArchetype(['Parks & Nature', 'Hiking & Trails'])).toBe('Adventure Seeker');
    });

    it('returns "Creative Soul" for arts-dominant', () => {
      expect(getArchetype(['Museums & Art', 'Photography'])).toBe('Creative Soul');
    });

    it('returns "Trend Hunter" for shopping-dominant', () => {
      expect(getArchetype(['Shopping', 'Beauty & Spa'])).toBe('Trend Hunter');
    });

    it('returns "Explorer" for empty interests', () => {
      expect(getArchetype([])).toBe('Explorer');
    });

    it('returns "Explorer" for unrecognized interests', () => {
      expect(getArchetype(['UnknownCategory', 'AnotherUnknown'])).toBe('Explorer');
    });

    it('handles lowercase interest keys (e.g. "coffee")', () => {
      expect(getArchetype(['coffee', 'dining', 'desserts'])).toBe('Foodie');
    });

    it('picks dominant group when mixed', () => {
      // 2 food + 1 fitness = Food wins
      expect(getArchetype(['Dining', 'Coffee & Cafes', 'Fitness & Gym'])).toBe('Foodie');
    });
  });

  // ---- generatePersonalitySummary ----

  describe('generatePersonalitySummary', () => {
    it('returns a title in "The {Modifier} {Archetype}" format', () => {
      const result = generatePersonalitySummary(createInput());
      expect(result.title).toMatch(/^The \w+/);
    });

    it('generates correct title for night owl foodie', () => {
      const input = createInput({
        interests: ['Dining', 'Coffee & Cafes', 'Bars & Nightlife'],
        aiProfile: { time_preferences: ['evening'], budget_level: 2 },
      });
      const result = generatePersonalitySummary(input);
      expect(result.title).toBe('The Night Owl Foodie');
    });

    it('returns a non-empty subtitle', () => {
      const result = generatePersonalitySummary(createInput());
      expect(result.subtitle.length).toBeGreaterThan(0);
    });

    it('returns first 3 interests as traits', () => {
      const input = createInput({
        interests: ['Dining', 'Live Music', 'Hiking & Trails', 'Shopping'],
      });
      const result = generatePersonalitySummary(input);
      expect(result.traits).toEqual(['Dining', 'Live Music', 'Hiking & Trails']);
    });

    it('returns fewer traits if interests < 3', () => {
      const input = createInput({ interests: ['Dining'] });
      const result = generatePersonalitySummary(input);
      expect(result.traits).toEqual(['Dining']);
    });

    it('returns empty traits for no interests', () => {
      const input = createInput({ interests: [] });
      const result = generatePersonalitySummary(input);
      expect(result.traits).toEqual([]);
    });

    it('produces unique combos for different inputs', () => {
      const a = generatePersonalitySummary(
        createInput({
          interests: ['Dining', 'Coffee & Cafes'],
          aiProfile: { time_preferences: ['evening'], budget_level: 2 },
        })
      );
      const b = generatePersonalitySummary(
        createInput({
          interests: ['Fitness & Gym', 'Outdoor Sports'],
          aiProfile: { time_preferences: ['morning'], budget_level: 2 },
        })
      );
      expect(a.title).not.toBe(b.title);
      expect(a.subtitle).not.toBe(b.subtitle);
    });
  });

  // ---- Tier helpers ----

  describe('getCurrentTier', () => {
    it('returns Newcomer for score 0', () => {
      expect(getCurrentTier(0).label).toBe('Newcomer');
    });

    it('returns Explorer for score 50', () => {
      expect(getCurrentTier(50).label).toBe('Explorer');
    });

    it('returns Adventurer for score 150', () => {
      expect(getCurrentTier(150).label).toBe('Adventurer');
    });

    it('returns Trailblazer for score 400', () => {
      expect(getCurrentTier(400).label).toBe('Trailblazer');
    });

    it('returns Legend for score 800', () => {
      expect(getCurrentTier(800).label).toBe('Legend');
    });

    it('returns Legend for very high score', () => {
      expect(getCurrentTier(99999).label).toBe('Legend');
    });
  });

  describe('getNextTier', () => {
    it('returns Explorer as next for Newcomer', () => {
      expect(getNextTier(0)?.label).toBe('Explorer');
    });

    it('returns Adventurer as next for Explorer', () => {
      expect(getNextTier(50)?.label).toBe('Adventurer');
    });

    it('returns null for Legend (highest)', () => {
      expect(getNextTier(800)).toBeNull();
    });
  });

  describe('getTierProgress', () => {
    it('returns 0 at tier start', () => {
      expect(getTierProgress(0)).toBe(0);
    });

    it('returns 0.5 at tier midpoint', () => {
      // Newcomer: 0-50, midpoint = 25
      expect(getTierProgress(25)).toBe(0.5);
    });

    it('returns 1 for Legend tier', () => {
      expect(getTierProgress(800)).toBe(1);
    });

    it('returns correct progress within Adventurer (150-400)', () => {
      // 250 into a 250-wide range: (250-150)/250 = 0.4
      expect(getTierProgress(250)).toBeCloseTo(0.4);
    });
  });

  describe('LOOP_TIERS', () => {
    it('has 5 tiers', () => {
      expect(LOOP_TIERS).toHaveLength(5);
    });

    it('last tier has Infinity maxScore', () => {
      expect(LOOP_TIERS[LOOP_TIERS.length - 1].maxScore).toBe(Infinity);
    });

    it('tiers are contiguous (each minScore = previous maxScore)', () => {
      for (let i = 1; i < LOOP_TIERS.length; i++) {
        expect(LOOP_TIERS[i].minScore).toBe(LOOP_TIERS[i - 1].maxScore);
      }
    });
  });
});
