// @ts-nocheck - Phase 2 feature: Run migration 010_phase2_tables_consolidated.sql first
/**
 * Referral Service - Viral Growth Engine
 *
 * Strategy: "Invite 3 friends → Get 1 month Loop Plus free"
 * - Both inviter and invitee get rewards
 * - Track referrals for analytics
 * - Viral coefficient target: K-factor > 0.7
 *
 * Phase 2 feature - requires running migration 010_phase2_tables_consolidated.sql
 */

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type ReferralRow = Database['public']['Tables']['referrals']['Row'];
type ReferralRewardRow = Database['public']['Tables']['referral_rewards']['Row'];
type UserRow = Database['public']['Tables']['users']['Row'];

export interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  pendingReferrals: number;
  completedReferrals: number;
  rewardsEarned: number;
  totalPlusDaysEarned: number;
  nextMilestone: {
    count: number;
    reward: string;
    progress: number; // 0-1
  };
}

// Export interface for UI compatibility
export interface ReferralReward {
  id: string;
  rewardType: string;
  description: string;
  plusDays: number;
  status: 'pending' | 'granted' | 'revoked' | 'expired';
  grantedAt?: string;
  expiresAt?: string;
}

/**
 * Get user's referral code
 */
export async function getUserReferralCode(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Error fetching referral code:', error);
      return null;
    }

    return data.referral_code || null;
  } catch (error) {
    console.error('Error in getUserReferralCode:', error);
    return null;
  }
}

/**
 * Get user's referral stats
 */
export async function getReferralStats(userId: string): Promise<ReferralStats | null> {
  try {
    const { data, error } = await supabase
      .from('referral_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.error('Error fetching referral stats:', error);
      return null;
    }

    // Calculate next milestone
    const completedCount = data.completed_referrals || 0;
    const nextMilestoneCount = Math.ceil((completedCount + 1) / 3) * 3; // Next multiple of 3

    const milestones = [
      { count: 3, reward: '1 month Loop Plus free' },
      { count: 6, reward: '1 month Loop Plus free' },
      { count: 9, reward: '1 month Loop Plus free' },
      { count: 10, reward: '3 months Loop Premium!' },
      { count: 25, reward: '6 months Loop Premium!' },
      { count: 100, reward: '1 year Loop Premium + VIP status!' },
    ];

    const nextMilestone = milestones.find((m) => m.count > completedCount) || milestones[milestones.length - 1];

    return {
      referralCode: data.referral_code,
      totalReferrals: data.referral_count || 0,
      pendingReferrals: data.pending_referrals || 0,
      completedReferrals: completedCount,
      rewardsEarned: data.rewards_earned || 0,
      totalPlusDaysEarned: data.total_plus_days_earned || 0,
      nextMilestone: {
        count: nextMilestone.count,
        reward: nextMilestone.reward,
        progress: completedCount / nextMilestone.count,
      },
    };
  } catch (error) {
    console.error('Error in getReferralStats:', error);
    return null;
  }
}

/**
 * Get user's active rewards
 */
export async function getActiveRewards(userId: string): Promise<ReferralReward[]> {
  try {
    const { data, error } = await supabase
      .from('referral_rewards')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'granted')
      .order('granted_at', { ascending: false });

    if (error) {
      console.error('Error fetching active rewards:', error);
      return [];
    }

    return (data || []).map((reward) => ({
      id: reward.id,
      rewardType: reward.reward_type,
      description: reward.reward_description,
      plusDays: reward.reward_plus_days || 0,
      status: reward.status,
      grantedAt: reward.granted_at,
      expiresAt: reward.expires_at,
    }));
  } catch (error) {
    console.error('Error in getActiveRewards:', error);
    return [];
  }
}

/**
 * Process referral when new user signs up with code
 */
export async function processReferralCode(
  userId: string,
  referralCode: string,
  source: 'sms' | 'whatsapp' | 'instagram' | 'facebook' | 'link' | 'other' = 'link'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Call database function to process referral
    const { data, error } = await supabase.rpc('process_referral', {
      p_referred_user_id: userId,
      p_referral_code: referralCode.toUpperCase(),
      p_source: source,
    });

    if (error) {
      console.error('Error processing referral:', error);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string };

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in processReferralCode:', error);
    return { success: false, error: 'Failed to process referral code' };
  }
}

/**
 * Complete referral when user finishes onboarding
 * Grants rewards to both inviter and invitee
 */
export async function completeReferral(userId: string): Promise<{ success: boolean; rewards?: any }> {
  try {
    const { data, error } = await supabase.rpc('complete_referral', {
      p_referred_user_id: userId,
    });

    if (error) {
      console.error('Error completing referral:', error);
      return { success: false };
    }

    const result = data as { success: boolean; invitee_reward_id?: string; inviter_reward_id?: string };

    if (!result.success) {
      return { success: false };
    }

    return {
      success: true,
      rewards: {
        inviteeRewardId: result.invitee_reward_id,
        inviterRewardId: result.inviter_reward_id,
      },
    };
  } catch (error) {
    console.error('Error in completeReferral:', error);
    return { success: false };
  }
}

/**
 * Generate referral share message
 */
export function getReferralShareMessage(referralCode: string, userName?: string): string {
  const inviterName = userName || 'Your friend';

  return `${inviterName} invited you to Loop! 🎉\n\nDiscover amazing activities tailored to your free time.\n\nUse code ${referralCode} to get 7 days of Loop Plus FREE!\n\nhttps://loopapp.com/join/${referralCode}`;
}

/**
 * Generate referral share link
 */
export function getReferralShareLink(referralCode: string): string {
  // Deep link format: loopapp://join/{referralCode}
  // Web fallback: https://loopapp.com/join/{referralCode}
  return `https://loopapp.com/join/${referralCode}`;
}

/**
 * Track referral source analytics
 */
export async function trackReferralShare(
  userId: string,
  source: 'sms' | 'whatsapp' | 'instagram' | 'facebook' | 'link' | 'copy'
): Promise<void> {
  try {
    // Log to analytics (can integrate Posthog/Mixpanel later)
    console.log(`[Analytics] User ${userId} shared referral via ${source}`);

    // Optional: Track in database for attribution
    // This helps measure which channels drive the most referrals
  } catch (error) {
    console.error('Error tracking referral share:', error);
  }
}

/**
 * Check if user has pending referral rewards to apply
 */
export async function applyPendingRewards(userId: string): Promise<{
  applied: boolean;
  plusDaysAdded: number;
}> {
  try {
    // Get all granted rewards that haven't been applied yet
    const { data: rewards, error } = await supabase
      .from('referral_rewards')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'granted')
      .gte('expires_at', new Date().toISOString());

    if (error || !rewards || rewards.length === 0) {
      return { applied: false, plusDaysAdded: 0 };
    }

    // Sum up total Plus days
    const totalPlusDays = rewards.reduce((sum, r) => sum + (r.reward_plus_days || 0), 0);

    if (totalPlusDays === 0) {
      return { applied: false, plusDaysAdded: 0 };
    }

    // Calculate new subscription end date
    const { data: user } = await supabase
      .from('users')
      .select('subscription_tier, subscription_end_date')
      .eq('id', userId)
      .single();

    let newEndDate: Date;

    if (user?.subscription_end_date && new Date(user.subscription_end_date) > new Date()) {
      // Extend existing subscription
      newEndDate = new Date(user.subscription_end_date);
      newEndDate.setDate(newEndDate.getDate() + totalPlusDays);
    } else {
      // Start new subscription
      newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + totalPlusDays);
    }

    // Update user's subscription
    await supabase
      .from('users')
      .update({
        subscription_tier: 'plus',
        subscription_status: 'active',
        subscription_end_date: newEndDate.toISOString(),
      })
      .eq('id', userId);

    return {
      applied: true,
      plusDaysAdded: totalPlusDays,
    };
  } catch (error) {
    console.error('Error applying pending rewards:', error);
    return { applied: false, plusDaysAdded: 0 };
  }
}

/**
 * Get leaderboard (top referrers)
 */
export async function getReferralLeaderboard(limit: number = 10): Promise<
  Array<{
    userId: string;
    name: string;
    referralCount: number;
    rank: number;
  }>
> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, referral_count')
      .order('referral_count', { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return data.map((user, index) => ({
      userId: user.id,
      name: user.name || 'Anonymous',
      referralCount: user.referral_count || 0,
      rank: index + 1,
    }));
  } catch (error) {
    console.error('Error in getReferralLeaderboard:', error);
    return [];
  }
}
