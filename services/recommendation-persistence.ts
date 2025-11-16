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
      confidence_score: rec.score / 100, // Normalize to 0-1
      viewed_at: null,
      responded_at: null,
      resurfaced_count: 0,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    }));

    // Insert recommendations into a tracking table
    // We'll create this table to be simpler than the full schema
    const { error } = await supabase
      .from('recommendation_tracking')
      .insert(records);

    if (error) {
      console.error('Error saving recommendations:', error);
      // Don't throw - failing to save shouldn't break the app
    } else {
      console.log(`✅ Saved ${records.length} recommendations to database`);
    }
  } catch (error) {
    console.error('Error in saveRecommendationsToDB:', error);
  }
}

/**
 * Load pending recommendations from database
 * Returns null if no recommendations found (trigger new generation)
 */
export async function loadRecommendationsFromDB(
  userId: string
): Promise<Recommendation[] | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('recommendation_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
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

    console.log(`📥 Loaded ${data.length} recommendations from database`);

    // Extract the recommendation data
    const recommendations = data.map((record: any) => record.recommendation_data as Recommendation);

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
 */
export async function clearPendingRecommendations(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('recommendation_tracking')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) {
      console.error('Error clearing recommendations:', error);
      return;
    }

    console.log('🗑️ Cleared pending recommendations');
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
    const accepted = data.filter(r => r.status === 'accepted').length;
    const declined = data.filter(r => r.status === 'declined').length;
    const notInterested = data.filter(r => r.status === 'not_interested').length;
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
