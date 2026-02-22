/**
 * Gamification Service
 *
 * Awards Loop Score points on user actions and tracks daily streaks.
 * All calls are fire-and-forget — non-blocking, no error propagation.
 *
 * Point values (from CLAUDE.md spec):
 *   Complete task on time:    +10
 *   Accept recommendation:     +5
 *   Give feedback:             +3
 *   Group activity attended:  +15
 *   7-day streak bonus:       +20
 */

import { supabase } from '@/lib/supabase';
import { getCurrentTier, type LoopTier } from '@/utils/personality-generator';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEMO_USER_ID = 'demo-user-123';

export const POINT_VALUES = {
  TASK_COMPLETED: 10,
  RECOMMENDATION_ACCEPTED: 5,
  FEEDBACK_GIVEN: 3,
  GROUP_ACTIVITY_ATTENDED: 15,
  STREAK_BONUS: 20,
} as const;

export type PointReason = keyof typeof POINT_VALUES;

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

export interface AwardResult {
  newScore: number;
  milestoneReached: boolean;
  newTier: LoopTier | null;
}

/**
 * Award (or deduct) Loop Score points.
 *
 * 1. Skip for demo user
 * 2. Fetch current loop_score
 * 3. Clamp to >= 0
 * 4. Detect tier change → insert milestone notification
 * 5. Single update
 */
export async function awardPoints(
  userId: string,
  delta: number,
  reason: string
): Promise<AwardResult> {
  if (userId === DEMO_USER_ID) {
    return { newScore: 0, milestoneReached: false, newTier: null };
  }

  try {
    // Fetch current score
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('loop_score')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      console.error('Gamification: failed to fetch user score', fetchError);
      return { newScore: 0, milestoneReached: false, newTier: null };
    }

    const oldScore: number = user.loop_score ?? 0;
    const newScore = Math.max(0, oldScore + delta);

    // Detect tier transition
    const oldTier = getCurrentTier(oldScore);
    const newTierObj = getCurrentTier(newScore);
    const tierChanged = delta > 0 && oldTier.label !== newTierObj.label;

    // Persist new score
    const { error: updateError } = await supabase
      .from('users')
      .update({ loop_score: newScore })
      .eq('id', userId);

    if (updateError) {
      console.error('Gamification: failed to update score', updateError);
      return { newScore: oldScore, milestoneReached: false, newTier: null };
    }

    // Insert milestone notification if tier changed
    if (tierChanged) {
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: `You reached ${newTierObj.label}!`,
          body: `Your Loop Score hit ${newScore}. Welcome to the ${newTierObj.label} tier!`,
          notification_type: 'loop_score_milestone',
          sent_at: new Date().toISOString(),
        })
        .then(({ error: notifErr }: { error: any }) => {
          if (notifErr) console.error('Gamification: milestone notification failed', notifErr);
        });
    }

    console.log(
      `🏆 Gamification: ${reason} → ${delta > 0 ? '+' : ''}${delta} pts (${oldScore} → ${newScore})${tierChanged ? ` [NEW TIER: ${newTierObj.label}]` : ''}`
    );

    return {
      newScore,
      milestoneReached: tierChanged,
      newTier: tierChanged ? newTierObj : null,
    };
  } catch (error) {
    console.error('Gamification: awardPoints error', error);
    return { newScore: 0, milestoneReached: false, newTier: null };
  }
}

/**
 * Thin wrapper: award points for a known action.
 */
export function recordActivity(userId: string, reason: PointReason): Promise<AwardResult> {
  return awardPoints(userId, POINT_VALUES[reason], reason);
}

/**
 * Check and update daily streak on app open.
 *
 * - Same day → no-op
 * - Yesterday → streak_days += 1, maybe award bonus
 * - 2+ day gap → reset to 1
 */
export async function checkAndUpdateStreak(userId: string): Promise<void> {
  if (userId === DEMO_USER_ID) return;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('last_active_date, streak_days')
      .eq('id', userId)
      .single();

    if (error || !user) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastActive: string | null = user.last_active_date;
    let streakDays: number = user.streak_days ?? 0;

    if (lastActive === today) {
      // Already counted today — idempotent
      return;
    }

    if (lastActive) {
      const lastDate = new Date(lastActive + 'T00:00:00');
      const todayDate = new Date(today + 'T00:00:00');
      const diffMs = todayDate.getTime() - lastDate.getTime();
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

      if (diffDays === 1) {
        // Consecutive day
        streakDays += 1;
      } else {
        // Gap — reset
        streakDays = 1;
      }
    } else {
      // First ever active day
      streakDays = 1;
    }

    // Persist streak + last_active_date
    const { error: updateError } = await supabase
      .from('users')
      .update({ streak_days: streakDays, last_active_date: today })
      .eq('id', userId);

    if (updateError) {
      console.error('Gamification: streak update failed', updateError);
      return;
    }

    // Award 7-day streak bonus
    if (streakDays > 0 && streakDays % 7 === 0) {
      await awardPoints(userId, POINT_VALUES.STREAK_BONUS, 'STREAK_BONUS');
    }

    console.log(`🔥 Streak: ${streakDays} days (last active: ${lastActive} → ${today})`);
  } catch (error) {
    console.error('Gamification: checkAndUpdateStreak error', error);
  }
}
