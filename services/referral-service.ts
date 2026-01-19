/**
 * Referral Service - Viral Growth Engine
 *
 * Strategy: "Invite a friend → Both get 1 month Premium free"
 * - Viral coefficient target: K-factor > 0.7
 * - Uses new referrals table from 20260110 migrations
 * - Rewards granted directly to users table (subscription_tier, subscription_end_date)
 */

import { supabase } from '@/lib/supabase';
import type { Referral } from '@/types/user';

export interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  pendingReferrals: number;
  completedReferrals: number;
  rewardedReferrals: number;
  rewardsEarned: number;
  totalPlusDaysEarned: number;
  nextMilestone: {
    referralsNeeded: number;
    reward: string;
  } | null;
}

export interface ReferralReward {
  id: string;
  type: 'premium_days' | 'plus_days' | 'credit';
  amount: number;
  description: string;
  plusDays: number;
  expiresAt: string | null;
  grantedAt: string;
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
    // Get user's referral code
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user:', userError);
      return null;
    }

    // Get all referrals for this user
    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select('status')
      .eq('referrer_user_id', userId);

    if (referralsError) {
      console.error('Error fetching referrals:', referralsError);
      return null;
    }

    const rewardedCount = referrals?.filter((r: { status: string }) => r.status === 'rewarded').length || 0;

    // Calculate next milestone
    const milestones = [
      { referralsNeeded: 3, reward: '1 week Premium free' },
      { referralsNeeded: 5, reward: '1 month Premium free' },
      { referralsNeeded: 10, reward: '3 months Premium free' },
      { referralsNeeded: 25, reward: '1 year Premium free' },
    ];

    const nextMilestone = milestones.find(m => m.referralsNeeded > rewardedCount) || null;

    const stats: ReferralStats = {
      referralCode: userData.referral_code || '',
      totalReferrals: referrals?.length || 0,
      pendingReferrals: referrals?.filter((r: { status: string }) => r.status === 'pending').length || 0,
      completedReferrals: referrals?.filter((r: { status: string }) => r.status === 'completed').length || 0,
      rewardedReferrals: rewardedCount,
      rewardsEarned: rewardedCount, // Each rewarded referral = 1 reward
      totalPlusDaysEarned: rewardedCount * 30, // 30 days per referral
      nextMilestone,
    };

    return stats;
  } catch (error) {
    console.error('Error in getReferralStats:', error);
    return null;
  }
}

/**
 * Create a referral invitation
 * Called when user invites a friend via contact sync or manual invite
 */
export async function createReferralInvitation(
  referrerUserId: string,
  referralCode: string,
  inviteData: {
    email?: string;
    phone?: string;
    method: 'sms' | 'email' | 'link' | 'contact_sync';
  }
): Promise<Referral | null> {
  const { data, error } = await supabase
    .from('referrals')
    .insert({
      referrer_user_id: referrerUserId,
      referral_code: referralCode,
      referred_email: inviteData.email,
      referred_phone: inviteData.phone,
      invite_method: inviteData.method,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating referral:', error);
    return null;
  }

  return data;
}

/**
 * Complete a referral when new user signs up with code
 * This is called during signup flow
 */
export async function completeReferral(
  referralCode: string,
  referredUserId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('complete_referral', {
      p_referral_code: referralCode.toUpperCase(),
      p_referred_user_id: referredUserId,
    });

    if (error) {
      console.error('Error completing referral:', error);
      return false;
    }

    // If referral was completed successfully, grant rewards
    if (data === true) {
      // Get the referral record to pass to reward function
      const { data: referral } = await supabase
        .from('referrals')
        .select('id')
        .eq('referral_code', referralCode.toUpperCase())
        .eq('referred_user_id', referredUserId)
        .eq('status', 'completed')
        .single();

      if (referral) {
        await rewardReferral(referral.id);
      }
    }

    return data === true;
  } catch (error) {
    console.error('Error in completeReferral:', error);
    return false;
  }
}

/**
 * Grant Premium rewards to both referrer and referred user
 * Called automatically after completing a referral
 */
export async function rewardReferral(referralId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('reward_referral', {
      p_referral_id: referralId,
    });

    if (error) {
      console.error('Error rewarding referral:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error in rewardReferral:', error);
    return false;
  }
}

/**
 * Get user's referral history
 */
export async function getReferralHistory(userId: string): Promise<Referral[]> {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching referral history:', error);
    return [];
  }

  return data || [];
}

/**
 * Generate referral link for sharing
 */
export function generateReferralLink(referralCode: string): string {
  // TODO: Update with actual app URL when deployed
  const baseUrl = 'https://loop.app'; // or your custom domain
  return `${baseUrl}/signup?ref=${referralCode}`;
}

/**
 * Generate invite message for SMS/Email
 */
export function generateInviteMessage(
  referrerName: string,
  referralLink: string
): string {
  return `Hey! I'm using Loop to find things to do. Join me and we both get 1 month free Premium: ${referralLink}`;
}

/**
 * Validate referral code format
 */
export function isValidReferralCode(code: string): boolean {
  // Must be 6 alphanumeric characters
  return /^[A-Z0-9]{6}$/.test(code);
}

/**
 * Check if referral code exists and is valid
 */
export async function validateReferralCode(code: string): Promise<{
  valid: boolean;
  referrerName?: string;
  error?: string;
}> {
  if (!isValidReferralCode(code)) {
    return { valid: false, error: 'Invalid referral code format' };
  }

  // Check if code exists and get referrer info
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('referral_code', code.toUpperCase())
    .single();

  if (error || !user) {
    return { valid: false, error: 'Referral code not found' };
  }

  return {
    valid: true,
    referrerName: user.name,
  };
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

    return data.map((user: { id: string; name: string | null; referral_count: number | null }, index: number) => ({
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

/**
 * Process referral code during signup
 * Validates the code and completes the referral (grants rewards)
 * @param newUserId - The ID of the new user who signed up
 * @param code - The referral code used
 * @param method - How the referral was received ('link', 'sms', 'email', 'contact_sync')
 */
export async function processReferralCode(
  newUserId: string,
  code: string,
  method: 'link' | 'sms' | 'email' | 'contact_sync' = 'link'
): Promise<{ success: boolean; error?: string; referrerName?: string }> {
  try {
    // Validate the code first
    const validation = await validateReferralCode(code);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Complete the referral (this grants rewards to both users)
    const completed = await completeReferral(code, newUserId);
    if (!completed) {
      return { success: false, error: 'Failed to process referral' };
    }

    return { success: true, referrerName: validation.referrerName };
  } catch (error) {
    console.error('Error in processReferralCode:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get active rewards for a user
 * Returns list of rewards (premium days, etc.) that are currently active
 */
export async function getActiveRewards(userId: string): Promise<ReferralReward[]> {
  try {
    // Get all rewarded referrals for this user
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('id, status, rewarded_at')
      .eq('referrer_user_id', userId)
      .eq('status', 'rewarded')
      .order('rewarded_at', { ascending: false });

    if (error || !referrals) {
      console.error('Error fetching active rewards:', error);
      return [];
    }

    // Convert to ReferralReward format
    // Each rewarded referral grants 30 days of premium
    const rewards: ReferralReward[] = referrals.map((ref: { id: string; rewarded_at: string | null }) => ({
      id: ref.id,
      type: 'premium_days' as const,
      amount: 30, // 30 days per referral
      description: '30 days Premium from referral',
      plusDays: 30,
      expiresAt: null, // No expiration on earned premium days
      grantedAt: ref.rewarded_at || new Date().toISOString(),
    }));

    return rewards;
  } catch (error) {
    console.error('Error in getActiveRewards:', error);
    return [];
  }
}
