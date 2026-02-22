/**
 * Feedback Service
 *
 * Detects completed activities and prompts users for feedback.
 * Manages feedback collection workflow to improve ML recommendations.
 */

import { supabase } from '@/lib/supabase';

export interface CompletedActivity {
  eventId: string;
  activityId: string | null;
  activityName: string;
  activityCategory: string;
  completedAt: string;
  recommendationId: string | null;
  // Place info for moment capture after feedback
  place?: {
    id: string;
    name: string;
    address?: string;
  };
}

// DEMO MODE: Skip database queries for demo user
const DEMO_USER_ID = 'demo-user-123';

/**
 * Find activities that were completed but haven't received feedback
 *
 * IMPORTANT: This now only returns events that have been explicitly marked as "completed"
 * by the user (via the "Rate Activity" button). We no longer auto-prompt based on time alone
 * because we can't verify the user actually visited the location.
 *
 * Future enhancement: Use geofencing/location tracking to automatically detect visits.
 */
export async function getPendingFeedbackActivities(
  userId: string
): Promise<CompletedActivity[]> {
  // Skip for demo user
  if (userId === DEMO_USER_ID) {
    return [];
  }

  try {
    const now = new Date();
    // Only check events completed in the last 24 hours
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // CRITICAL FIX: Only find events that have been EXPLICITLY marked as completed
    // by the user (status = 'completed'). This ensures we only prompt for activities
    // the user has confirmed they actually attended.
    //
    // We do NOT prompt based on end_time alone because:
    // 1. User might not have actually gone to the task
    // 2. Task might have been cancelled/skipped
    // 3. We can't verify location without background tracking
    const { data: completedEvents, error: eventsError } = await supabase
      .from('calendar_events')
      .select('id, title, category, activity_id, end_time, completed_at, source, address, google_place_id')
      .eq('user_id', userId)
      .eq('status', 'completed')  // Only events explicitly marked as completed
      .gte('completed_at', oneDayAgo.toISOString())
      .order('completed_at', { ascending: false });

    if (eventsError) throw eventsError;
    if (!completedEvents || completedEvents.length === 0) return [];

    const events = completedEvents as any[];

    // Check which ones already have feedback
    const eventIds = events.map((e) => e.id);

    // Check feedback by event_id since not all events have activity_id
    let existingFeedbackEventIds: Set<string> = new Set();

    // We need to check if feedback exists for these events
    // Since feedback table might reference activity_id or we can check by event metadata
    const eventActivityIds = events
      .map((e) => e.activity_id)
      .filter((id) => id !== null);

    if (eventActivityIds.length > 0) {
      const { data: feedbackData, error: feedbackError } = await (supabase
        .from('feedback') as any)
        .select('activity_id')
        .eq('user_id', userId)
        .in('activity_id', eventActivityIds);

      if (!feedbackError && feedbackData) {
        const feedbackActivityIds = new Set(
          (feedbackData as any[]).map((f) => f.activity_id)
        );
        // Map back to event IDs
        events.forEach(event => {
          if (event.activity_id && feedbackActivityIds.has(event.activity_id)) {
            existingFeedbackEventIds.add(event.id);
          }
        });
      }
    }

    // Filter out events that already have feedback
    const pendingActivities: CompletedActivity[] = events
      .filter((event) => !existingFeedbackEventIds.has(event.id))
      .map((event) => ({
        eventId: event.id,
        activityId: event.activity_id,
        activityName: event.title,
        activityCategory: event.category || 'other',
        completedAt: event.completed_at || event.end_time,
        recommendationId: null,
        place: event.google_place_id || event.activity_id ? {
          id: event.google_place_id || event.activity_id || event.id,
          name: event.title,
          address: event.address || undefined,
        } : undefined,
      }));

    return pendingActivities;
  } catch (error) {
    console.error('Error fetching pending feedback activities:', error);
    return [];
  }
}

/**
 * Mark a calendar event as completed
 * This triggers the feedback flow
 */
export async function markEventAsCompleted(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  // Skip for demo mode (event IDs would be demo-specific)
  if (eventId.startsWith('demo-')) {
    return { success: true };
  }

  try {
    const { error } = await (supabase
      .from('calendar_events') as any)
      .update({
        status: 'completed' as const,
        completed_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error marking event as completed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get recommendation ID for an activity (if it came from a recommendation)
 */
export async function getRecommendationIdForActivity(
  userId: string,
  activityId: string
): Promise<string | null> {
  // Skip for demo user
  if (userId === DEMO_USER_ID) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('recommendations')
      .select('id')
      .eq('user_id', userId)
      .eq('activity_id', activityId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return (data as any).id;
  } catch (error) {
    console.error('Error fetching recommendation ID:', error);
    return null;
  }
}

/**
 * Find past events (end_time < now, within 48 hours) that haven't received feedback,
 * regardless of whether the user explicitly marked them "completed".
 *
 * This enables automatic feedback prompting — the user doesn't need to tap
 * "Rate Activity" first. Events that were cancelled are excluded.
 */
export async function getPastEventsNeedingFeedback(
  userId: string
): Promise<CompletedActivity[]> {
  if (userId === DEMO_USER_ID) return [];

  try {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Find events that have ended in the last 48 hours and aren't cancelled
    const { data: pastEvents, error: eventsError } = await supabase
      .from('calendar_events')
      .select('id, title, category, activity_id, end_time, completed_at, source, address, google_place_id')
      .eq('user_id', userId)
      .in('status', ['scheduled', 'completed'])
      .lt('end_time', now.toISOString())
      .gt('end_time', twoDaysAgo.toISOString())
      .order('end_time', { ascending: false });

    if (eventsError) throw eventsError;
    if (!pastEvents || pastEvents.length === 0) return [];

    const events = pastEvents as any[];

    // Check which already have feedback
    const eventActivityIds = events
      .map((e) => e.activity_id)
      .filter((id) => id !== null);

    let feedbackActivityIds = new Set<string>();

    if (eventActivityIds.length > 0) {
      const { data: feedbackData } = await (supabase
        .from('feedback') as any)
        .select('activity_id')
        .eq('user_id', userId)
        .in('activity_id', eventActivityIds);

      if (feedbackData) {
        feedbackActivityIds = new Set(
          (feedbackData as any[]).map((f) => f.activity_id)
        );
      }
    }

    // Filter out events that already have feedback
    return events
      .filter((event) => {
        if (event.activity_id && feedbackActivityIds.has(event.activity_id)) {
          return false;
        }
        return true;
      })
      .map((event) => ({
        eventId: event.id,
        activityId: event.activity_id,
        activityName: event.title,
        activityCategory: event.category || 'other',
        completedAt: event.completed_at || event.end_time,
        recommendationId: null,
        place: event.google_place_id || event.activity_id ? {
          id: event.google_place_id || event.activity_id || event.id,
          name: event.title,
          address: event.address || undefined,
        } : undefined,
      }));
  } catch (error) {
    console.error('Error fetching past events needing feedback:', error);
    return [];
  }
}

/**
 * Check if user should see feedback prompt.
 *
 * Priority order:
 * 1. Explicitly completed events without feedback (highest priority)
 * 2. Past scheduled events without feedback (auto-detected)
 */
export async function shouldPromptForFeedback(
  userId: string
): Promise<{ shouldPrompt: boolean; activity?: CompletedActivity }> {
  try {
    // First check explicitly completed events (existing behavior)
    const completedPending = await getPendingFeedbackActivities(userId);
    if (completedPending.length > 0) {
      return { shouldPrompt: true, activity: completedPending[0] };
    }

    // Then check auto-detected past events
    const pastPending = await getPastEventsNeedingFeedback(userId);
    if (pastPending.length > 0) {
      return { shouldPrompt: true, activity: pastPending[0] };
    }

    return { shouldPrompt: false };
  } catch (error) {
    console.error('Error checking feedback prompt:', error);
    return { shouldPrompt: false };
  }
}

/**
 * Submit user feedback for a completed activity
 */
export async function submitFeedback(feedback: {
  userId: string;
  activityId: string;
  recommendationId?: string;
  rating: 'thumbs_up' | 'thumbs_down';
  tags?: string[];
  notes?: string;
  completedAt: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('📝 Submitting feedback:', feedback);

    // CRITICAL FIX: Verify activity exists before inserting feedback
    // This prevents foreign key constraint violations (code 23503)
    if (feedback.activityId) {
      const { data: activityExists, error: checkError } = await supabase
        .from('activities')
        .select('id')
        .eq('id', feedback.activityId)
        .single();

      if (checkError || !activityExists) {
        console.warn('⚠️  Activity not found in database, skipping activity_id');
        // Clear activity_id if it doesn't exist (manual calendar events)
        feedback.activityId = null as any;
      }
    }

    // 1. Check for existing feedback (prevent rating same place twice)
    if (feedback.activityId) {
      const { data: existing } = await (supabase
        .from('feedback') as any)
        .select('id')
        .eq('user_id', feedback.userId)
        .eq('activity_id', feedback.activityId)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log('⏭️  Already rated this activity, skipping duplicate');
        return { success: true };
      }
    }

    // 2. Insert feedback into database
    const feedbackRecord: any = {
      user_id: feedback.userId,
      rating: feedback.rating,
      feedback_tags: feedback.tags || [],
      feedback_notes: feedback.notes || null,
      completed_at: feedback.completedAt,
    };

    // Only add activity_id if it exists in database
    if (feedback.activityId) {
      feedbackRecord.activity_id = feedback.activityId;
    }

    // Only add recommendation_id if provided
    if (feedback.recommendationId) {
      feedbackRecord.recommendation_id = feedback.recommendationId;
    }

    const { data: feedbackData, error: feedbackError } = await supabase
      .from('feedback')
      .insert(feedbackRecord)
      .select()
      .single();

    if (feedbackError) {
      console.error('❌ Error inserting feedback:', feedbackError);
      return { success: false, error: feedbackError.message };
    }

    console.log('✅ Feedback inserted successfully:', feedbackData.id);

    // 2. Update user's AI profile based on feedback
    await updateAIProfile(feedback);

    return { success: true };
  } catch (error: any) {
    console.error('❌ Error submitting feedback:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user's AI profile based on feedback
 */
export async function updateAIProfile(feedback: {
  userId: string;
  activityId: string;
  rating: 'thumbs_up' | 'thumbs_down';
  tags?: string[];
  completedAt?: string;
}): Promise<void> {
  try {
    console.log('🧠 Updating AI profile for user:', feedback.userId);

    // 1. Fetch current user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('ai_profile')
      .eq('id', feedback.userId)
      .single();

    if (userError || !user) {
      console.error('❌ Error fetching user:', userError);
      return;
    }

    // 2. Get activity details
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select('category, subcategory, price_range')
      .eq('id', feedback.activityId)
      .single();

    if (activityError || !activity) {
      console.error('❌ Error fetching activity:', activityError);
      return;
    }

    // 3. Parse existing AI profile (with defaults)
    const currentProfile = user.ai_profile || {
      preferred_distance_miles: 5.0,
      budget_level: 2,
      favorite_categories: [],
      disliked_categories: [],
      price_sensitivity: 'medium',
      time_preferences: [],
      distance_tolerance: 'medium',
    };

    // 4. Update profile based on rating
    const updatedProfile = { ...currentProfile };

    if (feedback.rating === 'thumbs_up') {
      // Add to favorite categories
      if (!updatedProfile.favorite_categories.includes(activity.category)) {
        updatedProfile.favorite_categories.push(activity.category);
      }
      // Remove from disliked
      updatedProfile.disliked_categories = updatedProfile.disliked_categories.filter(
        (cat: string) => cat !== activity.category
      );
      // Update budget level if activity has price range
      if (activity.price_range) {
        updatedProfile.budget_level = Math.round(
          updatedProfile.budget_level * 0.7 + activity.price_range * 0.3
        );
      }
      // Update time preferences from completed time
      if (feedback.completedAt) {
        const hour = new Date(feedback.completedAt).getHours();
        let timePref = 'evening';
        if (hour >= 5 && hour < 12) timePref = 'morning';
        else if (hour >= 12 && hour < 17) timePref = 'afternoon';
        else if (hour >= 17 && hour < 21) timePref = 'evening';
        else timePref = 'night';

        if (!updatedProfile.time_preferences) updatedProfile.time_preferences = [];
        if (!updatedProfile.time_preferences.includes(timePref)) {
          updatedProfile.time_preferences.push(timePref);
          // Keep last 4 unique time preferences
          if (updatedProfile.time_preferences.length > 4) {
            updatedProfile.time_preferences = updatedProfile.time_preferences.slice(-4);
          }
        }
      }
      console.log('👍 Added', activity.category, 'to favorites');
    } else if (feedback.rating === 'thumbs_down' && feedback.tags) {
      // Process negative feedback tags
      for (const tag of feedback.tags) {
        switch (tag) {
          case 'too_expensive':
            updatedProfile.budget_level = Math.max(1, updatedProfile.budget_level - 0.5);
            updatedProfile.price_sensitivity = 'high';
            break;
          case 'too_far':
            updatedProfile.preferred_distance_miles = Math.max(
              1,
              updatedProfile.preferred_distance_miles * 0.8
            );
            updatedProfile.distance_tolerance = 'low';
            break;
          case 'boring':
          case 'too_crowded':
            if (!updatedProfile.disliked_categories.includes(activity.category)) {
              updatedProfile.disliked_categories.push(activity.category);
            }
            updatedProfile.favorite_categories = updatedProfile.favorite_categories.filter(
              (cat: string) => cat !== activity.category
            );
            break;
        }
      }
    }

    // 5. Limit array sizes
    if (updatedProfile.favorite_categories.length > 10) {
      updatedProfile.favorite_categories = updatedProfile.favorite_categories.slice(-10);
    }
    if (updatedProfile.disliked_categories.length > 10) {
      updatedProfile.disliked_categories = updatedProfile.disliked_categories.slice(-10);
    }

    // 6. Update database
    const { error: updateError } = await supabase
      .from('users')
      .update({ ai_profile: updatedProfile })
      .eq('id', feedback.userId);

    if (updateError) {
      console.error('❌ Error updating AI profile:', updateError);
      return;
    }

    console.log('✅ AI profile updated successfully');
  } catch (error) {
    console.error('❌ Error updating AI profile:', error);
  }
}

/**
 * Get user's feedback statistics
 * Used to show ML learning progress to users
 */
export async function getUserFeedbackStats(userId: string): Promise<{
  totalFeedback: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  satisfactionRate: number;
  topCategories: string[];
}> {
  // Return mock stats for demo user
  if (userId === DEMO_USER_ID) {
    return {
      totalFeedback: 12,
      thumbsUpCount: 10,
      thumbsDownCount: 2,
      satisfactionRate: 83.3,
      topCategories: ['coffee', 'live music', 'hiking'],
    };
  }

  try {
    const { data: feedbackData, error } = await supabase
      .from('feedback')
      .select('rating, feedback_tags')
      .eq('user_id', userId);

    if (error) throw error;

    const feedback = (feedbackData || []) as any[];
    const totalFeedback = feedback.length;
    const thumbsUpCount = feedback.filter((f) => f.rating === 'thumbs_up').length;
    const thumbsDownCount = feedback.filter((f) => f.rating === 'thumbs_down').length;
    const satisfactionRate =
      totalFeedback > 0 ? (thumbsUpCount / totalFeedback) * 100 : 0;

    // Get user's AI profile to find top categories
    const { data: userData } = await supabase
      .from('users')
      .select('ai_profile')
      .eq('id', userId)
      .single();

    const topCategories =
      (userData as any)?.ai_profile?.favorite_categories || [];

    return {
      totalFeedback,
      thumbsUpCount,
      thumbsDownCount,
      satisfactionRate,
      topCategories: topCategories.slice(0, 5),
    };
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    return {
      totalFeedback: 0,
      thumbsUpCount: 0,
      thumbsDownCount: 0,
      satisfactionRate: 0,
      topCategories: [],
    };
  }
}
