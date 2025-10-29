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
}

// DEMO MODE: Skip database queries for demo user
const DEMO_USER_ID = 'demo-user-123';

/**
 * Find activities that were completed but haven't received feedback
 * Checks for events that ended in the last 24 hours
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
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find completed calendar events from the last 24 hours
    const { data: completedEvents, error: eventsError } = await supabase
      .from('calendar_events')
      .select('id, title, category, activity_id, end_time, source')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('end_time', yesterday.toISOString())
      .lte('end_time', now.toISOString())
      .order('end_time', { ascending: false });

    if (eventsError) throw eventsError;
    if (!completedEvents || completedEvents.length === 0) return [];

    const events = completedEvents as any[];

    // Check which ones already have feedback
    const eventActivityIds = events
      .map((e) => e.activity_id)
      .filter((id) => id !== null);

    let existingFeedback: any[] = [];
    if (eventActivityIds.length > 0) {
      const { data: feedbackData, error: feedbackError } = await (supabase
        .from('feedback') as any)
        .select('activity_id')
        .eq('user_id', userId)
        .in('activity_id', eventActivityIds);

      if (!feedbackError && feedbackData) {
        existingFeedback = feedbackData as any[];
      }
    }

    const feedbackActivityIds = new Set(
      existingFeedback.map((f) => f.activity_id)
    );

    // Filter out events that already have feedback
    const pendingActivities: CompletedActivity[] = events
      .filter((event) => !event.activity_id || !feedbackActivityIds.has(event.activity_id))
      .map((event) => ({
        eventId: event.id,
        activityId: event.activity_id,
        activityName: event.title,
        activityCategory: event.category || 'other',
        completedAt: event.end_time,
        recommendationId: null, // Could fetch from recommendations table if needed
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
 * Check if user should see feedback prompt
 * Returns true if there are pending activities and user hasn't been prompted recently
 */
export async function shouldPromptForFeedback(
  userId: string
): Promise<{ shouldPrompt: boolean; activity?: CompletedActivity }> {
  try {
    const pendingActivities = await getPendingFeedbackActivities(userId);

    if (pendingActivities.length === 0) {
      return { shouldPrompt: false };
    }

    // Return the most recent completed activity
    const activity = pendingActivities[0];

    // Check if we've already prompted for this specific activity
    // (You could store prompt history in localStorage or a database table)
    // For MVP, we'll just return the first pending activity

    return {
      shouldPrompt: true,
      activity,
    };
  } catch (error) {
    console.error('Error checking feedback prompt:', error);
    return { shouldPrompt: false };
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
