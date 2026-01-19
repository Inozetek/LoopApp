/**
 * Daily Recommendation Generation Script
 *
 * Generates personalized recommendations for all active users once per day.
 * This populates the recommendation_tracking table in Supabase.
 *
 * Usage:
 *   npx ts-node scripts/generate-daily-recommendations.ts
 *
 * Schedule:
 *   Run daily at 3am via cron job or GitHub Actions
 */

// Load environment variables from .env.local
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Import services (using dynamic imports to handle path resolution)
async function loadServices() {
  const { generateRecommendations } = await import('../services/recommendations');
  const { saveRecommendationsToDB, clearPendingRecommendations } = await import('../services/recommendation-persistence');
  return { generateRecommendations, saveRecommendationsToDB, clearPendingRecommendations };
}

// Remove UserRecord interface - we'll use the full user type from Supabase

async function generateDailyRecommendations() {
  console.log('🚀 Starting daily recommendation generation...');
  console.log(`📅 Date: ${new Date().toISOString()}`);

  // Load services
  const { generateRecommendations, saveRecommendationsToDB, clearPendingRecommendations } = await loadServices();

  // 1. Fetch all active users (with all fields required by generateRecommendations)
  const { data: users, error } = await supabase
    .from('users')
    .select('*') // Fetch all fields to match expected user type
    .is('subscription_status', null) // Accept null or active status
    .limit(1000); // Process max 1000 users per run

  if (error) {
    console.error('❌ Failed to fetch users:', error);
    return;
  }

  if (!users || users.length === 0) {
    console.log('📭 No users found');
    return;
  }

  console.log(`👥 Found ${users.length} users`);

  // 2. For each user, generate recommendations
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  const startTime = Date.now();

  for (const user of users as any[]) {
    try {
      console.log(`\n📍 Processing user: ${user.email}`);

      // Clear old recommendations
      await clearPendingRecommendations(user.id);
      console.log(`  🧹 Cleared old recommendations`);

      // Get user's home location
      const homeLocation = user.home_location?.coordinates
        ? { lat: user.home_location.coordinates[1], lng: user.home_location.coordinates[0] }
        : undefined;

      const workLocation = user.work_location?.coordinates
        ? { lat: user.work_location.coordinates[1], lng: user.work_location.coordinates[0] }
        : undefined;

      if (!homeLocation) {
        console.log(`  ⚠️ No home location set, skipping...`);
        skippedCount++;
        continue;
      }

      // Generate recommendations
      const params = {
        user,
        userLocation: homeLocation, // Use home as default
        homeLocation,
        workLocation,
        maxDistance: user.preferences?.max_distance_miles || 10,
        maxResults: 20, // Generate 20 per user per day
      };

      console.log(`  🔍 Generating recommendations...`);
      const scored = await generateRecommendations(params);

      if (scored.length === 0) {
        console.log(`  ⚠️ No recommendations generated, skipping...`);
        skippedCount++;
        continue;
      }

      // Convert to Recommendation format
      const recommendations = scored.map((s: any, index: number) => ({
        id: s.place.place_id || `rec-${index}`,
        title: s.place.name,
        category: s.category,
        location: s.place.vicinity || s.place.formatted_address || '',
        distance: `${s.distance.toFixed(1)} mi`,
        priceRange: s.place.price_level || 2,
        rating: s.place.rating || 0,
        imageUrl: s.photoUrl || '',
        photos: s.photoUrls,
        aiExplanation: s.aiExplanation,
        description: s.place.description,
        openNow: s.place.opening_hours?.open_now,
        isSponsored: s.isSponsored,
        score: s.score,
        businessHours: s.businessHours,
        hasEstimatedHours: s.hasEstimatedHours,
        suggestedTime: s.suggestedTime,
        event_metadata: s.place.event_metadata,
        scoreBreakdown: {
          baseScore: s.scoreBreakdown.baseScore,
          locationScore: s.scoreBreakdown.locationScore,
          timeScore: s.scoreBreakdown.timeScore,
          feedbackScore: s.scoreBreakdown.feedbackScore,
          collaborativeScore: s.scoreBreakdown.collaborativeScore,
          sponsorBoost: s.scoreBreakdown.sponsoredBoost,
          finalScore: s.scoreBreakdown.finalScore,
        },
        activity: {
          id: s.place.place_id || `act-${index}`,
          name: s.place.name,
          category: s.category,
          description: s.place.description,
          location: {
            latitude: s.place.geometry.location.lat,
            longitude: s.place.geometry.location.lng,
            address: s.place.vicinity || s.place.formatted_address || '',
          },
          distance: s.distance,
          rating: s.place.rating,
          reviewsCount: s.place.user_ratings_total,
          priceRange: s.place.price_level || 2,
          photoUrl: s.photoUrl,
          phone: s.place.formatted_phone_number,
          website: s.place.website,
          googlePlaceId: s.place.place_id,
        },
      }));

      // Save to database
      await saveRecommendationsToDB(user.id, recommendations);

      console.log(`  ✅ Saved ${recommendations.length} recommendations`);
      successCount++;

      // Rate limiting: Wait 1 second between users to avoid API throttling
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}`);
      failCount++;
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(1); // minutes

  console.log(`\n📊 Daily generation complete!`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log(`✅ Success: ${successCount} users`);
  console.log(`⚠️  Skipped: ${skippedCount} users (no home location or no results)`);
  console.log(`❌ Failed: ${failCount} users`);
  console.log(`💰 Estimated API calls: ~${successCount * 5} (avg 5 per user)`);
  console.log(`\n🎯 Users can now open the Loop app and see fresh recommendations!`);
}

// Run the script
generateDailyRecommendations()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
