/**
 * Notification Routing
 *
 * Maps each NotificationType to a tab destination and badge effect.
 * computeTabBadges() aggregates all unread notifications + synthetic counts
 * into per-tab badge states.
 *
 * Badge priority: red count supersedes blue dot.
 */

import type { NotificationType, DashboardNotification } from '@/types/dashboard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TabName = 'calendar' | 'recommendations' | 'friends' | 'profile';
export type BadgeEffect = 'count' | 'dot' | 'none';

export interface NotificationRoute {
  tab: TabName | null; // null = no tab badge (push-only or tray-only)
  badgeEffect: BadgeEffect;
}

export interface TabBadgeState {
  count: number; // Red count badge (actionable items)
  dot: boolean;  // Blue dot (new content signal)
}

export type TabBadges = Record<TabName, TabBadgeState>;

// ---------------------------------------------------------------------------
// Routing Map
// ---------------------------------------------------------------------------

export const NOTIFICATION_ROUTES: Record<NotificationType, NotificationRoute> = {
  // My Loop tab
  feedback_reminder:    { tab: 'calendar',        badgeEffect: 'count' },

  // For You tab
  pending_invite:       { tab: 'recommendations', badgeEffect: 'count' },
  activity_invite:      { tab: 'recommendations', badgeEffect: 'count' },
  high_match:           { tab: 'recommendations', badgeEffect: 'dot' },
  new_recommendations:  { tab: 'recommendations', badgeEffect: 'dot' },
  radar_alert:          { tab: 'recommendations', badgeEffect: 'dot' },

  // Social tab
  friend_request:       { tab: 'friends',         badgeEffect: 'count' },
  friend_activity:      { tab: 'friends',         badgeEffect: 'dot' },
  activity_share:       { tab: 'friends',         badgeEffect: 'dot' },

  // Profile tab
  loop_score_milestone: { tab: 'profile',         badgeEffect: 'dot' },

  // No tab badge (push-only, tray-only, or editorial)
  loops_planned:        { tab: null,              badgeEffect: 'none' },
  event_reminder:       { tab: null,              badgeEffect: 'none' },
  featured_venue:       { tab: null,              badgeEffect: 'none' },
  featured_movie:       { tab: null,              badgeEffect: 'none' },
  lunch_suggestion:     { tab: null,              badgeEffect: 'none' },
  family_in_town:       { tab: null,              badgeEffect: 'none' },
  comment_reply:        { tab: null,              badgeEffect: 'none' },
  other:                { tab: null,              badgeEffect: 'none' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_BADGE: TabBadgeState = { count: 0, dot: false };

function emptyBadges(): TabBadges {
  return {
    calendar: { ...EMPTY_BADGE },
    recommendations: { ...EMPTY_BADGE },
    friends: { ...EMPTY_BADGE },
    profile: { ...EMPTY_BADGE },
  };
}

// ---------------------------------------------------------------------------
// computeTabBadges
// ---------------------------------------------------------------------------

export interface BadgeInputs {
  /** Unread notifications from the DB */
  notifications: Pick<DashboardNotification, 'notification_type' | 'is_read' | 'is_dismissed'>[];
  /** Synthetic: pending feedback count (drives My Loop red badge) */
  pendingFeedbackCount?: number;
  /** Synthetic: any recommendation has matchScore >= 90 */
  hasHighMatchRec?: boolean;
  /** Synthetic: fresh daily recommendations available */
  hasNewRecommendations?: boolean;
}

/**
 * Computes per-tab badge states from all notification sources.
 *
 * Rules:
 * - 'count' notifications increment the tab's count (red badge)
 * - 'dot' notifications set the tab's dot flag (blue dot)
 * - Red count supersedes blue dot (consumer decides rendering)
 * - Dismissed / read notifications are skipped
 */
export function computeTabBadges(inputs: BadgeInputs): TabBadges {
  const badges = emptyBadges();

  // 1. Process DB notifications
  for (const n of inputs.notifications) {
    if (n.is_dismissed) continue;

    const route = NOTIFICATION_ROUTES[n.notification_type];
    if (!route || !route.tab) continue;

    const tabBadge = badges[route.tab];

    if (route.badgeEffect === 'count') {
      tabBadge.count += 1;
    } else if (route.badgeEffect === 'dot') {
      tabBadge.dot = true;
    }
  }

  // 2. Synthetic: pending feedback → My Loop count
  if (inputs.pendingFeedbackCount && inputs.pendingFeedbackCount > 0) {
    badges.calendar.count += inputs.pendingFeedbackCount;
  }

  // 3. Synthetic: high-match rec → For You dot
  if (inputs.hasHighMatchRec) {
    badges.recommendations.dot = true;
  }

  // 4. Synthetic: new recommendations → For You dot
  if (inputs.hasNewRecommendations) {
    badges.recommendations.dot = true;
  }

  return badges;
}

/**
 * Returns the route for a given notification type.
 * Falls back to no-tab/none if type is unknown.
 */
export function getNotificationRoute(type: NotificationType): NotificationRoute {
  return NOTIFICATION_ROUTES[type] ?? { tab: null, badgeEffect: 'none' };
}
