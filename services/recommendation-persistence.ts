/**
 * Recommendation Persistence Adapter
 *
 * Bridges the gap between current Google Places API generation
 * and database-backed recommendation tracking.
 *
 * Phase 1 approach:
 * - Generate recommendations using existing Google Places API flow
 * - Save to database for persistence and tracking
 * - Load from DB on subsequent visits
 * - Track status changes (viewed, accepted, declined, not_interested)
 */

import { supabase } from '@/lib/supabase';
import { Recommendation } from '@/types/activity';

export interface RecommendationRecord {
  id: string;
  user_id: string;
  // Store the full recommendation JSON for now
  recommendation_data: Recommendation;
  google_place_id: string;
  place_name: string;
  category: string;
  status: 'pending' | 'viewed' | 'accepted' | 'declined' | 'not_interested' | 'expired';
  confidence_score: number;
  viewed_at: string | null;
  responded_at: string | null;
  decline_reason?: string;
  resurfaced_count: number;
  created_at: string;
  expires_at: string;
}

/**
 * Save generated recommendations to database
 * Uses UPSERT to avoid duplicate key errors
 */
export async function saveRecommendationsToDB(
  userId: string,
  recommendations: Recommendation[]
): Promise<void> {
  if (!userId || recommendations.length === 0) return;

  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const records = recommendations.map((rec) => ({
      user_id: userId,
      recommendation_data: rec,
      google_place_id: rec.activity?.googlePlaceId || rec.id,
      place_name: rec.title,
      category: rec.category,
      status: 'pending',
      confidence_score: (rec.score || 0) / 100, // Normalize to 0-1
      last_shown_at: now.toISOString(), // Track when shown
      refresh_count: 0, // Reset count for new recommendations
      viewed_at: null,
      responded_at: null,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    }));

    // Use UPSERT to handle duplicates (insert or update if exists)
    const { error } = await supabase
      .from('recommendation_tracking')
      .upsert(records, {
        onConflict: 'user_id,google_place_id',
        ignoreDuplicates: false, // Update existing records
      });

    if (error) {
      console.error('Error saving recommendations:', error);
      // Don't throw - failing to save shouldn't break the app
    } else {
      console.log(`✅ Saved ${records.length} recommendations to database (upserted)`);
    }
  } catch (error) {
    console.error('Error in saveRecommendationsToDB:', error);
  }
}

/**
 * Load pending recommendations from database with smart resurfacing
 * Returns null if no recommendations found (trigger new generation)
 *
 * Resurfacing logic:
 * - Exclude not_interested (permanently blocked)
 * - Exclude recently shown (< 3 days for declined, < 7 days for ignored)
 * - Include recommendations older than threshold
 */
export async function loadRecommendationsFromDB(
  userId: string
): Promise<Recommendation[] | null> {
  if (!userId) return null;

  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Query for pending recommendations OR resurfaceable old ones
    // CRITICAL: Only load recommendations created in the last 24 hours to ensure freshness
    const { data, error } = await supabase
      .from('recommendation_tracking')
      .select('*')
      .eq('user_id', userId)
      // Exclude permanently blocked
      .neq('status', 'not_interested')
      // Exclude accepted (already on calendar)
      .neq('status', 'accepted')
      // Not expired
      .gte('expires_at', now.toISOString())
      // CACHE FRESHNESS: Only load recommendations created in last 24 hours
      .gte('created_at', oneDayAgo.toISOString())
      .or(
        `and(status.eq.pending),` +
        `and(status.eq.declined,last_shown_at.lt.${threeDaysAgo.toISOString()}),` +
        `and(status.in.(viewed,expired),last_shown_at.lt.${sevenDaysAgo.toISOString()})`
      )
      .order('confidence_score', { descending: true })
      .limit(10);

    if (error) {
      console.error('Error loading recommendations:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log('📭 No pending recommendations in database');
      return null;
    }

    console.log(`📥 Loaded ${data.length} recommendations from database (with resurfacing logic)`);
    console.log(`   - Excluded: not_interested, accepted, recently shown`);
    console.log(`   - Included: pending, declined (>3 days), viewed/expired (>7 days)`);

    // Extract the recommendation data
    const recommendations = data.map((record: any) => record.recommendation_data as Recommendation);

    // Check if cached recommendations have photos
    const withoutPhotos = recommendations.filter((r: any) => !r.imageUrl || r.imageUrl === '');
    if (withoutPhotos.length > 0) {
      console.log(`⚠️ ${withoutPhotos.length} cached recommendations missing photos - refresh recommended`);
      console.log(`   Tip: Pull to refresh to get fresh recommendations with photos`);
    }

    return recommendations;
  } catch (error) {
    console.error('Error in loadRecommendationsFromDB:', error);
    return null;
  }
}

/**
 * Mark recommendation as viewed
 */
export async function markAsViewed(
  userId: string,
  googlePlaceId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('recommendation_tracking')
      .update({
        status: 'viewed',
        viewed_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('google_place_id', googlePlaceId)
      .eq('status', 'pending');

    if (error) {
      console.error('Error marking as viewed:', error);
    }
  } catch (error) {
    console.error('Error in markAsViewed:', error);
  }
}

/**
 * Mark recommendation as accepted (added to calendar)
 */
export async function markAsAccepted(
  userId: string,
  googlePlaceId: string,
  calendarEventId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('recommendation_tracking')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('google_place_id', googlePlaceId);

    if (error) {
      console.error('Error marking as accepted:', error);
      return;
    }

    // Link calendar event to recommendation for feedback tracking
    const { error: eventError } = await supabase
      .from('calendar_events')
      .update({
        google_place_id: googlePlaceId, // Store for feedback linkage
      })
      .eq('id', calendarEventId);

    if (eventError) {
      console.error('Error linking calendar event:', eventError);
    } else {
      console.log(`✅ Linked calendar event ${calendarEventId} to recommendation`);
    }
  } catch (error) {
    console.error('Error in markAsAccepted:', error);
  }
}

/**
 * Mark recommendation as "Not Interested"
 * This will be used in Phase 2 for penalties
 */
export async function markAsNotInterested(
  userId: string,
  googlePlaceId: string,
  reason?: string
): Promise<void> {
  try {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('recommendation_tracking')
      .update({
        status: 'not_interested',
        decline_reason: reason || 'not_interested',
        responded_at: now,
      })
      .eq('user_id', userId)
      .eq('google_place_id', googlePlaceId);

    if (error) {
      console.error('Error marking as not interested:', error);
      return;
    }

    console.log(`🚫 Marked ${googlePlaceId} as not interested`);

    // TODO Phase 2: Update user AI profile with penalties
  } catch (error) {
    console.error('Error in markAsNotInterested:', error);
  }
}

/**
 * Clear all pending recommendations (user refreshes feed)
 *
 * NEW BEHAVIOR WITH SMART RESURFACING:
 * - Instead of marking as "declined", update last_shown_at
 * - This allows recommendations to resurface after cooldown period
 * - Declined recommendations: 3 days cooldown
 * - Viewed/ignored: 7 days cooldown
 */
export async function clearPendingRecommendations(userId: string): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Update pending recommendations with last_shown_at so they can resurface later
    const { error } = await supabase
      .from('recommendation_tracking')
      .update({
        last_shown_at: now,
        status: 'declined', // Mark as declined (but will resurface after 3 days)
        responded_at: now,
        updated_at: now,
      })
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) {
      console.error('Error clearing recommendations:', error);
      return;
    }

    console.log('🔄 Updated pending recommendations with last_shown_at (will resurface after 3 days)');
  } catch (error) {
    console.error('Error in clearPendingRecommendations:', error);
  }
}

/**
 * Get recommendation statistics for user
 */
export async function getRecommendationStats(userId: string): Promise<{
  total: number;
  accepted: number;
  declined: number;
  notInterested: number;
  acceptanceRate: number;
}> {
  try {
    const { data, error } = await supabase
      .from('recommendation_tracking')
      .select('status')
      .eq('user_id', userId);

    if (error || !data) {
      return { total: 0, accepted: 0, declined: 0, notInterested: 0, acceptanceRate: 0 };
    }

    const total = data.length;
    const accepted = data.filter((r: any) => r.status === 'accepted').length;
    const declined = data.filter((r: any) => r.status === 'declined').length;
    const notInterested = data.filter((r: any) => r.status === 'not_interested').length;
    const acceptanceRate = total > 0 ? (accepted / total) * 100 : 0;

    return {
      total,
      accepted,
      declined,
      notInterested,
      acceptanceRate,
    };
  } catch (error) {
    console.error('Error getting recommendation stats:', error);
    return { total: 0, accepted: 0, declined: 0, notInterested: 0, acceptanceRate: 0 };
  }
}

/**
 * Block an activity permanently ("Never show again")
 */
export async function blockActivity(
  userId: string,
  googlePlaceId: string,
  placeName: string,
  reason?: string
): Promise<void> {
  try {
    // Add to blocked_activities table
    const { error: blockError } = await supabase
      .from('blocked_activities')
      .insert({
        user_id: userId,
        google_place_id: googlePlaceId,
        place_name: placeName,
        reason: reason || 'User chose "Never show again"',
        blocked_at: new Date().toISOString(),
      });

    if (blockError && blockError.code !== '23505') { // Ignore duplicate key errors
      console.error('Error blocking activity:', blockError);
      return;
    }

    // Also mark as not_interested in recommendation_tracking
    const { error: trackingError } = await supabase
      .from('recommendation_tracking')
      .update({
        status: 'not_interested',
        block_reason: reason || 'User chose "Never show again"',
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('google_place_id', googlePlaceId);

    if (trackingError) {
      console.error('Error updating tracking record:', trackingError);
      return;
    }

    console.log(`🚫 Permanently blocked ${placeName} (${googlePlaceId})`);
  } catch (error) {
    console.error('Error in blockActivity:', error);
  }
}

/**
 * Unblock an activity (remove from blocked list)
 */
export async function unblockActivity(
  userId: string,
  googlePlaceId: string
): Promise<void> {
  try {
    // Remove from blocked_activities table
    const { error: unblockError } = await supabase
      .from('blocked_activities')
      .delete()
      .eq('user_id', userId)
      .eq('google_place_id', googlePlaceId);

    if (unblockError) {
      console.error('Error unblocking activity:', unblockError);
      return;
    }

    // Update recommendation_tracking status to allow resurfacing
    const { error: trackingError } = await supabase
      .from('recommendation_tracking')
      .update({
        status: 'declined', // Change to declined so it can resurface after 3 days
        block_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('google_place_id', googlePlaceId)
      .eq('status', 'not_interested');

    if (trackingError) {
      console.error('Error updating tracking record:', trackingError);
      return;
    }

    console.log(`✅ Unblocked ${googlePlaceId}`);
  } catch (error) {
    console.error('Error in unblockActivity:', error);
  }
}

/**
 * Get all blocked activities for a user
 */
export async function getBlockedActivities(userId: string): Promise<{
  id: string;
  google_place_id: string;
  place_name: string;
  reason: string | null;
  blocked_at: string;
}[]> {
  try {
    const { data, error } = await supabase
      .from('blocked_activities')
      .select('*')
      .eq('user_id', userId)
      .order('blocked_at', { descending: true });

    if (error) {
      console.error('Error getting blocked activities:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getBlockedActivities:', error);
    return [];
  }
}

/**
 * Clean up malformed photo URLs in the database
 * Fixes double URLs like: https://places.googleapis.com/v1/https://images.unsplash.com/...
 *
 * This function:
 * 1. Finds all recommendations with malformed imageUrl fields
 * 2. Deletes them from the database
 * 3. Returns count of cleaned recommendations
 *
 * Recommendations will be regenerated fresh on next load.
 */
export async function cleanupMalformedPhotoURLs(userId: string): Promise<number> {
  try {
    console.log('🧹 [Cleanup] Starting photo URL cleanup...');

    // Get all recommendations for user
    const { data: recs, error } = await supabase
      .from('recommendation_tracking')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [Cleanup] Error loading recommendations:', error.message);
      return 0;
    }

    if (!recs || recs.length === 0) {
      console.log('📭 [Cleanup] No recommendations found');
      return 0;
    }

    let cleanedCount = 0;
    const malformedRecs: string[] = [];

    for (const rec of recs) {
      const recData = rec.recommendation_data as Recommendation;

      if (!recData || !recData.imageUrl) {
        continue;
      }

      // Check for malformed URL (double https)
      const isMalformed = recData.imageUrl.includes('https://places.googleapis.com/v1/https://');

      if (isMalformed) {
        malformedRecs.push(recData.title);

        // Delete this recommendation - it will be regenerated fresh
        const { error: deleteError } = await supabase
          .from('recommendation_tracking')
          .delete()
          .eq('id', rec.id);

        if (deleteError) {
          console.error(`❌ [Cleanup] Failed to delete ${recData.title}:`, deleteError.message);
        } else {
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`✅ [Cleanup] Removed ${cleanedCount} malformed recommendations: ${malformedRecs.join(', ')}`);
    } else {
      console.log(`✅ [Cleanup] No malformed URLs found - cache is clean`);
    }
    return cleanedCount;
  } catch (error) {
    console.error('❌ Error in cleanupMalformedPhotoURLs:', error);
    return 0;
  }
}
