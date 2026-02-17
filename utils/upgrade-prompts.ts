/**
 * Upgrade Prompts - Benefit-Focused Messaging
 *
 * 2-tier model: Free → Loop Plus ($3.99/mo, $29.99/yr)
 *
 * Strategy: Gate INSIGHTS, not content. Free users see the same cards
 * but without AI insights (match score, explanation, time chip, Loop Pick).
 * Bad: "You've seen your 5 personalized picks for today"
 * Good: "Unlock AI insights like match scores and personalized explanations on every recommendation"
 */

import { SubscriptionTier } from '@/types/subscription';

export interface UpgradePrompt {
  title: string;
  message: string;
  primaryButton: string;
  secondaryButton: string;
  targetTier: SubscriptionTier;
  featureHighlight?: string[];
}

/**
 * Refresh cooldown prompts (when user tries to refresh too early)
 */
export const REFRESH_COOLDOWN_PROMPTS: Record<SubscriptionTier, UpgradePrompt> = {
  free: {
    title: 'Get more from every recommendation',
    message: 'Unlock AI insights like match scores and personalized explanations on every recommendation.\n\nUpgrade to Loop Plus for the full experience!',
    primaryButton: 'Upgrade to Plus',
    secondaryButton: 'Not Now',
    targetTier: 'plus',
    featureHighlight: [
      'AI match scores on every card',
      'Personalized explanations',
      'Time context insights',
      'Plan activities with friends',
      'Ad-free experience',
    ],
  },

  plus: {
    title: '', // Plus users have unlimited refreshes
    message: '',
    primaryButton: '',
    secondaryButton: '',
    targetTier: 'plus',
  },
};

/**
 * Feature-locked prompts (when user tries to use Plus features)
 */
export const FEATURE_LOCKED_PROMPTS = {
  group_planning: {
    title: 'Plan activities with friends',
    message: 'Group planning lets you find the perfect spot for everyone.\n\nUpgrade to Loop Plus to unlock!',
    primaryButton: 'See Plus Features',
    secondaryButton: 'Not Now',
    targetTier: 'plus' as SubscriptionTier,
    featureHighlight: [
      'Plan with up to 10 friends',
      'Find the perfect midpoint',
      'See everyone\'s preferences',
      'Built-in group chat',
    ],
  },

  ai_explanations: {
    title: 'See why this is perfect for you',
    message: 'Loop Plus shows AI-powered match scores, personalized explanations, and time-of-day context on every recommendation.',
    primaryButton: 'Unlock AI Insights',
    secondaryButton: 'Maybe Later',
    targetTier: 'plus' as SubscriptionTier,
    featureHighlight: [
      'Match score on every card',
      'Personalized explanations',
      'Time context chips',
      'Loop Pick badges',
    ],
  },

  calendar_sync: {
    title: 'Sync with your calendar',
    message: 'Auto-sync your Loop activities with Google Calendar & Apple Calendar.\n\nNever double-book again!',
    primaryButton: 'Upgrade Now',
    secondaryButton: 'Cancel',
    targetTier: 'plus' as SubscriptionTier,
    featureHighlight: [
      'Two-way sync',
      'Automatic updates',
      'Travel time included',
      'Free time detection',
    ],
  },

  advanced_filters: {
    title: 'Advanced search filters',
    message: 'Fine-tune your recommendations with advanced filters:\n\n- Price range\n- Specific ratings\n- Open now\n- Distance radius',
    primaryButton: 'Upgrade to Plus',
    secondaryButton: 'Use Basic Filters',
    targetTier: 'plus' as SubscriptionTier,
  },
};

/**
 * Format time remaining for refresh cooldown
 */
export function formatTimeRemaining(lastRefreshTime: number, cooldownHours: number): string {
  const nextRefreshTime = lastRefreshTime + cooldownHours * 3600000; // hours to ms
  const timeLeft = nextRefreshTime - Date.now();

  if (timeLeft <= 0) return 'now';

  const hours = Math.floor(timeLeft / 3600000);
  const minutes = Math.floor((timeLeft % 3600000) / 60000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get refresh status message (user-facing)
 */
export function getRefreshStatusMessage(
  tier: SubscriptionTier,
  lastRefreshTime: number,
  cooldownHours: number
): string {
  if (cooldownHours === 0) {
    return 'Pull to refresh anytime';
  }

  const timeLeft = formatTimeRemaining(lastRefreshTime, cooldownHours);

  if (timeLeft === 'now') {
    return 'Pull to refresh';
  }

  return `New recommendations in ${timeLeft}`;
}

/**
 * Check if user can refresh now
 */
export function canRefreshNow(lastRefreshTime: number, cooldownHours: number): boolean {
  if (cooldownHours === 0) return true; // Plus - unlimited

  const nextRefreshTime = lastRefreshTime + cooldownHours * 3600000;
  return Date.now() >= nextRefreshTime;
}

/**
 * Upgrade CTA messaging
 */
export const UPGRADE_CTA = {
  free_to_plus: {
    short: 'Upgrade to Plus',
    long: 'Unlock AI insights on every recommendation',
    price: '$3.99/month',
    annual_price: '$29.99/year',
  },
} as const;
