/**
 * Dashboard Types
 * TypeScript interfaces for Daily Dashboard feature
 */

export type NotificationType =
  | 'loops_planned'
  | 'friend_activity'
  | 'new_recommendations'
  | 'featured_venue'
  | 'featured_movie'
  | 'pending_invite'
  | 'family_in_town'
  | 'lunch_suggestion'
  | 'event_reminder'
  | 'other';

export type NotificationPriority = 'info' | 'attention' | 'urgent';

export type FriendGroupVisibility = 'full_access' | 'public_tasks_only' | 'busy_only';

export type FriendActivityType =
  | 'loop_started'
  | 'loop_completed'
  | 'event_added'
  | 'recommendation_accepted'
  | 'group_plan_created';

// ============================================================================
// DASHBOARD NOTIFICATION
// ============================================================================

export interface DashboardNotification {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message?: string;
  data?: Record<string, any>;
  action_button_text?: string;
  action_deep_link?: string;

  // Related entities
  related_event_id?: string;
  related_friend_id?: string;
  related_plan_id?: string;

  // State
  is_read: boolean;
  is_dismissed: boolean;
  is_actioned: boolean;
  dismissed_at?: string;
  actioned_at?: string;
  expires_at?: string;
  created_at: string;
}

// ============================================================================
// FRIEND GROUP
// ============================================================================

export interface FriendGroup {
  id: string;
  name: string;
  member_ids: string[];
  visibility: FriendGroupVisibility;
}

// ============================================================================
// PRIVACY SETTINGS (Extended)
// ============================================================================

export interface PrivacySettings {
  share_loop_with: 'everyone' | 'friends' | 'close_friends' | 'no_one';
  discoverable: boolean;
  share_location: boolean;

  // Friend group controls
  friend_groups?: FriendGroup[];
  task_visibility_rules?: {
    hidden_categories: string[];
    public_categories: string[];
  };
  default_group_visibility?: FriendGroupVisibility;

  // Group invite settings (existing)
  group_invite_settings?: {
    who_can_invite: string;
    require_mutual_friends: boolean;
    blocked_from_invites: string[];
    auto_decline_from_strangers: boolean;
    notification_preferences: {
      group_invites: boolean;
      new_friend_in_group: boolean;
    };
  };
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export interface DashboardStats {
  loops_planned_count: number;
  friends_active_count: number;
  new_recommendations_count: number;
  pending_invites_count: number;

  // Detailed breakdowns
  loops_summary?: {
    first_event_time?: string;
    last_event_time?: string;
    total_stops: number;
    categories: string[];
  };

  friends_activity?: FriendActivity[];
  featured_items?: FeaturedItem[];
}

// ============================================================================
// FRIEND ACTIVITY
// ============================================================================

export interface FriendActivity {
  id: string;
  user_id: string;
  friend_name: string;
  friend_profile_picture?: string;
  activity_type: FriendActivityType;
  event_title?: string;
  event_category?: string;
  event_location?: {
    latitude: number;
    longitude: number;
  };
  event_address?: string;
  event_time?: string;
  created_at: string;
}

// ============================================================================
// FEATURED ITEM
// ============================================================================

export interface FeaturedItem {
  id: string;
  type: 'venue' | 'movie' | 'event' | 'recommendation';
  title: string;
  subtitle?: string;
  description?: string;
  image_url?: string;
  category?: string;
  action_text?: string;
  action_link?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// USER SESSION
// ============================================================================

export interface UserSession {
  id: string;
  user_id: string;
  last_dashboard_view?: string;
  dashboard_views_count: number;
  session_date: string;
  first_load_today: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DASHBOARD VIEW STATE
// ============================================================================

export type DashboardView = 'stats' | 'map';

export interface DashboardState {
  isVisible: boolean;
  currentView: DashboardView;
  isFirstLoadToday: boolean;
  hasUnreadNotifications: boolean;
  notificationCount: number;
}

// ============================================================================
// TASK LOCATION (for Loop Map)
// ============================================================================

export interface TaskLocation {
  id: string;
  title: string;
  category: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  start_time: string;
  end_time: string;
  order?: number; // Order in the day's sequence
}

// ============================================================================
// DASHBOARD AGGREGATED DATA (response from backend)
// ============================================================================

export interface DashboardData {
  stats: DashboardStats;
  notifications: DashboardNotification[];
  today_tasks: TaskLocation[];
  home_location?: {
    latitude: number;
    longitude: number;
  };
  should_show_first_load: boolean;
}
