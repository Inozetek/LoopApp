/**
 * Subscription Service
 *
 * 2-tier model: Free ($0) + Loop Plus ($3.99/mo, $29.99/yr)
 *
 * Handles subscription tier enforcement:
 * - Free: 8 insight-enabled cards per session, unlimited browsing
 * - Loop Plus: Unlimited insights on all cards
 *
 * Reverse trial: All new users get 7-day Plus trial.
 * Tracks daily usage and enforces limits in Daily Feed mode.
 * Explore Feed has no limits.
 */

import { supabase } from '@/lib/supabase';
import { TrialStatus, INSIGHTS_LIMIT } from '@/types/subscription';

/**
 * Daily limit result
 */
export interface DailyLimitCheck {
  /** Whether user can view more recommendations today */
  canView: boolean;
  /** Maximum recommendations allowed per day for this tier */
  dailyLimit: number;
  /** Number of recommendations viewed today */
  viewedToday: number;
  /** User's effective subscription tier (accounts for trial) */
  subscriptionTier: 'free' | 'plus';
  /** Number of recommendations remaining */
  remainingToday: number;
  /** Number of cards that show AI insights this session */
  insightsLimit: number;
  /** Trial status (if applicable) */
  trialStatus?: TrialStatus;
}

/**
 * Get trial status for a user
 */
export async function getTrialStatus(userId: string): Promise<TrialStatus> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('subscription_status, subscription_end_date')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return { isTrialing: false, daysLeft: 0, expired: false };
    }

    const isTrialing = user.subscription_status === 'trialing';
    if (!isTrialing) {
      return { isTrialing: false, daysLeft: 0, expired: false };
    }

    const endDate = user.subscription_end_date ? new Date(user.subscription_end_date) : null;
    if (!endDate) {
      return { isTrialing: false, daysLeft: 0, expired: true };
    }

    const now = new Date();
    const expired = now >= endDate;
    const daysLeft = expired ? 0 : Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return { isTrialing: !expired, daysLeft, expired };
  } catch (error) {
    console.error('[SubscriptionService] getTrialStatus error:', error);
    return { isTrialing: false, daysLeft: 0, expired: false };
  }
}

/**
 * Get effective subscription tier, accounting for active trial.
 * If trial is expired, auto-downgrades the user to free.
 * Cost guard: trialing users do NOT get Google Places API access.
 */
export async function getEffectiveTier(userId: string): Promise<{
  tier: 'free' | 'plus';
  trialStatus: TrialStatus;
  useGooglePlaces: boolean;
}> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('subscription_tier, subscription_status, subscription_end_date')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return {
        tier: 'free',
        trialStatus: { isTrialing: false, daysLeft: 0, expired: false },
        useGooglePlaces: false,
      };
    }

    const rawTier = normalizeSubscriptionTier(user.subscription_tier);

    // Check trial status
    if (user.subscription_status === 'trialing') {
      const endDate = user.subscription_end_date ? new Date(user.subscription_end_date) : null;
      const now = new Date();

      if (endDate && now >= endDate) {
        // Trial expired — auto-downgrade
        await supabase
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_status: 'active',
          })
          .eq('id', userId);

        return {
          tier: 'free',
          trialStatus: { isTrialing: false, daysLeft: 0, expired: true },
          useGooglePlaces: false,
        };
      }

      const daysLeft = endDate
        ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        tier: 'plus', // Trialing users get Plus features
        trialStatus: { isTrialing: true, daysLeft, expired: false },
        useGooglePlaces: false, // Cost guard: no Google Places API for trial users
      };
    }

    // Non-trial user
    return {
      tier: rawTier,
      trialStatus: { isTrialing: false, daysLeft: 0, expired: false },
      useGooglePlaces: rawTier === 'plus', // Only paid Plus users get Google Places
    };
  } catch (error) {
    console.error('[SubscriptionService] getEffectiveTier error:', error);
    return {
      tier: 'free',
      trialStatus: { isTrialing: false, daysLeft: 0, expired: false },
      useGooglePlaces: false,
    };
  }
}

/**
 * Check if user has reached their daily recommendation limit
 *
 * @param userId User ID
 * @returns Daily limit status
 */
export async function checkDailyLimit(userId: string): Promise<DailyLimitCheck> {
  try {
    const { tier, trialStatus } = await getEffectiveTier(userId);
    const dailyLimit = getDailyLimit(tier);
    const insightsLimit = tier === 'plus' ? INSIGHTS_LIMIT.plus : INSIGHTS_LIMIT.free;

    // Get today's view count from daily_feed_history
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { data: history } = await supabase
      .from('daily_feed_history')
      .select('recommendations_viewed')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    const viewedToday = history?.recommendations_viewed || 0;
    const remainingToday = Math.max(0, dailyLimit - viewedToday);
    const canView = viewedToday < dailyLimit;

    return {
      canView,
      dailyLimit,
      viewedToday,
      subscriptionTier: tier,
      remainingToday,
      insightsLimit,
      trialStatus,
    };
  } catch (error) {
    console.error('[SubscriptionService] checkDailyLimit error:', error);
    // Return safe default on error
    return {
      canView: true,
      dailyLimit: 8,
      viewedToday: 0,
      subscriptionTier: 'free',
      remainingToday: 8,
      insightsLimit: INSIGHTS_LIMIT.free,
    };
  }
}

/**
 * Increment daily view count for user
 *
 * @param userId User ID
 * @param count Number of recommendations viewed (default: 1)
 */
export async function incrementDailyViews(userId: string, count: number = 1): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { tier } = await getEffectiveTier(userId);
    const dailyLimit = getDailyLimit(tier);

    // Upsert daily_feed_history record
    const { error } = await supabase
      .from('daily_feed_history')
      .upsert(
        {
          user_id: userId,
          date: today,
          recommendations_viewed: count,
          subscription_tier: tier,
          daily_limit: dailyLimit,
          recommendations_generated: 0, // Will be set by recommendation engine
        },
        {
          onConflict: 'user_id,date',
          ignoreDuplicates: false,
        }
      );

    if (error) {
      console.error('[SubscriptionService] incrementDailyViews error:', error);
    }
  } catch (error) {
    console.error('[SubscriptionService] incrementDailyViews exception:', error);
  }
}

/**
 * Get daily recommendation limit for subscription tier
 *
 * @param tier Subscription tier
 * @returns Daily recommendation limit
 */
export function getDailyLimit(tier: string): number {
  switch (tier) {
    case 'free':
      return 8;
    case 'plus':
      return 999; // Effectively unlimited
    default:
      return 8;
  }
}

/**
 * Normalize subscription tier — maps legacy 'premium' to 'plus'
 */
function normalizeSubscriptionTier(tier: string | undefined | null): 'free' | 'plus' {
  if (tier === 'plus' || tier === 'premium') return 'plus';
  return 'free';
}

/**
 * Check if user should see upgrade prompt
 *
 * @param userId User ID
 * @returns True if user has hit limit 3+ times in past week
 */
export async function shouldShowUpgradePrompt(userId: string): Promise<boolean> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];

    // Get user's effective tier
    const { tier } = await getEffectiveTier(userId);
    if (tier !== 'free') {
      return false;
    }

    // Count days where user hit the limit
    const { data: history } = await supabase
      .from('daily_feed_history')
      .select('date, recommendations_viewed, daily_limit')
      .eq('user_id', userId)
      .gte('date', startDate);

    if (!history) {
      return false;
    }

    // Count days where viewedCount >= dailyLimit
    const daysAtLimit = history.filter(
      (day: { recommendations_viewed: number; daily_limit: number }) => day.recommendations_viewed >= day.daily_limit
    ).length;

    return daysAtLimit >= 3; // Hit limit 3+ times in past week
  } catch (error) {
    console.error('[SubscriptionService] shouldShowUpgradePrompt error:', error);
    return false;
  }
}

/**
 * Get user's subscription tier
 *
 * @param userId User ID
 * @returns Subscription tier
 */
export async function getUserSubscriptionTier(userId: string): Promise<'free' | 'plus'> {
  try {
    const { tier } = await getEffectiveTier(userId);
    return tier;
  } catch (error) {
    console.error('[SubscriptionService] getUserSubscriptionTier error:', error);
    return 'free';
  }
}
