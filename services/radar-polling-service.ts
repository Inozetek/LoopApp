/**
 * Radar Polling Service — Batch Event Matching
 *
 * Architecture: Query once per entity, serve many users.
 * - Deduplicates queries across all users following the same entity
 * - Uses event_cache table with event-date TTL (NOT 24-hour TTL)
 * - Batch queries by city for Ticketmaster (1 call = hundreds of events)
 * - Diffs new vs. cached events to only notify about NEW announcements
 *
 * Cost at 10K users: ~$0/month (well within Ticketmaster free tier)
 */

import { supabase } from '@/lib/supabase';
import type { UserHook, HookType, CachedEvent, RadarEventData, HookNotification } from '@/types/radar';
import { sendRadarPushNotification } from '@/services/radar-push-service';
import type { SubscriptionTier } from '@/types/subscription';

// ============================================================================
// CONSTANTS
// ============================================================================

const TICKETMASTER_API_KEY = process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY;
const TICKETMASTER_BASE = 'https://app.ticketmaster.com/discovery/v2';

/** Max events to return from a single Ticketmaster query */
const TM_PAGE_SIZE = 50;

/** Default city for queries when user's city is unknown */
const DEFAULT_CITY = 'Dallas';

/** How far ahead to search for events (90 days) */
const SEARCH_WINDOW_DAYS = 90;

/** Rate limiter: 5 requests per second for Ticketmaster */
const MIN_REQUEST_INTERVAL_MS = 220; // slightly over 200ms for safety
let lastRequestTime = 0;

// ============================================================================
// RATE LIMITER
// ============================================================================

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
  return fetch(url);
}

// ============================================================================
// EVENT CACHE
// ============================================================================

/**
 * Check the event cache for a given entity.
 * Returns cached events if still valid, null if stale/missing.
 */
export async function getCachedEvents(cacheKey: string): Promise<CachedEvent[] | null> {
  try {
    const { data, error } = await supabase
      .from('event_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .single();

    if (error || !data) return null;

    // Check if cache is still valid
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null; // Expired
    }

    return data.events as CachedEvent[];
  } catch {
    return null;
  }
}

/**
 * Update the event cache for a given entity.
 * Sets expires_at to the latest event date + 1 day.
 */
export async function updateEventCache(
  cacheKey: string,
  source: string,
  entityType: string,
  entityName: string,
  events: CachedEvent[],
  city?: string
): Promise<void> {
  // Calculate expires_at from latest event date
  let expiresAt: string | null = null;
  if (events.length > 0) {
    const latestDate = events
      .map(e => new Date(e.date))
      .reduce((a, b) => (a > b ? a : b));
    const expiry = new Date(latestDate);
    expiry.setDate(expiry.getDate() + 1);
    expiresAt = expiry.toISOString();
  } else {
    // No events found — re-check in 7 days
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    expiresAt = expiry.toISOString();
  }

  // Weekly re-check for new announcements
  const nextFetch = new Date();
  nextFetch.setDate(nextFetch.getDate() + 7);

  try {
    await supabase
      .from('event_cache')
      .upsert(
        {
          cache_key: cacheKey,
          source,
          entity_type: entityType,
          entity_name: entityName,
          events,
          location_city: city || DEFAULT_CITY,
          last_fetched_at: new Date().toISOString(),
          next_fetch_at: nextFetch.toISOString(),
          expires_at: expiresAt,
        },
        { onConflict: 'cache_key' }
      );
  } catch (err) {
    console.error('[RadarPolling] Error updating event cache:', err);
  }
}

// ============================================================================
// TICKETMASTER QUERIES
// ============================================================================

/**
 * Search Ticketmaster for events by keyword near a city.
 * Used for artist radars.
 */
export async function searchTicketmasterByKeyword(
  keyword: string,
  city: string = DEFAULT_CITY,
  stateCode: string = 'TX'
): Promise<CachedEvent[]> {
  if (!TICKETMASTER_API_KEY) {
    console.warn('[RadarPolling] No Ticketmaster API key — skipping search');
    return [];
  }

  const startDate = new Date().toISOString().split('.')[0] + 'Z';
  const endDate = new Date(Date.now() + SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('.')[0] + 'Z';

  const params = new URLSearchParams({
    apikey: TICKETMASTER_API_KEY,
    keyword,
    city,
    stateCode,
    startDateTime: startDate,
    endDateTime: endDate,
    size: String(TM_PAGE_SIZE),
    sort: 'date,asc',
  });

  const url = `${TICKETMASTER_BASE}/events.json?${params}`;

  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) {
      console.error('[RadarPolling] Ticketmaster search failed:', response.status);
      return [];
    }

    const json = await response.json();
    const events = json?._embedded?.events || [];

    return events.map(transformTicketmasterEvent).filter(Boolean) as CachedEvent[];
  } catch (err) {
    console.error('[RadarPolling] Ticketmaster search error:', err);
    return [];
  }
}

/**
 * Search Ticketmaster for events at a specific venue.
 * Used for venue radars.
 */
export async function searchTicketmasterByVenue(
  venueName: string,
  city: string = DEFAULT_CITY,
  stateCode: string = 'TX'
): Promise<CachedEvent[]> {
  if (!TICKETMASTER_API_KEY) return [];

  const startDate = new Date().toISOString().split('.')[0] + 'Z';

  const params = new URLSearchParams({
    apikey: TICKETMASTER_API_KEY,
    keyword: venueName,
    city,
    stateCode,
    startDateTime: startDate,
    size: String(TM_PAGE_SIZE),
    sort: 'date,asc',
  });

  const url = `${TICKETMASTER_BASE}/events.json?${params}`;

  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) return [];
    const json = await response.json();
    const events = json?._embedded?.events || [];
    return events.map(transformTicketmasterEvent).filter(Boolean) as CachedEvent[];
  } catch {
    return [];
  }
}

/**
 * Search Ticketmaster for events by category classification.
 * Used for category radars.
 */
export async function searchTicketmasterByCategory(
  classificationName: string,
  city: string = DEFAULT_CITY,
  stateCode: string = 'TX'
): Promise<CachedEvent[]> {
  if (!TICKETMASTER_API_KEY) return [];

  const startDate = new Date().toISOString().split('.')[0] + 'Z';

  const params = new URLSearchParams({
    apikey: TICKETMASTER_API_KEY,
    classificationName,
    city,
    stateCode,
    startDateTime: startDate,
    size: String(TM_PAGE_SIZE),
    sort: 'date,asc',
  });

  const url = `${TICKETMASTER_BASE}/events.json?${params}`;

  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) return [];
    const json = await response.json();
    const events = json?._embedded?.events || [];
    return events.map(transformTicketmasterEvent).filter(Boolean) as CachedEvent[];
  } catch {
    return [];
  }
}

// ============================================================================
// TRANSFORM HELPERS
// ============================================================================

function transformTicketmasterEvent(event: any): CachedEvent | null {
  try {
    const venue = event._embedded?.venues?.[0];
    const priceRanges = event.priceRanges?.[0];
    const images = event.images || [];

    // Pick best image (prefer 16:9, high res)
    const bestImage = images
      .filter((img: any) => img.width >= 600)
      .sort((a: any, b: any) => {
        const ratioA = Math.abs((a.width / a.height) - 1.78);
        const ratioB = Math.abs((b.width / b.height) - 1.78);
        return ratioA - ratioB;
      })[0] || images[0];

    return {
      id: event.id,
      name: event.name,
      venue: venue?.name,
      address: venue ? `${venue.address?.line1 || ''}, ${venue.city?.name || ''}, ${venue.state?.stateCode || ''}`.trim() : undefined,
      city: venue?.city?.name,
      date: event.dates?.start?.localDate || '',
      time: event.dates?.start?.localTime || undefined,
      imageUrl: bestImage?.url,
      priceMin: priceRanges?.min,
      priceMax: priceRanges?.max,
      currency: priceRanges?.currency || 'USD',
      ticketUrl: event.url,
      source: 'ticketmaster',
      category: event.classifications?.[0]?.segment?.name?.toLowerCase(),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// HOOK MATCHING
// ============================================================================

/** Map Loop interest categories to Ticketmaster classification names */
const CATEGORY_TO_TM_CLASSIFICATION: Record<string, string> = {
  live_music: 'Music',
  music: 'Music',
  concerts: 'Music',
  sports: 'Sports',
  arts: 'Arts & Theatre',
  theater: 'Arts & Theatre',
  comedy: 'Arts & Theatre',
  entertainment: 'Miscellaneous',
  family: 'Family',
  nightlife: 'Music',
  events: 'Miscellaneous',
};

/**
 * Match a single radar hook against the event cache.
 * Returns new events that the user hasn't been notified about yet.
 */
export async function matchHookToEvents(hook: UserHook): Promise<CachedEvent[]> {
  const city = DEFAULT_CITY; // TODO: use user's city from profile

  let cacheKey: string;
  let fetchFn: () => Promise<CachedEvent[]>;

  switch (hook.hookType) {
    case 'artist':
    case 'film_talent': {
      const name = hook.entityName || '';
      cacheKey = `artist:${name.toLowerCase().replace(/\s+/g, '_')}:${city.toLowerCase()}`;
      fetchFn = () => searchTicketmasterByKeyword(name, city);
      break;
    }
    case 'category': {
      const cat = hook.category || hook.entityName || '';
      const tmClass = CATEGORY_TO_TM_CLASSIFICATION[cat] || cat;
      cacheKey = `category:${tmClass.toLowerCase()}:${city.toLowerCase()}`;
      fetchFn = () => searchTicketmasterByCategory(tmClass, city);
      break;
    }
    case 'venue': {
      const venue = hook.entityName || '';
      cacheKey = `venue:${venue.toLowerCase().replace(/\s+/g, '_')}:${city.toLowerCase()}`;
      fetchFn = () => searchTicketmasterByVenue(venue, city);
      break;
    }
    default:
      return [];
  }

  // Check cache first
  let events = await getCachedEvents(cacheKey);

  if (!events) {
    // Cache miss or stale — fetch fresh data
    events = await fetchFn();
    await updateEventCache(
      cacheKey,
      'ticketmaster',
      hook.hookType,
      hook.entityName || hook.category || '',
      events,
      city
    );
  }

  return events;
}

/**
 * Convert a CachedEvent to RadarEventData for notification/card rendering.
 */
export function cachedEventToRadarEventData(event: CachedEvent): RadarEventData {
  return {
    name: event.name,
    venue: event.venue,
    address: event.address,
    date: event.date,
    time: event.time,
    imageUrl: event.imageUrl,
    priceMin: event.priceMin,
    priceMax: event.priceMax,
    currency: event.currency,
    ticketUrl: event.ticketUrl,
    category: event.category,
    source: event.source,
  };
}

// ============================================================================
// BATCH POLLING (for server-side cron job)
// ============================================================================

/**
 * Process all active radar hooks for a given user.
 * Matches hooks against cached/fresh event data and creates notifications.
 *
 * This would typically run as a server-side cron job, but for MVP we run it
 * client-side when the user opens the app (lazy polling).
 */
export async function pollRadarsForUser(userId: string, tier: SubscriptionTier = 'free'): Promise<number> {
  try {
    const { data: hooks, error } = await supabase
      .from('user_hooks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .neq('hook_type', 'proximity'); // Proximity is handled differently

    if (error || !hooks || hooks.length === 0) return 0;

    let newNotifications = 0;

    for (const hookRow of hooks) {
      const hook: UserHook = {
        id: hookRow.id,
        userId: hookRow.user_id,
        hookType: hookRow.hook_type,
        entityName: hookRow.entity_name,
        entityId: hookRow.entity_id,
        category: hookRow.category,
        isActive: hookRow.is_active,
        triggerCount: hookRow.trigger_count || 0,
        createdAt: hookRow.created_at,
        updatedAt: hookRow.updated_at,
      };

      const events = await matchHookToEvents(hook);
      if (events.length === 0) continue;

      // Check for already-notified events
      const { data: existingNotifs } = await supabase
        .from('hook_notifications')
        .select('event_data')
        .eq('hook_id', hook.id)
        .eq('user_id', userId);

      const notifiedEventIds = new Set(
        (existingNotifs || [])
          .map((n: any) => n.event_data?.name)
          .filter(Boolean)
      );

      // Create notifications for new events only
      for (const event of events.slice(0, 3)) {
        if (notifiedEventIds.has(event.name)) continue;

        const eventData = cachedEventToRadarEventData(event);
        const priceText = event.priceMin
          ? `From $${event.priceMin}`
          : 'Free';

        const { data: insertedNotif } = await supabase.from('hook_notifications').insert({
          user_id: userId,
          hook_id: hook.id,
          title: event.name,
          body: `${event.venue || 'TBD'}, ${event.date} - ${priceText}`,
          event_data: eventData,
          status: 'pending',
          expires_at: new Date(new Date(event.date).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        }).select().single();

        // Send push notification for Plus users
        if (insertedNotif) {
          const notification: HookNotification = {
            id: insertedNotif.id,
            userId,
            hookId: hook.id,
            title: event.name,
            body: `${event.venue || 'TBD'}, ${event.date} - ${priceText}`,
            eventData,
            status: 'pending',
            createdAt: insertedNotif.created_at,
          };
          await sendRadarPushNotification(notification, tier);
        }

        newNotifications++;
      }

      // Update hook trigger count
      if (newNotifications > 0) {
        await supabase
          .from('user_hooks')
          .update({
            last_triggered_at: new Date().toISOString(),
            trigger_count: hook.triggerCount + newNotifications,
          })
          .eq('id', hook.id);
      }
    }

    return newNotifications;
  } catch (err) {
    console.error('[RadarPolling] Error polling radars:', err);
    return 0;
  }
}
