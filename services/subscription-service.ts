/**
 * Subscription Service
 *
 * Handles subscription tier enforcement for dual feed architecture:
 * - Free: 5 daily recommendations
 * - Loop Plus: 15 daily recommendations
 * - Loop Premium: 30 daily recommendations
 *
 * Tracks daily usage and enforces limits in Daily Feed mode.
 * Explore Feed has no limits.
 */

import { supabase } from '@/lib/supabase';

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
  /** User's subscription tier */
  subscriptionTier: 'free' | 'plus' | 'premium';
  /** Number of recommendations remaining */
  remainingToday: number;
}

/**
 * Check if user has reached their daily recommendation limit
 *
 * @param userId User ID
 * @returns Daily limit status
 */
export async function checkDailyLimit(userId: string): Promise<DailyLimitCheck> {
  try {
    // Get user's subscription tier
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('[SubscriptionService] Error fetching user:', userError);
      // Default to free tier on error
      return {
        canView: false,
        dailyLimit: 5,
        viewedToday: 0,
        subscriptionTier: 'free',
        remainingToday: 5,
      };
    }

    const subscriptionTier = (user.subscription_tier || 'free') as 'free' | 'plus' | 'premium';
    const dailyLimit = getDailyLimit(subscriptionTier);

    // Get today's view count from daily_feed_history
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { data: history, error: historyError } = await supabase
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
      subscriptionTier,
      remainingToday,
    };
  } catch (error) {
    console.error('[SubscriptionService] checkDailyLimit error:', error);
    // Return safe default on error
    return {
      canView: true,
      dailyLimit: 5,
      viewedToday: 0,
      subscriptionTier: 'free',
      remainingToday: 5,
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

    // Get user's subscription tier
    const { data: user } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    const subscriptionTier = (user?.subscription_tier || 'free') as 'free' | 'plus' | 'premium';
    const dailyLimit = getDailyLimit(subscriptionTier);

    // Upsert daily_feed_history record
    const { error } = await supabase
      .from('daily_feed_history')
      .upsert(
        {
          user_id: userId,
          date: today,
          recommendations_viewed: count,
          subscription_tier: subscriptionTier,
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
      return 5;
    case 'plus':
      return 15;
    case 'premium':
      return 30;
    default:
      return 5;
  }
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

    // Get user's tier
    const { data: user } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    // Only show upgrade prompt to free users
    if (user?.subscription_tier !== 'free') {
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
export async function getUserSubscriptionTier(userId: string): Promise<'free' | 'plus' | 'premium'> {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    return (user?.subscription_tier || 'free') as 'free' | 'plus' | 'premium';
  } catch (error) {
    console.error('[SubscriptionService] getUserSubscriptionTier error:', error);
    return 'free';
  }
}
