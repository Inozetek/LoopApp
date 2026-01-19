/**
 * Check Places Cache Status
 *
 * This script checks if the places_cache table has any data and displays statistics.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCacheStatus() {
  console.log('📊 Checking Places Cache Status...\n');

  try {
    // Check total places count
    const { count: totalPlaces, error: countError } = await supabase
      .from('places_cache')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error checking cache:', countError);
      process.exit(1);
    }

    console.log(`📍 Total cached places: ${totalPlaces || 0}`);

    if (!totalPlaces || totalPlaces === 0) {
      console.log('\n⚠️  Cache is EMPTY - No places cached yet');
      console.log('\nThis explains why performance is slow.');
      console.log('\nReasons cache might be empty:');
      console.log('  1. RLS migration not run (run database/migrations/022_temp_rls_fix.sql)');
      console.log('  2. City seeding failed (check app logs for errors)');
      console.log('  3. Database connection issues');
      console.log('\nNext steps:');
      console.log('  1. Run: node scripts/run-rls-temp-fix.js (or run migration manually in Supabase SQL Editor)');
      console.log('  2. Restart app and wait for "Setting up recommendations for {city}..." message');
      console.log('  3. Let seeding complete (1-2 minutes)');
      console.log('  4. Run this script again to verify cache populated');
      return;
    }

    // Get cities breakdown
    const { data: places, error: placesError } = await supabase
      .from('places_cache')
      .select('city, state, category');

    if (placesError) {
      console.error('❌ Error fetching places:', placesError);
      process.exit(1);
    }

    // Group by city
    const citiesMap = new Map();
    places.forEach(place => {
      const cityKey = `${place.city}, ${place.state}`;
      if (!citiesMap.has(cityKey)) {
        citiesMap.set(cityKey, {
          name: cityKey,
          count: 0,
          categories: new Set()
        });
      }
      const cityData = citiesMap.get(cityKey);
      cityData.count++;
      if (place.category) {
        cityData.categories.add(place.category);
      }
    });

    console.log('\n📊 Cache Breakdown by City:\n');
    citiesMap.forEach((cityData) => {
      console.log(`  ${cityData.name}:`);
      console.log(`    - ${cityData.count} places`);
      console.log(`    - ${cityData.categories.size} categories: ${Array.from(cityData.categories).join(', ')}`);
      console.log('');
    });

    // Check for stale places
    const { count: stalePlaces, error: staleError } = await supabase
      .from('places_cache')
      .select('*', { count: 'exact', head: true })
      .eq('is_stale', true);

    if (!staleError) {
      console.log(`🔄 Stale places: ${stalePlaces || 0}`);
    }

    // Check RLS policies
    console.log('\n🔒 Checking RLS Policies...');
    const { data: policies, error: policyError } = await supabase
      .rpc('get_policies_for_table', { table_name: 'places_cache' })
      .maybeSingle();

    if (policyError) {
      console.log('  ⚠️  Could not check RLS policies (this is OK)');
    }

    console.log('\n✅ Cache check complete!');
    console.log('\nPerformance expectations:');
    if (totalPlaces > 0) {
      console.log('  ✅ First load should be fast (database query <100ms)');
      console.log('  ✅ Subsequent loads should use cached data');
      console.log('  ✅ No Google Places API calls after cache is populated');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkCacheStatus().catch(console.error);
