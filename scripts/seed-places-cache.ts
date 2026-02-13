/**
 * Seed Places Cache Script
 *
 * This script populates the places_cache table with pre-fetched test data
 * for development/testing without making any Google Places API calls.
 *
 * Usage:
 *   npx ts-node scripts/seed-places-cache.ts
 *   # or
 *   npx tsx scripts/seed-places-cache.ts
 *
 * Prerequisites:
 *   - SUPABASE_SERVICE_ROLE_KEY must be set in .env.local
 *   - places_cache table must exist (run migration 021)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables:');
  console.error('  EXPO_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? 'set' : 'MISSING');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? 'set' : 'MISSING');
  process.exit(1);
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface Place {
  place_id: string;
  name: string;
  formatted_address: string;
  vicinity?: string;
  types: string[];
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: { open_now?: boolean };
  photos?: { photo_reference: string }[];
  category?: string;
}

interface TestDataFile {
  metadata: {
    city: string;
    state: string;
    generated_at: string;
    total_places: number;
    center_lat: number;
    center_lng: number;
    description: string;
  };
  places: Place[];
}

async function seedPlacesCache() {
  console.log('='.repeat(60));
  console.log('Places Cache Seeder');
  console.log('='.repeat(60));
  console.log('');

  // Read test data file
  const testDataPath = path.join(__dirname, '..', 'test-data', 'dallas-places.json');

  if (!fs.existsSync(testDataPath)) {
    console.error(`Test data file not found: ${testDataPath}`);
    console.error('Please create test-data/dallas-places.json first.');
    process.exit(1);
  }

  console.log(`Reading test data from: ${testDataPath}`);
  const rawData = fs.readFileSync(testDataPath, 'utf-8');
  const testData: TestDataFile = JSON.parse(rawData);

  console.log(`City: ${testData.metadata.city}, ${testData.metadata.state}`);
  console.log(`Total places to seed: ${testData.places.length}`);
  console.log('');

  // Check current cache state
  const { data: existingCache, error: checkError } = await supabase
    .from('places_cache')
    .select('id, place_id')
    .eq('city', testData.metadata.city)
    .eq('state', testData.metadata.state);

  if (checkError) {
    console.error('Error checking existing cache:', checkError);
    process.exit(1);
  }

  console.log(`Existing cache entries for ${testData.metadata.city}: ${existingCache?.length || 0}`);

  // Option to clear existing cache
  if (existingCache && existingCache.length > 0) {
    console.log('Clearing existing cache entries...');
    const { error: deleteError } = await supabase
      .from('places_cache')
      .delete()
      .eq('city', testData.metadata.city)
      .eq('state', testData.metadata.state);

    if (deleteError) {
      console.error('Error clearing cache:', deleteError);
      process.exit(1);
    }
    console.log(`Deleted ${existingCache.length} existing entries.`);
    console.log('');
  }

  // Prepare cache entries
  const cacheEntries = testData.places.map((place) => ({
    city: testData.metadata.city,
    state: testData.metadata.state,
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng,
    place_id: place.place_id,
    place_data: {
      place_id: place.place_id,
      name: place.name,
      formatted_address: place.formatted_address,
      vicinity: place.vicinity,
      types: place.types,
      geometry: place.geometry,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      price_level: place.price_level,
      opening_hours: place.opening_hours,
      photos: place.photos,
    },
    category: place.category || place.types[0] || 'other',
    cached_at: new Date().toISOString(),
    last_used: new Date().toISOString(),
    use_count: 0,
    is_stale: false,
    refresh_cadence_days: 60,
  }));

  // Insert in batches of 20 to avoid timeouts
  const BATCH_SIZE = 20;
  let successCount = 0;
  let errorCount = 0;

  console.log('Inserting cache entries...');
  console.log('');

  for (let i = 0; i < cacheEntries.length; i += BATCH_SIZE) {
    const batch = cacheEntries.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(cacheEntries.length / BATCH_SIZE);

    process.stdout.write(`Batch ${batchNum}/${totalBatches}: `);

    const { data, error } = await supabase.from('places_cache').insert(batch).select('id');

    if (error) {
      console.log(`ERROR - ${error.message}`);
      errorCount += batch.length;
    } else {
      console.log(`OK (${data?.length || 0} inserted)`);
      successCount += data?.length || 0;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Seeding Complete!');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Successfully inserted: ${successCount} places`);
  console.log(`Errors: ${errorCount} places`);
  console.log('');

  // Verify the cache
  const { data: verifyData, count } = await supabase
    .from('places_cache')
    .select('*', { count: 'exact' })
    .eq('city', testData.metadata.city)
    .eq('state', testData.metadata.state)
    .limit(5);

  console.log(`Verification: ${count} total entries in cache for ${testData.metadata.city}`);
  console.log('');
  console.log('Sample entries:');
  verifyData?.slice(0, 3).forEach((entry, i) => {
    const placeData = entry.place_data as any;
    console.log(`  ${i + 1}. ${placeData.name} (${entry.category})`);
    console.log(`     Rating: ${placeData.rating}, Photos: ${placeData.photos?.length || 0}`);
  });

  console.log('');
  console.log('Next steps:');
  console.log('  1. Ensure EXPO_PUBLIC_DISABLE_GOOGLE_PLACES_API=true in .env.local');
  console.log('  2. Restart your Expo development server: npx expo start --clear');
  console.log('  3. The app should now load recommendations from cache (zero API calls)');
  console.log('');
}

// Run the seeder
seedPlacesCache().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
