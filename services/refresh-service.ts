// @ts-nocheck - Phase 2 feature: Run migration 010_phase2_tables_consolidated.sql first
/**
 * Refresh Service - Tier-Based Cooldown Enforcement
 *
 * Handles refresh cooldowns with benefit-focused messaging
 *
 * Phase 2 feature - requires running migration 010_phase2_tables_consolidated.sql
 */

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type RefreshHistory = Database['public']['Tables']['refresh_history']['Row'];
import { SubscriptionTier, TIER_LIMITS } from '@/types/subscription';
import {
  REFRESH_COOLDOWN_PROMPTS,
  formatTimeRemaining,
  canRefreshNow,
} from '@/utils/upgrade-prompts';

export interface RefreshCheckResult {
  canRefresh: boolean;
  secondsUntilRefresh: number;
  upgradePrompt?: {
    title: string;
    message: string;
    primaryButton: string;
    secondaryButton: string;
    targetTier: SubscriptionTier;
    featureHighlight?: string[];
  };
}

/**
 * Check if user can refresh recommendations
 */
export async function checkRefreshEligibility(userId: string): Promise<RefreshCheckResult> {
  try {
    // Get user's tier and last refresh time
    const { data: user, error } = await supabase
      .from('users')
      .select('subscription_tier, last_refresh_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.error('Error fetching user for refresh check:', error);
      // Default to allowing refresh on error
      return { canRefresh: true, secondsUntilRefresh: 0 };
    }

    const tier = (user.subscription_tier || 'free') as SubscriptionTier;
    const cooldownHours = TIER_LIMITS[tier].refresh_interval_hours;

    // Premium users can always refresh
    if (cooldownHours === 0) {
      return { canRefresh: true, secondsUntilRefresh: 0 };
    }

    // Calculate time since last refresh
    const lastRefreshTime = user.last_refresh_at
      ? new Date(user.last_refresh_at).getTime()
      : Date.now() - cooldownHours * 3600000; // Allow immediate refresh if no history

    const canRefresh = canRefreshNow(lastRefreshTime, cooldownHours);

    if (canRefresh) {
      return { canRefresh: true, secondsUntilRefresh: 0 };
    }

    // Calculate seconds until next refresh
    const nextRefreshTime = lastRefreshTime + cooldownHours * 3600000;
    const secondsUntilRefresh = Math.ceil((nextRefreshTime - Date.now()) / 1000);

    // Return with upgrade prompt
    return {
      canRefresh: false,
      secondsUntilRefresh,
      upgradePrompt: REFRESH_COOLDOWN_PROMPTS[tier],
    };
  } catch (error) {
    console.error('Error in checkRefreshEligibility:', error);
    // Default to allowing refresh on error
    return { canRefresh: true, secondsUntilRefresh: 0 };
  }
}

/**
 * Update last refresh time (call after successful refresh)
 */
export async function recordRefresh(
  userId: string,
  recommendationsCount: number,
  dataSource: 'database' | 'google_places' | 'osm',
  googleApiCalls: number = 0
): Promise<void> {
  try {
    // Update user's last refresh time
    const { error: updateError } = await supabase
      .from('users')
      .update({ last_refresh_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating last_refresh_at:', updateError);
    }

    // Get user's tier for analytics
    const { data: user } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    const tier = user?.subscription_tier || 'free';

    // Record in refresh history for analytics
    const estimatedCostCents = googleApiCalls * 1.7; // $0.017 per call

    const { error: historyError } = await supabase.from('refresh_history').insert({
      user_id: userId,
      tier,
      recommendations_count: recommendationsCount,
      data_source: dataSource,
      google_api_calls: googleApiCalls,
      estimated_cost_cents: Math.round(estimatedCostCents),
    });

    if (historyError) {
      console.error('Error recording refresh history:', historyError);
    }
  } catch (error) {
    console.error('Error in recordRefresh:', error);
  }
}

/**
 * Get refresh status for UI display
 */
export async function getRefreshStatus(userId: string): Promise<{
  tier: SubscriptionTier;
  canRefresh: boolean;
  statusMessage: string;
  statusEmoji: string;
  statusColor: string;
  lastRefreshAgo?: string;
}> {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('subscription_tier, last_refresh_at')
      .eq('id', userId)
      .single();

    const tier = (user?.subscription_tier || 'free') as SubscriptionTier;
    const cooldownHours = TIER_LIMITS[tier].refresh_interval_hours;

    const lastRefreshTime = user?.last_refresh_at
      ? new Date(user.last_refresh_at).getTime()
      : Date.now();

    const canRefresh = canRefreshNow(lastRefreshTime, cooldownHours);

    // Tier-specific status messages (benefit-focused)
    const statusConfig = {
      free: {
        emoji: '🔵',
        color: '#8E8E93',
        statusMessage: canRefresh
          ? 'Pull to refresh'
          : `Fresh picks in ${formatTimeRemaining(lastRefreshTime, cooldownHours)}`,
      },
      plus: {
        emoji: '🟢',
        color: '#00D9A3',
        statusMessage: canRefresh ? 'Pull for live updates' : 'Updating soon',
      },
      premium: {
        emoji: '🔴',
        color: '#FF9500',
        statusMessage: 'Pull to refresh anytime',
      },
    };

    const config = statusConfig[tier];

    // Calculate "last refresh ago" for display
    const lastRefreshAgo = getTimeAgoString(lastRefreshTime);

    return {
      tier,
      canRefresh,
      statusMessage: config.statusMessage,
      statusEmoji: config.emoji,
      statusColor: config.color,
      lastRefreshAgo,
    };
  } catch (error) {
    console.error('Error in getRefreshStatus:', error);
    return {
      tier: 'free',
      canRefresh: true,
      statusMessage: 'Pull to refresh',
      statusEmoji: '🔵',
      statusColor: '#8E8E93',
    };
  }
}

/**
 * Format time ago string (e.g., "2 hours ago", "just now")
 */
function getTimeAgoString(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Error class for refresh cooldown
 */
export class RefreshCooldownError extends Error {
  constructor(
    public secondsUntilRefresh: number,
    public upgradePrompt: RefreshCheckResult['upgradePrompt']
  ) {
    super('Refresh cooldown active');
    this.name = 'RefreshCooldownError';
  }
}
