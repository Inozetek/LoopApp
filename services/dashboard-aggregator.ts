/**
 * Dashboard Aggregator Service
 * Fetches and compiles all data needed for the Daily Dashboard
 */

import { supabase } from '@/lib/supabase';
import type {
  DashboardData,
  DashboardStats,
  DashboardNotification,
  TaskLocation,
  FriendActivity,
  FeaturedItem,
} from '@/types/dashboard';

/**
 * Fetch complete dashboard data for a user
 * Includes stats, notifications, today's tasks, and featured items
 */
export async function fetchDashboardData(userId: string): Promise<DashboardData> {
  try {
    console.log('📊 Fetching dashboard data for user:', userId);

    // Check if this is demo mode (mock user ID)
    const isDemoUser = userId === '00000000-0000-0000-0000-000000000001';

    if (isDemoUser) {
      console.log('🎭 Demo mode detected - using mock dashboard data');
      // Return empty but valid dashboard data for demo
      return {
        stats: {
          loops_planned_count: 0,
          friends_active_count: 0,
          new_recommendations_count: 0,
          pending_invites_count: 0,
        },
        notifications: [],
        today_tasks: [],
        home_location: undefined,
        should_show_first_load: true,
      };
    }

    // Validate user exists in database first
    const { data: userExists, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userExists) {
      console.warn(`⚠️ User ${userId} not found in database - returning empty dashboard data`);
      return {
        stats: {
          loops_planned_count: 0,
          friends_active_count: 0,
          new_recommendations_count: 0,
          pending_invites_count: 0,
        },
        notifications: [],
        today_tasks: [],
        home_location: undefined,
        should_show_first_load: true,
      };
    }

    // Parallel fetch for performance
    const [
      statsResult,
      notificationsResult,
      todayTasksResult,
      homeLocationResult,
      shouldShowResult,
    ] = await Promise.all([
      fetchDashboardStats(userId),
      fetchDashboardNotifications(userId),
      fetchTodayTasks(userId),
      fetchHomeLocation(userId),
      shouldShowFirstLoad(userId),
    ]);

    const dashboardData: DashboardData = {
      stats: statsResult,
      notifications: notificationsResult,
      today_tasks: todayTasksResult,
      home_location: homeLocationResult,
      should_show_first_load: shouldShowResult,
    };

    console.log('✅ Dashboard data fetched:', {
      stats: statsResult,
      notificationCount: notificationsResult.length,
      taskCount: todayTasksResult.length,
      shouldShow: shouldShowResult,
    });

    return dashboardData;
  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
    throw error;
  }
}

/**
 * Fetch dashboard stats (loops planned, friends active, etc.)
 */
async function fetchDashboardStats(userId: string): Promise<DashboardStats> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Count today's loops (calendar events)
    const { count: loopsCount } = await supabase
      .from('calendar_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString());

    // 2. Fetch today's events summary
    const { data: todayEvents } = await supabase
      .from('calendar_events')
      .select('start_time, end_time, category')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString())
      .order('start_time', { ascending: true });

    // 3. Count friends' active loops (respect privacy settings)
    const friendsActivity = await fetchFriendsActivity(userId);

    // 4. Count new recommendations (from last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { count: recommendationsCount } = await supabase
      .from('recommendations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('created_at', yesterday.toISOString());

    // 5. Count pending group invites
    const { count: pendingInvitesCount } = await supabase
      .from('plan_participants')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('rsvp_status', 'invited');

    // Build stats object
    const stats: DashboardStats = {
      loops_planned_count: loopsCount || 0,
      friends_active_count: friendsActivity.length,
      new_recommendations_count: recommendationsCount || 0,
      pending_invites_count: pendingInvitesCount || 0,
      loops_summary: todayEvents && todayEvents.length > 0 ? {
        first_event_time: todayEvents[0]?.start_time,
        last_event_time: todayEvents[todayEvents.length - 1]?.end_time,
        total_stops: todayEvents.length,
        categories: [...new Set(todayEvents.map((e: any) => e.category))],
      } : undefined,
      friends_activity: friendsActivity,
      featured_items: await fetchFeaturedItems(userId),
    };

    return stats;
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    // Return empty stats on error
    return {
      loops_planned_count: 0,
      friends_active_count: 0,
      new_recommendations_count: 0,
      pending_invites_count: 0,
    };
  }
}

/**
 * Fetch friends' activity (respecting privacy settings)
 */
async function fetchFriendsActivity(userId: string): Promise<FriendActivity[]> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch friends' public activity from today
    const { data: activities, error } = await supabase
      .from('friend_activity_log')
      .select(`
        id,
        user_id,
        activity_type,
        event_title,
        event_category,
        event_time,
        created_at,
        users!inner(name, profile_picture_url)
      `)
      .gte('created_at', today.toISOString())
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      // PGRST205 = table not found (migration not run yet)
      if (error.code === 'PGRST204' || error.code === 'PGRST205') {
        console.warn('⚠️ Friend activity log table not found - migration may not be run');
        return [];
      }
      throw error;
    }

    // Check if these users are friends with current user
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id, user_id')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted');

    if (!friendships) return [];

    const friendIds = new Set(
      friendships.map((f: any) => f.user_id === userId ? f.friend_id : f.user_id)
    );

    // Filter activities to only friends
    const friendActivities: FriendActivity[] = (activities || [])
      .filter((a: any) => friendIds.has(a.user_id))
      .map((a: any) => ({
        id: a.id,
        user_id: a.user_id,
        friend_name: a.users.name,
        friend_profile_picture: a.users.profile_picture_url,
        activity_type: a.activity_type,
        event_title: a.event_title,
        event_category: a.event_category,
        event_time: a.event_time,
        created_at: a.created_at,
      }));

    return friendActivities;
  } catch (error) {
    console.error('❌ Error fetching friends activity:', error);
    return [];
  }
}

/**
 * Fetch featured items (venues, movies, events)
 */
async function fetchFeaturedItems(userId: string): Promise<FeaturedItem[]> {
  try {
    // TODO: Implement logic to find featured items
    // For now, return empty array
    // Future: Query new venues, upcoming movies, trending events
    return [];
  } catch (error) {
    console.error('❌ Error fetching featured items:', error);
    return [];
  }
}

/**
 * Fetch dashboard notifications
 */
async function fetchDashboardNotifications(userId: string): Promise<DashboardNotification[]> {
  try {
    const { data, error } = await supabase
      .from('dashboard_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_dismissed', false)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      // PGRST205 = table not found (migration not run yet)
      if (error.code === 'PGRST204' || error.code === 'PGRST205') {
        console.warn('⚠️ Dashboard notifications table not found - migration may not be run');
        return [];
      }
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error fetching dashboard notifications:', error);
    return [];
  }
}

/**
 * Fetch today's tasks for Loop map
 */
async function fetchTodayTasks(userId: string): Promise<TaskLocation[]> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from('calendar_events')
      .select('id, title, category, location, address, start_time, end_time')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString())
      .order('start_time', { ascending: true });

    if (error) throw error;

    // Filter out events without location data and map to TaskLocation
    const tasks: TaskLocation[] = (data || [])
      .filter((event: any) => event.location && event.location.coordinates)
      .map((event: any, index: number) => ({
        id: event.id,
        title: event.title,
        category: event.category,
        location: {
          latitude: event.location.coordinates[1],
          longitude: event.location.coordinates[0],
        },
        address: event.address,
        start_time: event.start_time,
        end_time: event.end_time,
        order: index + 1,
      }));

    return tasks;
  } catch (error) {
    console.error('❌ Error fetching today tasks:', error);
    return [];
  }
}

/**
 * Fetch user's home location
 */
async function fetchHomeLocation(userId: string): Promise<{ latitude: number; longitude: number } | undefined> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('home_location')
      .eq('id', userId)
      .single();

    if (error) {
      // PGRST116 = 0 rows returned (user doesn't have home location set)
      if (error.code === 'PGRST116') {
        console.warn('⚠️ No home location set for user');
        return undefined;
      }
      throw error;
    }

    if (data?.home_location?.coordinates) {
      return {
        latitude: data.home_location.coordinates[1],
        longitude: data.home_location.coordinates[0],
      };
    }

    return undefined;
  } catch (error) {
    console.error('❌ Error fetching home location:', error);
    return undefined;
  }
}

/**
 * Check if user should see first-load dashboard today
 */
async function shouldShowFirstLoad(userId: string): Promise<boolean> {
  try {
    // Call PostgreSQL function
    const { data, error } = await supabase.rpc('should_show_dashboard_today', {
      p_user_id: userId,
    });

    if (error) {
      // PGRST202 = function not found (migration not run yet)
      if (error.code === 'PGRST202') {
        console.warn('⚠️ Dashboard function not found - using AsyncStorage fallback');
        // Fallback to AsyncStorage-only logic (handled in utils/dashboard-tracker.ts)
        return true; // Default to showing on first load
      }
      console.error('❌ Error checking first load:', error);
      return true;
    }

    return data === true;
  } catch (error) {
    console.error('❌ Error in shouldShowFirstLoad:', error);
    return true;
  }
}

/**
 * Mark dashboard as viewed (update session tracking)
 */
export async function markDashboardViewed(userId: string): Promise<void> {
  try {
    // Skip database tracking for demo user
    if (userId === '00000000-0000-0000-0000-000000000001') {
      console.log('🎭 Demo mode - skipping dashboard tracking');
      return;
    }

    const { error } = await supabase.rpc('mark_dashboard_viewed', {
      p_user_id: userId,
    });

    if (error) {
      // PGRST202 = function not found (migration not run yet)
      if (error.code === 'PGRST202') {
        console.warn('⚠️ Dashboard function not found - skipping database update');
        return;
      }
      // 23503 = foreign key violation (user doesn't exist in users table)
      if (error.code === '23503') {
        console.warn(`⚠️ User ${userId} not found in database - skipping dashboard tracking`);
        return;
      }
      throw error;
    }

    console.log('✅ Dashboard marked as viewed');
  } catch (error: any) {
    // Don't crash app for tracking errors
    console.warn('⚠️ Could not mark dashboard viewed (non-critical):', error?.message || error);
  }
}

/**
 * Dismiss a dashboard notification
 */
export async function dismissNotification(notificationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('dashboard_notifications')
      .update({
        is_dismissed: true,
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    if (error) {
      // PGRST205 = table not found (migration not run yet)
      if (error.code === 'PGRST204' || error.code === 'PGRST205') {
        console.warn('⚠️ Dashboard notifications table not found - skipping');
        return;
      }
      throw error;
    }

    console.log('✅ Notification dismissed');
  } catch (error) {
    console.error('❌ Error dismissing notification:', error);
    throw error;
  }
}

/**
 * Mark notification as actioned (user clicked action button)
 */
export async function markNotificationActioned(notificationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('dashboard_notifications')
      .update({
        is_actioned: true,
        actioned_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    if (error) {
      // PGRST205 = table not found (migration not run yet)
      if (error.code === 'PGRST204' || error.code === 'PGRST205') {
        console.warn('⚠️ Dashboard notifications table not found - skipping');
        return;
      }
      throw error;
    }

    console.log('✅ Notification marked as actioned');
  } catch (error) {
    console.error('❌ Error marking notification actioned:', error);
    throw error;
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('dashboard_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .eq('is_dismissed', false);

    if (error) {
      // PGRST205 = table not found (migration not run yet)
      if (error.code === 'PGRST204' || error.code === 'PGRST205') {
        console.warn('⚠️ Dashboard notifications table not found - returning 0');
        return 0;
      }
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    return 0;
  }
}
