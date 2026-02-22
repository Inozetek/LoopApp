/**
 * Gamification Service Tests
 *
 * Tests point awarding, streak tracking, tier transitions, and milestone notifications.
 */

// ---- Supabase mock ----
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockUpdate = jest.fn();
const mockInsert = jest.fn();
const mockThen = jest.fn();

function chainMock() {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    then: jest.fn(),
  };
  return chain;
}

let usersChain: any;
let notificationsChain: any;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'users') return usersChain;
      if (table === 'notifications') return notificationsChain;
      return chainMock();
    }),
  },
}));

import {
  awardPoints,
  recordActivity,
  checkAndUpdateStreak,
  POINT_VALUES,
  type AwardResult,
} from '@/services/gamification-service';
import { getCurrentTier, LOOP_TIERS } from '@/utils/personality-generator';

// ---- Helper: reset chains before each test ----
function resetChains() {
  usersChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { loop_score: 0 }, error: null }),
    update: jest.fn().mockReturnThis(),
  };
  // Make update().eq() resolve
  usersChain.update.mockImplementation(() => {
    const inner: any = {
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
    return inner;
  });

  notificationsChain = {
    insert: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((cb: any) => {
      cb({ error: null });
      return Promise.resolve();
    }),
  };
}

describe('Gamification Service', () => {
  beforeEach(() => {
    resetChains();
    jest.clearAllMocks();
  });

  // ============================================================
  // POINT VALUES
  // ============================================================
  describe('POINT_VALUES', () => {
    it('has correct values per spec', () => {
      expect(POINT_VALUES.TASK_COMPLETED).toBe(10);
      expect(POINT_VALUES.RECOMMENDATION_ACCEPTED).toBe(5);
      expect(POINT_VALUES.FEEDBACK_GIVEN).toBe(3);
      expect(POINT_VALUES.GROUP_ACTIVITY_ATTENDED).toBe(15);
      expect(POINT_VALUES.STREAK_BONUS).toBe(20);
    });
  });

  // ============================================================
  // awardPoints
  // ============================================================
  describe('awardPoints', () => {
    it('skips demo user', async () => {
      const result = await awardPoints('demo-user-123', 10, 'test');
      expect(result).toEqual({ newScore: 0, milestoneReached: false, newTier: null });
    });

    it('awards positive points', async () => {
      usersChain.single.mockResolvedValue({ data: { loop_score: 40 }, error: null });
      const updateEq = jest.fn().mockResolvedValue({ error: null });
      usersChain.update.mockReturnValue({ eq: updateEq });

      const result = await awardPoints('user-1', 10, 'TASK_COMPLETED');

      expect(result.newScore).toBe(50);
      expect(updateEq).toHaveBeenCalledWith('id', 'user-1');
    });

    it('clamps score to 0 (never negative)', async () => {
      usersChain.single.mockResolvedValue({ data: { loop_score: 3 }, error: null });
      const updateEq = jest.fn().mockResolvedValue({ error: null });
      usersChain.update.mockReturnValue({ eq: updateEq });

      const result = await awardPoints('user-1', -10, 'penalty');
      expect(result.newScore).toBe(0);
    });

    it('detects tier change and inserts milestone notification', async () => {
      // Score 45 → 55 crosses Newcomer (0-50) to Explorer (50-150)
      usersChain.single.mockResolvedValue({ data: { loop_score: 45 }, error: null });
      const updateEq = jest.fn().mockResolvedValue({ error: null });
      usersChain.update.mockReturnValue({ eq: updateEq });

      const result = await awardPoints('user-1', 10, 'TASK_COMPLETED');

      expect(result.newScore).toBe(55);
      expect(result.milestoneReached).toBe(true);
      expect(result.newTier?.label).toBe('Explorer');
      expect(notificationsChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          notification_type: 'loop_score_milestone',
          title: 'You reached Explorer!',
        })
      );
    });

    it('does not flag milestone when tier stays the same', async () => {
      // 10 → 15, both Newcomer
      usersChain.single.mockResolvedValue({ data: { loop_score: 10 }, error: null });
      const updateEq = jest.fn().mockResolvedValue({ error: null });
      usersChain.update.mockReturnValue({ eq: updateEq });

      const result = await awardPoints('user-1', 5, 'RECOMMENDATION_ACCEPTED');

      expect(result.milestoneReached).toBe(false);
      expect(result.newTier).toBeNull();
      expect(notificationsChain.insert).not.toHaveBeenCalled();
    });

    it('handles fetch error gracefully', async () => {
      usersChain.single.mockResolvedValue({ data: null, error: { message: 'not found' } });

      const result = await awardPoints('user-1', 10, 'test');
      expect(result.newScore).toBe(0);
      expect(result.milestoneReached).toBe(false);
    });

    it('handles update error gracefully (returns old score)', async () => {
      usersChain.single.mockResolvedValue({ data: { loop_score: 100 }, error: null });
      const updateEq = jest.fn().mockResolvedValue({ error: { message: 'update failed' } });
      usersChain.update.mockReturnValue({ eq: updateEq });

      const result = await awardPoints('user-1', 10, 'test');
      expect(result.newScore).toBe(100); // Returns old score on failure
    });

    it('handles null loop_score', async () => {
      usersChain.single.mockResolvedValue({ data: { loop_score: null }, error: null });
      const updateEq = jest.fn().mockResolvedValue({ error: null });
      usersChain.update.mockReturnValue({ eq: updateEq });

      const result = await awardPoints('user-1', 5, 'test');
      expect(result.newScore).toBe(5);
    });
  });

  // ============================================================
  // recordActivity
  // ============================================================
  describe('recordActivity', () => {
    it('delegates to awardPoints with correct delta', async () => {
      usersChain.single.mockResolvedValue({ data: { loop_score: 0 }, error: null });
      const updateEq = jest.fn().mockResolvedValue({ error: null });
      usersChain.update.mockReturnValue({ eq: updateEq });

      const result = await recordActivity('user-1', 'FEEDBACK_GIVEN');
      expect(result.newScore).toBe(3);
    });
  });

  // ============================================================
  // checkAndUpdateStreak
  // ============================================================
  describe('checkAndUpdateStreak', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-21T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('skips demo user', async () => {
      await checkAndUpdateStreak('demo-user-123');
      expect(usersChain.select).not.toHaveBeenCalled();
    });

    it('no-op if last_active_date is today (idempotent)', async () => {
      usersChain.single.mockResolvedValue({
        data: { last_active_date: '2026-02-21', streak_days: 5 },
        error: null,
      });

      await checkAndUpdateStreak('user-1');

      // Should NOT call update since it's same day
      expect(usersChain.update).not.toHaveBeenCalled();
    });

    it('increments streak when last_active_date is yesterday', async () => {
      usersChain.single.mockResolvedValue({
        data: { last_active_date: '2026-02-20', streak_days: 6 },
        error: null,
      });
      const updateEq = jest.fn().mockResolvedValue({ error: null });
      usersChain.update.mockReturnValue({ eq: updateEq });

      await checkAndUpdateStreak('user-1');

      expect(usersChain.update).toHaveBeenCalledWith({
        streak_days: 7,
        last_active_date: '2026-02-21',
      });
    });

    it('resets streak when gap is 2+ days', async () => {
      usersChain.single.mockResolvedValue({
        data: { last_active_date: '2026-02-18', streak_days: 10 },
        error: null,
      });
      const updateEq = jest.fn().mockResolvedValue({ error: null });
      usersChain.update.mockReturnValue({ eq: updateEq });

      await checkAndUpdateStreak('user-1');

      expect(usersChain.update).toHaveBeenCalledWith({
        streak_days: 1,
        last_active_date: '2026-02-21',
      });
    });

    it('sets streak to 1 for first ever active day (null last_active_date)', async () => {
      usersChain.single.mockResolvedValue({
        data: { last_active_date: null, streak_days: 0 },
        error: null,
      });
      const updateEq = jest.fn().mockResolvedValue({ error: null });
      usersChain.update.mockReturnValue({ eq: updateEq });

      await checkAndUpdateStreak('user-1');

      expect(usersChain.update).toHaveBeenCalledWith({
        streak_days: 1,
        last_active_date: '2026-02-21',
      });
    });

    it('awards STREAK_BONUS at 7-day multiples', async () => {
      // Streak was 6, yesterday → increments to 7, divisible by 7
      usersChain.single
        .mockResolvedValueOnce({
          data: { last_active_date: '2026-02-20', streak_days: 6 },
          error: null,
        })
        // Second call from awardPoints fetching score
        .mockResolvedValueOnce({
          data: { loop_score: 100 },
          error: null,
        });

      const updateEq = jest.fn().mockResolvedValue({ error: null });
      usersChain.update.mockReturnValue({ eq: updateEq });

      await checkAndUpdateStreak('user-1');

      // First update: streak
      expect(usersChain.update).toHaveBeenCalledWith({
        streak_days: 7,
        last_active_date: '2026-02-21',
      });

      // Second update: score from awardPoints (STREAK_BONUS = 20, so 100+20 = 120)
      expect(usersChain.update).toHaveBeenCalledWith({ loop_score: 120 });
    });

    it('does NOT award bonus for non-7 streaks', async () => {
      usersChain.single.mockResolvedValue({
        data: { last_active_date: '2026-02-20', streak_days: 4 },
        error: null,
      });
      const updateEq = jest.fn().mockResolvedValue({ error: null });
      usersChain.update.mockReturnValue({ eq: updateEq });

      await checkAndUpdateStreak('user-1');

      // Only the streak update, no score update
      expect(usersChain.update).toHaveBeenCalledTimes(1);
      expect(usersChain.update).toHaveBeenCalledWith({
        streak_days: 5,
        last_active_date: '2026-02-21',
      });
    });
  });

  // ============================================================
  // Tier helpers (imported from personality-generator, but tested for integration)
  // ============================================================
  describe('Tier integration', () => {
    it('tier boundaries match spec', () => {
      expect(getCurrentTier(0).label).toBe('Newcomer');
      expect(getCurrentTier(49).label).toBe('Newcomer');
      expect(getCurrentTier(50).label).toBe('Explorer');
      expect(getCurrentTier(149).label).toBe('Explorer');
      expect(getCurrentTier(150).label).toBe('Adventurer');
      expect(getCurrentTier(399).label).toBe('Adventurer');
      expect(getCurrentTier(400).label).toBe('Trailblazer');
      expect(getCurrentTier(799).label).toBe('Trailblazer');
      expect(getCurrentTier(800).label).toBe('Legend');
      expect(getCurrentTier(99999).label).toBe('Legend');
    });
  });
});
