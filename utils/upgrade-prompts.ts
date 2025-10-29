/**
 * Upgrade Prompts - Benefit-Focused Messaging
 *
 * Strategy: Focus on VALUE and BENEFITS, not technical limitations
 * Bad: "You've used 5/5 recommendations"
 * Good: "Unlock live recommendations anytime"
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
    title: '🕐 Fresh recommendations coming soon',
    message: 'Your recommendations update every few hours to give you the best curated picks.\n\nWant live updates anytime? Upgrade to Loop Plus!',
    primaryButton: 'Upgrade to Plus',
    secondaryButton: 'Wait for Update',
    targetTier: 'plus',
    featureHighlight: [
      '🟢 Live recommendations - always fresh',
      '👥 Plan activities with friends',
      '📅 Calendar sync',
      '🎯 AI-powered insights',
      '🚫 Ad-free experience',
    ],
  },

  plus: {
    title: '⚡ Want instant updates?',
    message: 'Loop Plus gives you hourly fresh data.\n\nUpgrade to Premium for real-time recommendations anytime!',
    primaryButton: 'Upgrade to Premium',
    secondaryButton: 'Continue',
    targetTier: 'premium',
    featureHighlight: [
      '🔴 Real-time data from all sources',
      '♾️ Unlimited refreshes',
      '✈️ Multi-day trip planner',
      '🤖 AI Concierge Mode',
      '👥 Unlimited group planning',
    ],
  },

  premium: {
    title: '', // Premium users don't see cooldown prompts
    message: '',
    primaryButton: '',
    secondaryButton: '',
    targetTier: 'premium',
  },
};

/**
 * Feature-locked prompts (when user tries to use premium features)
 */
export const FEATURE_LOCKED_PROMPTS = {
  group_planning: {
    title: '👥 Plan activities with friends',
    message: 'Group planning lets you find the perfect spot for everyone.\n\nUpgrade to Loop Plus to unlock!',
    primaryButton: 'See Plus Features',
    secondaryButton: 'Not Now',
    targetTier: 'plus' as SubscriptionTier,
    featureHighlight: [
      'Plan with up to 5 friends',
      'Find the perfect midpoint',
      'See everyone\'s preferences',
      'Built-in group chat',
    ],
  },

  ai_explanations: {
    title: '🎯 Why did we suggest this?',
    message: 'Loop Plus members get AI-powered insights explaining why each recommendation is perfect for you.',
    primaryButton: 'Unlock AI Insights',
    secondaryButton: 'Maybe Later',
    targetTier: 'plus' as SubscriptionTier,
    featureHighlight: [
      'Personalized explanations',
      'Match your interests',
      'Perfect timing',
      'Smart context awareness',
    ],
  },

  calendar_sync: {
    title: '📅 Sync with your calendar',
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
    title: '🔍 Advanced search filters',
    message: 'Fine-tune your recommendations with advanced filters:\n\n• Price range\n• Specific ratings\n• Open now\n• Distance radius',
    primaryButton: 'Upgrade to Plus',
    secondaryButton: 'Use Basic Filters',
    targetTier: 'plus' as SubscriptionTier,
  },

  multi_day_itinerary: {
    title: '✈️ Multi-day trip planner',
    message: 'Planning a trip? Loop Premium creates full itineraries for your entire vacation.\n\nPerfect for:\n• Weekend getaways\n• Week-long trips\n• City explorations',
    primaryButton: 'Upgrade to Premium',
    secondaryButton: 'Maybe Later',
    targetTier: 'premium' as SubscriptionTier,
    featureHighlight: [
      'Full multi-day itineraries',
      'Optimized routing',
      'Budget tracking',
      'Restaurant reservations',
      'Ticket booking',
    ],
  },

  ai_concierge: {
    title: '🤖 AI Concierge Mode',
    message: 'Your personal AI assistant that:\n\n• Texts you proactive suggestions\n• Learns your routines\n• Anticipates your needs\n• Handles all the planning',
    primaryButton: 'Unlock Concierge',
    secondaryButton: 'Not Now',
    targetTier: 'premium' as SubscriptionTier,
    featureHighlight: [
      'Proactive suggestions',
      'Smart notifications',
      'Routine learning',
      'VIP treatment',
    ],
  },

  max_group_size: {
    title: '👥 Planning with more friends?',
    message: 'Loop Plus supports up to 5 friends.\n\nUpgrade to Premium for unlimited group planning!',
    primaryButton: 'Upgrade to Premium',
    secondaryButton: 'Remove Someone',
    targetTier: 'premium' as SubscriptionTier,
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
  if (cooldownHours === 0) return true; // Premium - unlimited

  const nextRefreshTime = lastRefreshTime + cooldownHours * 3600000;
  return Date.now() >= nextRefreshTime;
}

/**
 * Upgrade CTA messaging by tier
 */
export const UPGRADE_CTA = {
  free_to_plus: {
    short: 'Upgrade to Plus',
    long: 'Unlock live data, group planning & more',
    price: '$4.99/month',
  },
  plus_to_premium: {
    short: 'Upgrade to Premium',
    long: 'Get real-time updates & AI concierge',
    price: '$9.99/month',
  },
  free_to_premium: {
    short: 'Upgrade to Premium',
    long: 'Ultimate Loop experience',
    price: '$9.99/month',
  },
} as const;
