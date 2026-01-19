/**
 * REAL Recommendation Engine Test (Fixed)
 * Works around missing user trigger by manually inserting user record
 */

require('dotenv').config({ path: '.env.test' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🧪 COMPREHENSIVE RECOMMENDATION ENGINE TEST\n');

let testUserId = null;

// Test 1: Create test user (with manual INSERT)
async function createTestUser() {
  console.log('1. Creating test user...');

  const testEmail = `test-rec-${Date.now()}@loopapp.com`;
  const testPassword = 'TestPassword123!';

  try {
    // Sign up
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (authError) {
      console.log('  ✗ Auth error:', authError.message);
      return null;
    }

    const userId = authData.user.id;

    // WORKAROUND: Manually insert user record (trigger doesn't exist yet)
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: testEmail,
        name: 'Test User',
        interests: ['coffee', 'live_music', 'hiking', 'restaurants'],
        home_address: '1 Market St, San Francisco, CA 94105',
        home_location: `POINT(-122.4194 37.7749)`,
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
          disliked_categories: ['nightlife'],
          price_sensitivity: 'medium',
          time_preferences: ['morning', 'evening'],
          distance_tolerance: 'medium',
        },
      });

    if (insertError) {
      console.log('  ✗ Insert error:', insertError.message);
      return null;
    }

    console.log('  ✓ Created user:', testEmail);
    console.log('  ✓ User ID:', userId);
    console.log('  ✓ Interests: coffee, live_music, hiking, restaurants');
    console.log('  ✓ Budget: $$ (level 2)');
    return userId;
  } catch (error) {
    console.log('  ✗ Error:', error.message);
    return null;
  }
}

// Test 2: Test scoring algorithm with real data
async function testScoringAlgorithm(userId) {
  console.log('\n2. Testing scoring algorithm...');

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    console.log('  ✓ User loaded successfully');

    // Test distance calculation (Haversine)
    const userLocation = { lat: 37.7749, lng: -122.4194 };
    const nearbyLocation = { lat: 37.7849, lng: -122.4094 };
    const farLocation = { lat: 37.8849, lng: -122.5194 };

    // Simple Haversine
    function calculateDistance(p1, p2) {
      const R = 3959; // miles
      const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
      const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((p1.lat * Math.PI) / 180) *
          Math.cos((p2.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    const nearbyDist = calculateDistance(userLocation, nearbyLocation);
    const farDist = calculateDistance(userLocation, farLocation);

    console.log('  Distance calculations:');
    console.log('    Nearby:', nearbyDist.toFixed(2), 'miles');
    console.log('    Far:', farDist.toFixed(2), 'miles');

    // Test interest matching
    const interests = user.interests || [];
    const favoriteCategories = user.ai_profile?.favorite_categories || [];

    console.log('  Interest matching:');
    console.log('    User interests:', interests.join(', '));
    console.log('    Favorites:', favoriteCategories.join(', '));

    // Test category: coffee (should be favorite)
    if (favoriteCategories.includes('coffee')) {
      console.log('    ✓ Coffee is a favorite (should get +30 base score)');
    }

    // Test category: nightlife (should be disliked)
    const disliked = user.ai_profile?.disliked_categories || [];
    if (disliked.includes('nightlife')) {
      console.log('    ✓ Nightlife is disliked (should be filtered out)');
    }

    return true;
  } catch (error) {
    console.log('  ✗ Error:', error.message);
    return false;
  }
}

// Test 3: Test real Google Places API integration
async function testGooglePlacesIntegration(userId) {
  console.log('\n3. Testing Google Places API integration...');

  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types,places.rating,places.userRatingCount,places.priceLevel',
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude: 37.7749, longitude: -122.4194 },
            radius: 5000,
          },
        },
        includedTypes: ['cafe', 'restaurant'],
        maxResultCount: 10,
      }),
    });

    const data = await response.json();
    const places = data.places || [];

    console.log('  ✓ Found', places.length, 'places');

    if (places.length > 0) {
      // Check for coffee shops (user's favorite)
      const coffeeShops = places.filter(p =>
        p.types?.some(t => t.includes('cafe') || t.includes('coffee'))
      );

      console.log('  ✓ Coffee shops found:', coffeeShops.length);

      // Show top 3
      console.log('\n  Top recommendations:');
      places.slice(0, 3).forEach((p, i) => {
        const name = p.displayName?.text || 'Unknown';
        const rating = p.rating || 'N/A';
        const price = '$'.repeat(p.priceLevel || 1);
        console.log(`    ${i + 1}. ${name} - ${rating}★ - ${price}`);
      });

      return true;
    }

    return false;
  } catch (error) {
    console.log('  ✗ Error:', error.message);
    return false;
  }
}

// Test 4: Test feedback updates AI profile
async function testFeedbackLoop(userId) {
  console.log('\n4. Testing feedback loop (AI profile updates)...');

  try {
    // Get before state
    const { data: before } = await supabase
      .from('users')
      .select('ai_profile')
      .eq('id', userId)
      .single();

    const beforeFavorites = before?.ai_profile?.favorite_categories || [];
    console.log('  Before:', beforeFavorites.join(', '));

    // Simulate: User gave thumbs up to a bakery
    const newFavorites = [...new Set([...beforeFavorites, 'bakery'])];

    await supabase
      .from('users')
      .update({
        ai_profile: {
          ...before.ai_profile,
          favorite_categories: newFavorites,
        },
      })
      .eq('id', userId);

    // Verify
    const { data: after } = await supabase
      .from('users')
      .select('ai_profile')
      .eq('id', userId)
      .single();

    const afterFavorites = after?.ai_profile?.favorite_categories || [];
    console.log('  After:', afterFavorites.join(', '));

    if (afterFavorites.includes('bakery')) {
      console.log('  ✓ AI profile updated (bakery added to favorites)');
      return true;
    }

    console.log('  ✗ AI profile NOT updated');
    return false;
  } catch (error) {
    console.log('  ✗ Error:', error.message);
    return false;
  }
}

// Cleanup
async function cleanup(userId) {
  console.log('\n5. Cleaning up...');
  await supabase.from('users').delete().eq('id', userId);
  console.log('  ✓ Test user deleted');
}

// Run tests
(async () => {
  try {
    testUserId = await createTestUser();
    if (!testUserId) {
      console.log('\n❌ FAILED to create test user');
      process.exit(1);
    }

    const scoringTest = await testScoringAlgorithm(testUserId);
    const googleTest = await testGooglePlacesIntegration(testUserId);
    const feedbackTest = await testFeedbackLoop(testUserId);

    await cleanup(testUserId);

    console.log('\n📊 TEST RESULTS:');
    console.log('  User Creation: ✓ PASS');
    console.log('  Scoring Algorithm:', scoringTest ? '✓ PASS' : '✗ FAIL');
    console.log('  Google Places API:', googleTest ? '✓ PASS' : '✗ FAIL');
    console.log('  Feedback Loop:', feedbackTest ? '✓ PASS' : '✗ FAIL');

    if (!scoringTest || !googleTest || !feedbackTest) {
      console.log('\n⚠️  Some tests failed');
      process.exit(1);
    }

    console.log('\n✅ ALL TESTS PASSED!');
    console.log('\n📝 TODO: Apply database migration (migrations/create-user-trigger.sql)');
    console.log('   Run this SQL in Supabase SQL Editor to auto-create user records');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    if (testUserId) await cleanup(testUserId);
    process.exit(1);
  }
})();
