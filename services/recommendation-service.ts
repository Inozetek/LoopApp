import { supabase } from './supabase';

/**
 * Recommendation Service
 *
 * Handles the complete lifecycle of recommendations:
 * - Generate recommendations using scoring algorithm
 * - Save to database for persistence
 * - Track status changes (pending → viewed → accepted/declined)
 * - Link to calendar events when accepted
 * - Support for resurfacing and "Not Interested" penalties
 */

export interface Recommendation {
  id: string;
  user_id: string;
  activity_id: string;
  recommended_for: string; // ISO timestamp
  reason: string; // AI explanation
  confidence_score: number; // 0.0 to 1.0
  algorithm_version: string;
  score_breakdown: {
    base_score: number;
    location_score: number;
    time_context_score: number;
    feedback_history_score: number;
    collaborative_filtering_score: number;
    sponsored_boost: number;
    penalties: {
      exact_location?: number;
      same_chain?: number;
      category?: number;
      resurfacing?: number;
    };
    final_score: number;
  };
  is_sponsored: boolean;
  business_id: string | null;
  status: 'pending' | 'viewed' | 'accepted' | 'declined' | 'not_interested' | 'expired';
  viewed_at: string | null;
  responded_at: string | null;
  decline_reason?: string;
  declined_at?: string;
  resurfaced_count: number;
  last_resurfaced_at?: string;
  context_at_generation: {
    time_of_day: string;
    day_of_week: string;
    weather?: string;
    user_location?: { latitude: number; longitude: number };
  };
  created_at: string;
  expires_at: string;
  // Joined activity data
  activity?: any;
}

export interface Activity {
  id: string;
  google_place_id: string;
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  location: { latitude: number; longitude: number };
  address: string;
  city?: string;
  state?: string;
  price_range?: number;
  rating?: number;
  reviews_count?: number;
  hours?: any;
  photos?: string[];
  cover_photo_url?: string;
  tags?: string[];
  sponsored_tier: 'organic' | 'boosted' | 'premium';
  sponsor_active: boolean;
}

/**
 * Generate recommendations for a user
 * This is the main entry point called by the Feed screen
 */
export async function generateRecommendations(
  userId: string,
  userLocation?: { latitude: number; longitude: number },
  limit: number = 10
): Promise<Recommendation[]> {
  try {
    // 1. Get user profile with AI learning data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('interests, preferences, ai_profile')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // 2. Get user's calendar to find free time
    const { data: calendar, error: calendarError } = await supabase
      .from('calendar_events')
      .select('start_time, end_time')
      .eq('user_id', userId)
      .gte('start_time', new Date().toISOString())
      .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('start_time', { ascending: true });

    if (calendarError) throw calendarError;

    // 3. Get user's past feedback for learning
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select('activity_id, rating, feedback_tags, created_at')
      .eq('user_id', userId)
      .order('created_at', { descending: true })
      .limit(100);

    if (feedbackError) throw feedbackError;

    // 4. Get previously declined recommendations (for "Not Interested" tracking)
    const { data: declinedRecs, error: declinedError } = await supabase
      .from('recommendations')
      .select('activity_id, decline_reason, declined_at')
      .eq('user_id', userId)
      .in('status', ['declined', 'not_interested'])
      .order('declined_at', { descending: true });

    if (declinedError) throw declinedError;

    // 5. Query activities from database (already populated from Google Places)
    // For MVP, we'll use a simple distance-based query
    // TODO: In production, use PostGIS for more efficient spatial queries
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('*')
      .eq('is_active', true)
      .limit(100); // Get larger pool to filter from

    if (activitiesError) throw activitiesError;

    // 6. Score each activity using the recommendation algorithm
    const scoredActivities = activities.map((activity: Activity) => {
      const score = calculateActivityScore(
        activity,
        user,
        userLocation,
        feedback || [],
        declinedRecs || []
      );

      return {
        activity,
        score,
      };
    });

    // 7. Sort by score and apply business rules
    scoredActivities.sort((a, b) => b.score.final_score - a.score.final_score);

    // Business rules:
    // - Max 2 sponsored in top 5 (40% mix)
    // - At least 3 different categories in top 5
    // - Never show same business twice
    const filteredAndRanked = applyBusinessRules(scoredActivities, limit);

    // 8. Save recommendations to database
    const recommendations = await saveRecommendations(
      userId,
      filteredAndRanked,
      userLocation
    );

    return recommendations;
  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw error;
  }
}

/**
 * Calculate activity score using the recommendation algorithm
 * Based on CLAUDE.md algorithm specification
 */
function calculateActivityScore(
  activity: Activity,
  user: any,
  userLocation?: { latitude: number; longitude: number },
  feedback: any[] = [],
  declinedRecs: any[] = []
): any {
  const aiProfile = user.ai_profile || {};
  const interests = user.interests || [];
  const preferences = user.preferences || {};

  let baseScore = 0;
  let locationScore = 0;
  let timeContextScore = 0;
  let feedbackHistoryScore = 0;
  let collaborativeFilteringScore = 0;
  let sponsoredBoost = 0;

  const penalties = {
    exact_location: 0,
    same_chain: 0,
    category: 0,
    resurfacing: 0,
  };

  // 1. BASE SCORE (40 points max) - Interest match
  const topInterests = interests.slice(0, 3);
  if (topInterests.includes(activity.category)) {
    baseScore = 20;
  } else if (interests.includes(activity.category)) {
    baseScore = 10;
  } else {
    baseScore = 0; // Still eligible, just lower priority
  }

  // 2. LOCATION SCORE (20 points max)
  if (userLocation && activity.location) {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      activity.location.latitude,
      activity.location.longitude
    );

    const distanceMiles = distance / 1609.34;
    const maxDistance = preferences.max_distance_miles || 5;

    if (distanceMiles <= 1) {
      locationScore = 20; // Very close
    } else if (distanceMiles <= 2) {
      locationScore = 15; // Nearby
    } else if (distanceMiles <= maxDistance) {
      locationScore = 10; // Within preferred distance
    } else {
      locationScore = 0; // Too far, but still show
    }
  }

  // 3. TIME CONTEXT SCORE (15 points max)
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0 = Sunday

  // Time-based scoring (simplified for MVP)
  if (activity.category === 'coffee' && hour >= 7 && hour <= 10) {
    timeContextScore = 15; // Perfect timing
  } else if (activity.category === 'dining' && (hour >= 11 && hour <= 14 || hour >= 17 && hour <= 21)) {
    timeContextScore = 15;
  } else if (activity.category === 'entertainment' && hour >= 18) {
    timeContextScore = 10;
  } else {
    timeContextScore = 5; // Acceptable any time
  }

  // 4. FEEDBACK HISTORY SCORE (15 points max)
  const categoryFeedback = feedback.filter(f => {
    // We'd need to join with activities table to get category
    // For MVP, simplified
    return f.rating === 'thumbs_up';
  });

  if (categoryFeedback.length > 0) {
    feedbackHistoryScore = 15; // Has positive history
  } else if (feedback.length === 0) {
    feedbackHistoryScore = 5; // New user, neutral
  } else {
    feedbackHistoryScore = 0; // Has feedback but not positive
  }

  // 5. COLLABORATIVE FILTERING (10 points max)
  // TODO: Implement after we have enough user data
  collaborativeFilteringScore = 0;

  // 6. PENALTIES - "Not Interested" tracking

  // Exact location penalty
  const exactDecline = declinedRecs.find(
    d => d.activity_id === activity.id && d.decline_reason === 'not_interested'
  );
  if (exactDecline) {
    penalties.exact_location = -20;
  }

  // Same chain penalty (if business name contains chain identifier)
  // TODO: Implement chain detection
  penalties.same_chain = 0;

  // Category penalty (from AI profile)
  const dislikedCategories = aiProfile.disliked_categories || [];
  if (dislikedCategories.includes(activity.category)) {
    const categoryDeclines = declinedRecs.filter(
      d => d.decline_reason === 'not_interested'
    ).length;

    if (categoryDeclines >= 3) {
      penalties.category = -5;
    } else if (categoryDeclines >= 5) {
      penalties.category = -8;
    }
  }

  // Calculate total before sponsored boost
  const totalBeforeBoost =
    baseScore +
    locationScore +
    timeContextScore +
    feedbackHistoryScore +
    collaborativeFilteringScore +
    penalties.exact_location +
    penalties.same_chain +
    penalties.category;

  // 7. SPONSORED BOOST (applied AFTER base scoring)
  if (activity.sponsor_active && activity.sponsored_tier !== 'organic') {
    // Critical rule: If base score < 40, cap boost at +10 points
    if (totalBeforeBoost < 40) {
      sponsoredBoost = 10; // Prevent irrelevant spam
    } else {
      if (activity.sponsored_tier === 'boosted') {
        sponsoredBoost = totalBeforeBoost * 0.15; // +15% boost
      } else if (activity.sponsored_tier === 'premium') {
        sponsoredBoost = totalBeforeBoost * 0.30; // +30% boost
      }
    }
  }

  const finalScore = totalBeforeBoost + sponsoredBoost;

  return {
    base_score: baseScore,
    location_score: locationScore,
    time_context_score: timeContextScore,
    feedback_history_score: feedbackHistoryScore,
    collaborative_filtering_score: collaborativeFilteringScore,
    sponsored_boost: sponsoredBoost,
    penalties,
    final_score: finalScore,
  };
}

/**
 * Calculate distance between two lat/lng points in meters (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Apply business rules to scored activities
 */
function applyBusinessRules(
  scoredActivities: any[],
  limit: number
): any[] {
  const result: any[] = [];
  const seenBusinesses = new Set<string>();
  const categoryCount: { [key: string]: number } = {};
  let sponsoredInTopFive = 0;

  for (const item of scoredActivities) {
    if (result.length >= limit) break;

    const activity = item.activity;

    // Never show same business twice
    if (seenBusinesses.has(activity.id)) continue;

    // Max 2 sponsored in top 5
    if (result.length < 5 && activity.sponsor_active && activity.sponsored_tier !== 'organic') {
      if (sponsoredInTopFive >= 2) continue;
      sponsoredInTopFive++;
    }

    // Track category diversity
    categoryCount[activity.category] = (categoryCount[activity.category] || 0) + 1;

    // Add to result
    result.push(item);
    seenBusinesses.add(activity.id);
  }

  // Check diversity requirement: At least 3 different categories in top 5
  if (result.length >= 5) {
    const topFiveCategories = new Set(
      result.slice(0, 5).map(item => item.activity.category)
    );
    if (topFiveCategories.size < 3) {
      console.warn('Diversity requirement not met: only', topFiveCategories.size, 'categories in top 5');
      // TODO: Re-sort to ensure diversity
    }
  }

  return result;
}

/**
 * Save recommendations to database
 */
async function saveRecommendations(
  userId: string,
  scoredActivities: any[],
  userLocation?: { latitude: number; longitude: number }
): Promise<Recommendation[]> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const recommendations = scoredActivities.map((item) => ({
    user_id: userId,
    activity_id: item.activity.id,
    recommended_for: now.toISOString(),
    reason: generateAIExplanation(item.activity, item.score),
    confidence_score: Math.min(item.score.final_score / 100, 1.0),
    algorithm_version: '1.0',
    score_breakdown: item.score,
    is_sponsored: item.activity.sponsor_active && item.activity.sponsored_tier !== 'organic',
    business_id: item.activity.business_id || null,
    status: 'pending',
    resurfaced_count: 0,
    context_at_generation: {
      time_of_day: now.getHours().toString(),
      day_of_week: now.getDay().toString(),
      user_location: userLocation,
    },
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  }));

  const { data, error } = await supabase
    .from('recommendations')
    .insert(recommendations)
    .select('*, activity:activities(*)');

  if (error) {
    console.error('Error saving recommendations:', error);
    throw error;
  }

  return data as Recommendation[];
}

/**
 * Generate AI explanation for why this activity was recommended
 * For MVP, use template-based explanations
 * TODO: Integrate OpenAI API for more natural language
 */
function generateAIExplanation(activity: Activity, score: any): string {
  const reasons: string[] = [];

  if (score.base_score >= 20) {
    reasons.push(`matches your top interests`);
  } else if (score.base_score >= 10) {
    reasons.push(`aligns with your interests`);
  }

  if (score.location_score >= 15) {
    reasons.push(`very close to you`);
  } else if (score.location_score >= 10) {
    reasons.push(`nearby`);
  }

  if (score.time_context_score >= 10) {
    reasons.push(`perfect timing for now`);
  }

  if (score.feedback_history_score >= 10) {
    reasons.push(`similar to places you've enjoyed`);
  }

  if (reasons.length === 0) {
    return `${activity.name} might be a great new experience for you!`;
  }

  return `Suggested because it ${reasons.join(' and ')}.`;
}

/**
 * Get recommendations for a user
 * Returns existing recommendations from DB, or generates new ones if needed
 */
export async function getRecommendations(
  userId: string,
  userLocation?: { latitude: number; longitude: number },
  forceRefresh: boolean = false
): Promise<Recommendation[]> {
  // Check for existing pending recommendations
  if (!forceRefresh) {
    const { data: existing, error } = await supabase
      .from('recommendations')
      .select('*, activity:activities(*)')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .order('confidence_score', { descending: true })
      .limit(10);

    if (!error && existing && existing.length > 0) {
      return existing as Recommendation[];
    }
  }

  // Generate new recommendations
  return await generateRecommendations(userId, userLocation, 10);
}

/**
 * Mark recommendation as viewed
 */
export async function markRecommendationViewed(recommendationId: string): Promise<void> {
  const { error } = await supabase
    .from('recommendations')
    .update({
      status: 'viewed',
      viewed_at: new Date().toISOString(),
    })
    .eq('id', recommendationId);

  if (error) {
    console.error('Error marking recommendation as viewed:', error);
    throw error;
  }
}

/**
 * Accept recommendation (user adds to calendar)
 */
export async function acceptRecommendation(
  recommendationId: string,
  calendarEventId: string
): Promise<void> {
  const { error } = await supabase
    .from('recommendations')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
    })
    .eq('id', recommendationId);

  if (error) {
    console.error('Error accepting recommendation:', error);
    throw error;
  }

  // Link calendar event to recommendation
  const { error: eventError } = await supabase
    .from('calendar_events')
    .update({
      source: 'recommendation',
      activity_id: recommendationId, // Store recommendation ID for feedback tracking
    })
    .eq('id', calendarEventId);

  if (eventError) {
    console.error('Error linking calendar event:', eventError);
  }
}

/**
 * Decline recommendation
 */
export async function declineRecommendation(recommendationId: string): Promise<void> {
  const { error } = await supabase
    .from('recommendations')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('id', recommendationId);

  if (error) {
    console.error('Error declining recommendation:', error);
    throw error;
  }
}

/**
 * Mark recommendation as "Not Interested"
 * This applies penalties to prevent similar suggestions
 */
export async function markNotInterested(
  recommendationId: string,
  reason?: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('recommendations')
    .update({
      status: 'not_interested',
      decline_reason: reason || 'not_interested',
      declined_at: now,
      responded_at: now,
    })
    .eq('id', recommendationId);

  if (error) {
    console.error('Error marking as not interested:', error);
    throw error;
  }

  // TODO: Update user AI profile with penalty
  // This will be implemented in Phase 2
}

/**
 * Clear all pending recommendations (user refreshes feed)
 */
export async function clearRecommendations(userId: string): Promise<void> {
  const { error } = await supabase
    .from('recommendations')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) {
    console.error('Error clearing recommendations:', error);
    throw error;
  }
}
