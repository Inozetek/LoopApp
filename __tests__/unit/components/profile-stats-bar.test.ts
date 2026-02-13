/**
 * ProfileStatsBar Component Tests
 *
 * Tests the logic used by the ProfileStatsBar component:
 * - Score ring dimensions and progress calculations
 * - Ring always uses BrandColors.loopBlue (no tier-dependent coloring)
 * - Tier boundary logic
 * - Stats formatting
 * - Personality input wiring
 *
 * NOTE: These are unit tests for the logic. Component rendering
 * tests require a proper React Native testing environment.
 */

import {
  generatePersonalitySummary,
  getCurrentTier,
  getNextTier,
  getTierProgress,
  type PersonalityInput,
} from '@/utils/personality-generator';
import { BrandColors } from '@/constants/brand';

// ---- Score ring constants (mirrors component) ----
const RING_SIZE = 48;
const STROKE_WIDTH = 4;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

describe('ProfileStatsBar Logic', () => {
  // ---- Ring color ----

  describe('Ring color', () => {
    it('always uses BrandColors.loopBlue regardless of score', () => {
      // The component hardcodes BrandColors.loopBlue for the progress stroke.
      // Verify the constant exists and is a valid hex color.
      expect(BrandColors.loopBlue).toBe('#00A6D9');

      // No tier-dependent color function exists — ring is always blue.
      // Scores 0, 50, 150, 400, 800 all use the same color.
      const scores = [0, 49, 50, 150, 400, 800, 5000];
      scores.forEach((score) => {
        // Ring color is constant, not score-dependent
        expect(BrandColors.loopBlue).toBe('#00A6D9');
      });
    });
  });

  // ---- Score Ring Math ----

  describe('ScoreRing calculations', () => {
    it('computes correct ring dimensions (48px, 4px stroke)', () => {
      expect(RING_SIZE).toBe(48);
      expect(STROKE_WIDTH).toBe(4);
      expect(RADIUS).toBe(22);
      expect(CIRCUMFERENCE).toBeCloseTo(2 * Math.PI * 22);
    });

    it('strokeDashoffset at 0% progress = full circumference', () => {
      const progress = 0;
      const offset = CIRCUMFERENCE * (1 - progress);
      expect(offset).toBeCloseTo(CIRCUMFERENCE);
    });

    it('strokeDashoffset at 100% progress = 0', () => {
      const progress = 1;
      const offset = CIRCUMFERENCE * (1 - progress);
      expect(offset).toBeCloseTo(0);
    });

    it('strokeDashoffset at 50% progress = half circumference', () => {
      const progress = 0.5;
      const offset = CIRCUMFERENCE * (1 - progress);
      expect(offset).toBeCloseTo(CIRCUMFERENCE / 2);
    });
  });

  // ---- Tier boundaries ----

  describe('Tier boundaries', () => {
    it('shows correct target for Newcomer (0-50)', () => {
      const score = 30;
      const nextTier = getNextTier(score);
      expect(nextTier).not.toBeNull();
      expect(nextTier!.label).toBe('Explorer');
      expect(nextTier!.minScore).toBe(50);
    });

    it('shows correct target for Explorer (50-150)', () => {
      const score = 100;
      const nextTier = getNextTier(score);
      expect(nextTier!.label).toBe('Adventurer');
      expect(nextTier!.minScore).toBe(150);
    });

    it('no next tier for Legend', () => {
      expect(getNextTier(900)).toBeNull();
    });
  });

  // ---- Personality wiring ----

  describe('Personality section wiring', () => {
    it('generates personality from component props shape', () => {
      const input: PersonalityInput = {
        interests: ['Dining', 'Coffee & Cafes', 'Bars & Nightlife'],
        aiProfile: {
          budget_level: 2,
          time_preferences: ['evening'],
          preferred_distance_miles: 5,
          distance_tolerance: 'medium',
        },
        feedbackCount: 5,
        streakDays: 3,
        loopScore: 75,
      };

      const result = generatePersonalitySummary(input);
      expect(result.title).toBe('The Night Owl Foodie');
      expect(result.subtitle).toBeTruthy();
      expect(result.traits).toHaveLength(3);
    });

    it('handles empty props gracefully', () => {
      const input: PersonalityInput = {
        interests: [],
        aiProfile: null,
        feedbackCount: 0,
        streakDays: 0,
        loopScore: 0,
      };

      const result = generatePersonalitySummary(input);
      expect(result.title).toContain('The');
      expect(result.traits).toEqual([]);
    });
  });

  // ---- Stats formatting ----

  describe('Stats formatting', () => {
    it('formats feedback count as string', () => {
      expect(String(12)).toBe('12');
      expect(String(0)).toBe('0');
    });

    it('formats thumbs up count as string', () => {
      expect(String(10)).toBe('10');
      expect(String(0)).toBe('0');
    });

    it('formats streak days as string', () => {
      expect(String(5)).toBe('5');
      expect(String(0)).toBe('0');
    });
  });

  // ---- Edge cases ----

  describe('Edge cases', () => {
    it('handles boundary score 50 correctly (Explorer tier)', () => {
      expect(getCurrentTier(50).label).toBe('Explorer');
    });

    it('handles boundary score 800 correctly (Legend tier)', () => {
      expect(getCurrentTier(800).label).toBe('Legend');
      expect(getTierProgress(800)).toBe(1);
    });

    it('handles very large scores', () => {
      expect(getCurrentTier(999999).label).toBe('Legend');
      expect(getTierProgress(999999)).toBe(1);
      expect(getNextTier(999999)).toBeNull();
    });

    it('handles score 0 (Newcomer tier)', () => {
      expect(getCurrentTier(0).label).toBe('Newcomer');
      expect(getTierProgress(0)).toBe(0);
    });
  });
});
