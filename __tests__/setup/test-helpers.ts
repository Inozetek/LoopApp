/**
 * Test Helpers
 *
 * Utilities for creating, seeding, and cleaning up test data
 * Uses REAL Supabase test database (NOT production)
 */

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

// Type aliases for convenience
type User = Database['public']['Tables']['users']['Row'];
type CalendarEvent = Database['public']['Tables']['calendar_events']['Row'];
type Activity = Database['public']['Tables']['activities']['Row'];
type Feedback = Database['public']['Tables']['feedback']['Row'];

/**
 * Test user data template
 */
export interface TestUserData {
  email: string;
  password: string;
  name: string;
  interests: string[];
  home_address: string;
  home_location: { latitude: number; longitude: number };
  work_address?: string;
  work_location?: { latitude: number; longitude: number };
  preferences?: {
    budget: number;
    max_distance_miles: number;
    preferred_times: string[];
    notification_enabled: boolean;
  };
  ai_profile?: {
    preferred_distance_miles: number;
    budget_level: number;
    favorite_categories: string[];
    disliked_categories: string[];
    price_sensitivity: string;
    time_preferences: string[];
    distance_tolerance: string;
  };
}

/**
 * Default test user template
 */
export const DEFAULT_TEST_USER: TestUserData = {
  email: process.env.TEST_USER_EMAIL || 'test@loopapp.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
  name: 'Test User',
  interests: ['coffee', 'live_music', 'hiking', 'restaurants', 'museums'],
  home_address: '1 Market St, San Francisco, CA 94105',
  home_location: {
    latitude: 37.7749,
    longitude: -122.4194,
  },
  work_address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043',
  work_location: {
    latitude: 37.4220,
    longitude: -122.0841,
  },
  preferences: {
    budget: 2,
    max_distance_miles: 5,
    preferred_times: ['morning', 'evening'],
    notification_enabled: true,
  },
  ai_profile: {
    preferred_distance_miles: 5.0,
    budget_level: 2,
    favorite_categories: ['coffee', 'live_music'],
    disliked_categories: [],
    price_sensitivity: 'medium',
    time_preferences: ['morning', 'evening'],
    distance_tolerance: 'medium',
  },
};

/**
 * Create test user with profile
 *
 * @param userData - User data (defaults to DEFAULT_TEST_USER)
 * @returns User ID and auth session
 */
export async function createTestUser(
  userData: Partial<TestUserData> = {}
): Promise<{ userId: string; session: any }> {
  const data = { ...DEFAULT_TEST_USER, ...userData };

  // 1. Create auth user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  });

  if (authError) {
    throw new Error(`Failed to create test user: ${authError.message}`);
  }

  if (!authData.user) {
    throw new Error('No user returned from signUp');
  }

  const userId = authData.user.id;

  // 2. Update user profile with test data
  const { error: profileError } = await supabase
    .from('users')
    .update({
      name: data.name,
      interests: data.interests,
      home_address: data.home_address,
      home_location: `POINT(${data.home_location.longitude} ${data.home_location.latitude})`,
      work_address: data.work_address,
      work_location: data.work_location
        ? `POINT(${data.work_location.longitude} ${data.work_location.latitude})`
        : null,
      preferences: data.preferences,
      ai_profile: data.ai_profile,
    })
    .eq('id', userId);

  if (profileError) {
    throw new Error(`Failed to update test user profile: ${profileError.message}`);
  }

  console.log(`✅ Created test user: ${data.email} (ID: ${userId})`);

  return { userId, session: authData.session };
}

/**
 * Clean up test user and all related data (cascading delete)
 *
 * @param userId - User ID to delete
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  // Supabase RLS with CASCADE should handle related data deletion
  // Delete order: feedback → calendar_events → recommendations → friendships → users

  try {
    // 1. Delete feedback
    await supabase.from('feedback').delete().eq('user_id', userId);

    // 2. Delete calendar events
    await supabase.from('calendar_events').delete().eq('user_id', userId);

    // 3. Delete recommendations
    await supabase.from('recommendations').delete().eq('user_id', userId);

    // 4. Delete friendships (both directions)
    await supabase.from('friendships').delete().eq('user_id', userId);
    await supabase.from('friendships').delete().eq('friend_id', userId);

    // 5. Delete group plan participants
    await supabase.from('plan_participants').delete().eq('user_id', userId);

    // 6. Delete user
    const { error } = await supabase.from('users').delete().eq('id', userId);

    if (error) {
      console.warn(`⚠️ Error deleting test user ${userId}: ${error.message}`);
    } else {
      console.log(`✅ Cleaned up test user: ${userId}`);
    }

    // 7. Delete auth user (Supabase admin API)
    // Note: This requires admin privileges, may need to be done manually
    // await supabase.auth.admin.deleteUser(userId);
  } catch (error) {
    console.warn(`⚠️ Error during cleanup for user ${userId}:`, error);
  }
}

/**
 * Seed test activities (sample venues for testing)
 *
 * @returns Array of created activity IDs
 */
export async function seedTestActivities(): Promise<string[]> {
  const testActivities = [
    {
      name: 'Blue Bottle Coffee',
      category: 'cafe',
      location: `POINT(-122.4194 37.7749)`,
      address: '66 Mint St, San Francisco, CA 94103',
      price_range: 2,
      rating: 4.5,
      reviews_count: 1250,
      hours: {
        monday: { open: '07:00', close: '18:00' },
        tuesday: { open: '07:00', close: '18:00' },
        wednesday: { open: '07:00', close: '18:00' },
        thursday: { open: '07:00', close: '18:00' },
        friday: { open: '07:00', close: '18:00' },
        saturday: { open: '08:00', close: '18:00' },
        sunday: { open: '08:00', close: '18:00' },
      },
      tags: ['coffee', 'cafe', 'artisan'],
      sponsored_tier: 'organic',
      is_active: true,
    },
    {
      name: 'The Fillmore',
      category: 'live_music',
      location: `POINT(-122.4330 37.7844)`,
      address: '1805 Geary Blvd, San Francisco, CA 94115',
      price_range: 3,
      rating: 4.7,
      reviews_count: 3500,
      hours: {
        monday: { open: '19:00', close: '23:00' },
        tuesday: { open: '19:00', close: '23:00' },
        wednesday: { open: '19:00', close: '23:00' },
        thursday: { open: '19:00', close: '23:00' },
        friday: { open: '19:00', close: '02:00' },
        saturday: { open: '19:00', close: '02:00' },
        sunday: { open: '19:00', close: '23:00' },
      },
      tags: ['live_music', 'concerts', 'historic'],
      sponsored_tier: 'boosted',
      is_active: true,
    },
    {
      name: 'Golden Gate Park',
      category: 'parks',
      location: `POINT(-122.4862 37.7694)`,
      address: 'Golden Gate Park, San Francisco, CA 94117',
      price_range: 0,
      rating: 4.8,
      reviews_count: 15000,
      hours: {},
      tags: ['parks', 'hiking', 'outdoor', 'free'],
      sponsored_tier: 'organic',
      is_active: true,
    },
    {
      name: 'SFMOMA',
      category: 'museum',
      location: `POINT(-122.4008 37.7857)`,
      address: '151 3rd St, San Francisco, CA 94103',
      price_range: 3,
      rating: 4.6,
      reviews_count: 8900,
      hours: {
        monday: { open: '10:00', close: '17:00' },
        tuesday: { open: '10:00', close: '17:00' },
        wednesday: { open: '10:00', close: '17:00' },
        thursday: { open: '10:00', close: '21:00' },
        friday: { open: '10:00', close: '17:00' },
        saturday: { open: '10:00', close: '17:00' },
        sunday: { open: '10:00', close: '17:00' },
      },
      tags: ['museum', 'art', 'culture'],
      sponsored_tier: 'premium',
      is_active: true,
    },
    {
      name: 'Tartine Bakery',
      category: 'bakery',
      location: `POINT(-122.4207 37.7611)`,
      address: '600 Guerrero St, San Francisco, CA 94110',
      price_range: 2,
      rating: 4.4,
      reviews_count: 4200,
      hours: {
        monday: { open: '08:00', close: '19:00' },
        tuesday: { open: '08:00', close: '19:00' },
        wednesday: { open: '08:00', close: '19:00' },
        thursday: { open: '08:00', close: '19:00' },
        friday: { open: '08:00', close: '19:00' },
        saturday: { open: '08:00', close: '19:00' },
        sunday: { open: '08:00', close: '19:00' },
      },
      tags: ['bakery', 'pastries', 'artisan'],
      sponsored_tier: 'organic',
      is_active: true,
    },
  ];

  const activityIds: string[] = [];

  for (const activity of testActivities) {
    const { data, error } = await supabase
      .from('activities')
      .insert(activity)
      .select('id')
      .single();

    if (error) {
      console.warn(`⚠️ Error seeding activity ${activity.name}: ${error.message}`);
    } else if (data) {
      activityIds.push(data.id);
      console.log(`✅ Seeded activity: ${activity.name}`);
    }
  }

  return activityIds;
}

/**
 * Clean up test activities
 *
 * @param activityIds - Activity IDs to delete
 */
export async function cleanupTestActivities(activityIds: string[]): Promise<void> {
  for (const activityId of activityIds) {
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', activityId);

    if (error) {
      console.warn(`⚠️ Error deleting test activity ${activityId}: ${error.message}`);
    }
  }

  console.log(`✅ Cleaned up ${activityIds.length} test activities`);
}

/**
 * Create test calendar event
 *
 * @param userId - User ID
 * @param eventData - Event data
 * @returns Created event ID
 */
export async function createTestEvent(
  userId: string,
  eventData: Partial<CalendarEvent>
): Promise<string> {
  const defaultEvent = {
    user_id: userId,
    title: 'Test Event',
    location: `POINT(-122.4194 37.7749)`,
    address: '1 Market St, San Francisco, CA 94105',
    start_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    end_time: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
    category: 'personal',
    status: 'scheduled',
    source: 'manual',
  };

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({ ...defaultEvent, ...eventData })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create test event: ${error.message}`);
  }

  return data.id;
}

/**
 * Create test feedback
 *
 * @param userId - User ID
 * @param activityId - Activity ID
 * @param rating - 'thumbs_up' or 'thumbs_down'
 * @param tags - Optional feedback tags
 * @returns Created feedback ID
 */
export async function createTestFeedback(
  userId: string,
  activityId: string,
  rating: 'thumbs_up' | 'thumbs_down',
  tags: string[] = []
): Promise<string> {
  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: userId,
      activity_id: activityId,
      rating,
      feedback_tags: tags,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create test feedback: ${error.message}`);
  }

  return data.id;
}

/**
 * Get test user's AI profile
 *
 * @param userId - User ID
 * @returns AI profile JSON
 */
export async function getTestUserAIProfile(userId: string): Promise<any> {
  const { data, error } = await supabase
    .from('users')
    .select('ai_profile')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to get AI profile: ${error.message}`);
  }

  return data.ai_profile;
}

/**
 * Wait for async operations (useful for testing real-time updates)
 *
 * @param ms - Milliseconds to wait
 */
export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock API response (for selectively mocking expensive APIs)
 *
 * @param apiName - Name of API to mock
 * @param response - Mock response data
 */
export function mockAPIResponse(apiName: string, response: any): void {
  // This can be extended to mock specific API calls if needed
  // For now, we're testing with real APIs
  console.log(`[MOCK] ${apiName}:`, response);
}
