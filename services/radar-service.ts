/**
 * Radar Service — CRUD for user hooks (radars)
 *
 * Follows the likes-service.ts pattern: Supabase CRUD with demo mode fallback.
 *
 * Responsibilities:
 * - Create, delete, list, toggle radars
 * - Enforce tier limits (free: 3 total, plus: unlimited)
 * - Fetch pending radar notifications for feed injection
 * - Mark notifications as viewed/dismissed
 */

import { supabase } from '@/lib/supabase';
import {
  UserHook,
  HookType,
  HookNotification,
  RadarMatch,
  RadarSummary,
  CreateRadarParams,
  RADAR_LIMITS,
  HOOK_TYPE_META,
  RadarEventData,
} from '@/types/radar';
import type { SubscriptionTier } from '@/types/subscription';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEMO_USER_ID = 'demo-user-123';

/** Max radar alert cards injected into the feed per session */
export const MAX_RADAR_CARDS_PER_SESSION = 3;

// ============================================================================
// TIER LIMIT CHECKING
// ============================================================================

export interface RadarLimitCheck {
  canCreate: boolean;
  reason?: string;
  currentCount: number;
  maxAllowed: number;
  upgradeRequired: boolean;
}

/**
 * Check if the user can create a new radar of the given type.
 * Returns whether creation is allowed and the reason if not.
 */
export async function checkRadarLimit(
  userId: string,
  hookType: HookType,
  tier: SubscriptionTier
): Promise<RadarLimitCheck> {
  if (userId === DEMO_USER_ID) {
    return { canCreate: true, currentCount: 1, maxAllowed: 99, upgradeRequired: false };
  }

  const limits = RADAR_LIMITS[tier];
  const radars = await listRadars(userId);
  const activeRadars = radars.filter(r => r.isActive);

  // Check total limit
  if (activeRadars.length >= limits.total) {
    return {
      canCreate: false,
      reason: `You've reached the maximum of ${limits.total} radars. Upgrade to Loop Plus for unlimited.`,
      currentCount: activeRadars.length,
      maxAllowed: limits.total,
      upgradeRequired: true,
    };
  }

  // Check type-specific limits
  if (hookType === 'artist' || hookType === 'film_talent') {
    const typeCount = activeRadars.filter(r => r.hookType === 'artist' || r.hookType === 'film_talent').length;
    if (typeCount >= limits.artistOrFilm) {
      return {
        canCreate: false,
        reason: tier === 'free'
          ? 'Free users can create 1 artist/film radar. Upgrade for unlimited.'
          : undefined,
        currentCount: typeCount,
        maxAllowed: limits.artistOrFilm,
        upgradeRequired: tier === 'free',
      };
    }
  }

  if (hookType === 'category') {
    const typeCount = activeRadars.filter(r => r.hookType === 'category').length;
    if (typeCount >= limits.category) {
      return {
        canCreate: false,
        reason: tier === 'free'
          ? 'Free users can create 2 category radars. Upgrade for unlimited.'
          : undefined,
        currentCount: typeCount,
        maxAllowed: limits.category,
        upgradeRequired: tier === 'free',
      };
    }
  }

  if (hookType === 'venue' && limits.venue === 0) {
    return {
      canCreate: false,
      reason: 'Venue radars are a Loop Plus feature.',
      currentCount: 0,
      maxAllowed: 0,
      upgradeRequired: true,
    };
  }

  if (hookType === 'proximity' && limits.proximity === 0) {
    return {
      canCreate: false,
      reason: 'Friend proximity radars are a Loop Plus feature.',
      currentCount: 0,
      maxAllowed: 0,
      upgradeRequired: true,
    };
  }

  if (hookType === 'proximity') {
    const typeCount = activeRadars.filter(r => r.hookType === 'proximity').length;
    if (typeCount >= limits.proximity) {
      return {
        canCreate: false,
        reason: `You can track up to ${limits.proximity} friends with proximity radars.`,
        currentCount: typeCount,
        maxAllowed: limits.proximity,
        upgradeRequired: false,
      };
    }
  }

  return {
    canCreate: true,
    currentCount: activeRadars.length,
    maxAllowed: limits.total,
    upgradeRequired: false,
  };
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new radar (hook).
 * Enforces tier limits before creating.
 */
export async function createRadar(
  params: CreateRadarParams,
  tier: SubscriptionTier
): Promise<{ success: boolean; radar?: UserHook; error?: string }> {
  const { userId, hookType } = params;

  // Demo mode
  if (userId === DEMO_USER_ID) {
    return {
      success: true,
      radar: createMockRadar(params),
    };
  }

  // Check limits
  const limitCheck = await checkRadarLimit(userId, hookType, tier);
  if (!limitCheck.canCreate) {
    return { success: false, error: limitCheck.reason };
  }

  try {
    const { data, error } = await supabase
      .from('user_hooks')
      .insert({
        user_id: userId,
        hook_type: hookType,
        entity_name: params.entityName || null,
        entity_id: params.entityId || null,
        talent_department: params.talentDepartment || null,
        category: params.category || null,
        custom_keywords: params.customKeywords || null,
        friend_ids: params.friendIds || null,
        proximity_radius_miles: params.proximityRadiusMiles || 1.0,
        is_active: true,
        trigger_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('[RadarService] Error creating radar:', error);
      return { success: false, error: 'Failed to create radar. Please try again.' };
    }

    return { success: true, radar: mapDbRowToHook(data) };
  } catch (err) {
    console.error('[RadarService] Exception creating radar:', err);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

/**
 * Toggle a radar's active state.
 */
export async function toggleRadar(userId: string, radarId: string, isActive: boolean): Promise<boolean> {
  if (userId === DEMO_USER_ID) return true;

  try {
    const { error } = await supabase
      .from('user_hooks')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', radarId)
      .eq('user_id', userId);

    if (error) {
      console.error('[RadarService] Error toggling radar:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[RadarService] Exception toggling radar:', err);
    return false;
  }
}

/**
 * Delete (deactivate) a radar.
 */
export async function deleteRadar(userId: string, radarId: string): Promise<boolean> {
  if (userId === DEMO_USER_ID) return true;

  try {
    const { error } = await supabase
      .from('user_hooks')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', radarId)
      .eq('user_id', userId);

    if (error) {
      console.error('[RadarService] Error deleting radar:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[RadarService] Exception deleting radar:', err);
    return false;
  }
}

/**
 * Permanently remove a radar from the database.
 */
export async function hardDeleteRadar(userId: string, radarId: string): Promise<boolean> {
  if (userId === DEMO_USER_ID) return true;

  try {
    const { error } = await supabase
      .from('user_hooks')
      .delete()
      .eq('id', radarId)
      .eq('user_id', userId);

    if (error) {
      console.error('[RadarService] Error hard-deleting radar:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[RadarService] Exception hard-deleting radar:', err);
    return false;
  }
}

/**
 * List all active radars for a user.
 */
export async function listRadars(userId: string): Promise<UserHook[]> {
  if (userId === DEMO_USER_ID) {
    return getMockRadars();
  }

  try {
    const { data, error } = await supabase
      .from('user_hooks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      // Table may not exist yet — return empty gracefully
      if (error.code === '42P01') return [];
      console.error('[RadarService] Error listing radars:', error);
      return [];
    }

    return (data || []).map(mapDbRowToHook);
  } catch (err) {
    console.error('[RadarService] Exception listing radars:', err);
    return [];
  }
}

/**
 * List all radars for a user (including inactive/toggled-off).
 * Used by the radar management screen.
 */
export async function listAllRadars(userId: string): Promise<UserHook[]> {
  if (userId === DEMO_USER_ID) {
    return getMockRadars();
  }

  try {
    const { data, error } = await supabase
      .from('user_hooks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') return [];
      console.error('[RadarService] Error listing all radars:', error);
      return [];
    }

    return (data || []).map(mapDbRowToHook);
  } catch (err) {
    console.error('[RadarService] Exception listing all radars:', err);
    return [];
  }
}

/**
 * Get a radar summary for the management screen.
 */
export async function getRadarSummary(userId: string, tier: SubscriptionTier): Promise<RadarSummary> {
  const radars = await listRadars(userId);
  const limits = RADAR_LIMITS[tier];

  const byType: Record<HookType, number> = {
    artist: 0,
    film_talent: 0,
    category: 0,
    venue: 0,
    proximity: 0,
  };

  for (const radar of radars) {
    byType[radar.hookType]++;
  }

  const recentAlerts = await getRecentNotifications(userId, 10);

  return {
    activeCount: radars.length,
    byType,
    limits,
    recentAlerts,
  };
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Get pending (unviewed) radar notifications for feed injection.
 * Returns up to MAX_RADAR_CARDS_PER_SESSION notifications.
 */
export async function getPendingRadarAlerts(userId: string): Promise<HookNotification[]> {
  if (userId === DEMO_USER_ID) {
    return getMockNotifications();
  }

  try {
    const { data, error } = await supabase
      .from('hook_notifications')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'sent'])
      .order('created_at', { ascending: false })
      .limit(MAX_RADAR_CARDS_PER_SESSION);

    if (error) {
      if (error.code === '42P01') return [];
      console.error('[RadarService] Error fetching radar alerts:', error);
      return [];
    }

    return (data || []).map(mapDbRowToNotification);
  } catch (err) {
    console.error('[RadarService] Exception fetching radar alerts:', err);
    return [];
  }
}

/**
 * Get recent notifications (for radar history in management screen).
 */
export async function getRecentNotifications(userId: string, limit: number = 10): Promise<HookNotification[]> {
  if (userId === DEMO_USER_ID) {
    return getMockNotifications();
  }

  try {
    const { data, error } = await supabase
      .from('hook_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (error.code === '42P01') return [];
      console.error('[RadarService] Error fetching recent notifications:', error);
      return [];
    }

    return (data || []).map(mapDbRowToNotification);
  } catch (err) {
    console.error('[RadarService] Exception fetching recent notifications:', err);
    return [];
  }
}

/**
 * Get full notification history with filtering and pagination.
 * Respects tier-based date limits (free: 7 days, plus: unlimited).
 */
export async function getNotificationHistory(
  userId: string,
  filters?: {
    hookType?: HookType;
    limit?: number;
    offset?: number;
  },
  tier: SubscriptionTier = 'free'
): Promise<HookNotification[]> {
  if (userId === DEMO_USER_ID) {
    return getMockNotifications();
  }

  const limits = RADAR_LIMITS[tier];
  const queryLimit = filters?.limit || 50;
  const queryOffset = filters?.offset || 0;

  try {
    let query = supabase
      .from('hook_notifications')
      .select('*, user_hooks!inner(hook_type)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(queryOffset, queryOffset + queryLimit - 1);

    // Apply hook type filter via join
    if (filters?.hookType) {
      query = query.eq('user_hooks.hook_type', filters.hookType);
    }

    // Apply tier-based date limit
    if (limits.historyDays !== Infinity) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - limits.historyDays);
      query = query.gte('created_at', cutoff.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      // Fallback to non-join query if user_hooks table doesn't exist
      if (error.code === '42P01' || error.message?.includes('user_hooks')) {
        return getRecentNotifications(userId, queryLimit);
      }
      console.error('[RadarService] Error fetching notification history:', error);
      return [];
    }

    return (data || []).map(mapDbRowToNotification);
  } catch (err) {
    console.error('[RadarService] Exception fetching notification history:', err);
    return [];
  }
}

/**
 * Mark a radar notification as viewed.
 */
export async function markNotificationViewed(userId: string, notificationId: string): Promise<void> {
  if (userId === DEMO_USER_ID) return;

  try {
    await supabase
      .from('hook_notifications')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);
  } catch (err) {
    console.error('[RadarService] Error marking notification viewed:', err);
  }
}

/**
 * Mark a radar notification as dismissed.
 */
export async function markNotificationDismissed(userId: string, notificationId: string): Promise<void> {
  if (userId === DEMO_USER_ID) return;

  try {
    await supabase
      .from('hook_notifications')
      .update({ status: 'dismissed' })
      .eq('id', notificationId)
      .eq('user_id', userId);
  } catch (err) {
    console.error('[RadarService] Error marking notification dismissed:', err);
  }
}

// ============================================================================
// FEED HELPERS
// ============================================================================

/**
 * Build a match reason string for a radar notification card.
 */
export function buildMatchReason(hookType: HookType, entityName?: string): string {
  const meta = HOOK_TYPE_META[hookType];
  switch (hookType) {
    case 'artist':
      return entityName ? `Matched your ${entityName} radar` : 'Matched your Artist Radar';
    case 'film_talent':
      return entityName ? `Matched your ${entityName} radar` : 'Matched your Film Radar';
    case 'category':
      return entityName ? `Matched your ${entityName} category` : 'Matched your Category Radar';
    case 'venue':
      return entityName ? `New event at ${entityName}` : 'Matched your Venue Radar';
    case 'proximity':
      return 'A friend is nearby and free';
    default:
      return `Matched your ${meta.label} Radar`;
  }
}

/**
 * Convert a HookNotification into a RadarMatch for feed card display.
 */
export function notificationToRadarMatch(
  notification: HookNotification,
  hook?: UserHook
): RadarMatch {
  return {
    hookId: notification.hookId,
    hookType: (hook?.hookType || 'category') as HookType,
    matchReason: hook
      ? buildMatchReason(hook.hookType, hook.entityName)
      : notification.title,
    notificationId: notification.id,
  };
}

// ============================================================================
// DB ROW MAPPERS
// ============================================================================

function mapDbRowToHook(row: any): UserHook {
  return {
    id: row.id,
    userId: row.user_id,
    hookType: row.hook_type as HookType,
    entityName: row.entity_name || undefined,
    entityId: row.entity_id || undefined,
    talentDepartment: row.talent_department || undefined,
    category: row.category || undefined,
    customKeywords: row.custom_keywords || undefined,
    friendIds: row.friend_ids || undefined,
    proximityRadiusMiles: row.proximity_radius_miles || 1.0,
    isActive: row.is_active,
    lastTriggeredAt: row.last_triggered_at || undefined,
    triggerCount: row.trigger_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDbRowToNotification(row: any): HookNotification {
  return {
    id: row.id,
    userId: row.user_id,
    hookId: row.hook_id,
    eventCacheId: row.event_cache_id || undefined,
    title: row.title,
    body: row.body,
    eventData: row.event_data || undefined,
    status: row.status,
    sentAt: row.sent_at || undefined,
    viewedAt: row.viewed_at || undefined,
    expiresAt: row.expires_at || undefined,
    pushSentAt: row.push_sent_at || undefined,
    createdAt: row.created_at,
  };
}

// ============================================================================
// MOCK DATA (demo mode)
// ============================================================================

function createMockRadar(params: CreateRadarParams): UserHook {
  return {
    id: `mock-radar-${Date.now()}`,
    userId: params.userId,
    hookType: params.hookType,
    entityName: params.entityName,
    entityId: params.entityId,
    talentDepartment: params.talentDepartment,
    category: params.category,
    customKeywords: params.customKeywords,
    friendIds: params.friendIds,
    proximityRadiusMiles: params.proximityRadiusMiles || 1.0,
    isActive: true,
    triggerCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getMockRadars(): UserHook[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'mock-radar-1',
      userId: DEMO_USER_ID,
      hookType: 'artist',
      entityName: 'Taylor Swift',
      entityId: 'K8vZ9171oZ7',
      isActive: true,
      lastTriggeredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      triggerCount: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mock-radar-2',
      userId: DEMO_USER_ID,
      hookType: 'category',
      entityName: 'Pop-up Shops',
      category: 'shopping',
      isActive: true,
      triggerCount: 5,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mock-radar-3',
      userId: DEMO_USER_ID,
      hookType: 'venue',
      entityName: 'Deep Ellum Brewing',
      entityId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      isActive: true,
      triggerCount: 3,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function getMockNotifications(): HookNotification[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'mock-notif-1',
      userId: DEMO_USER_ID,
      hookId: 'mock-radar-1',
      title: 'Taylor Swift - Eras Tour',
      body: 'AT&T Stadium, Mar 15 8pm - From $89',
      eventData: {
        name: 'Taylor Swift - The Eras Tour',
        venue: 'AT&T Stadium',
        address: '1 AT&T Way, Arlington, TX',
        date: '2026-03-15',
        time: '8:00 PM',
        imageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
        priceMin: 89,
        priceMax: 450,
        currency: 'USD',
        ticketUrl: 'https://www.ticketmaster.com',
        category: 'live_music',
        source: 'ticketmaster',
        distanceMiles: 12,
      },
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'mock-notif-2',
      userId: DEMO_USER_ID,
      hookId: 'mock-radar-2',
      title: 'Tacos & Tequila Pop-up',
      body: 'Deep Ellum, This Saturday - Free entry',
      eventData: {
        name: 'Tacos & Tequila Pop-up Market',
        venue: 'Deep Ellum District',
        address: 'Main St, Dallas, TX',
        date: '2026-02-21',
        time: '11:00 AM - 6:00 PM',
        imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800',
        category: 'shopping',
        source: 'meetup_rss',
        distanceMiles: 3.2,
      },
      status: 'pending',
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
