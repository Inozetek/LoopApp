/**
 * Test Cache INSERT Permissions
 *
 * This script tests if authenticated users can actually insert into places_cache.
 * It also clears any existing data and performs a test insert.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Create client (simulating app client)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCacheInsert() {
  console.log('🧪 Testing Cache INSERT Permissions...\n');

  try {
    // Step 1: Get current user (you must be logged in)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ Not authenticated');
      console.error('You need to be logged into the app first.');
      console.error('Open the app, log in, then run this script again.');
      process.exit(1);
    }

    console.log(`✅ Authenticated as: ${user.email}`);

    // Step 2: Check current cache count
    const { count: beforeCount } = await supabase
      .from('places_cache')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Current cache count: ${beforeCount || 0} places\n`);

    // Step 3: Try to insert a test record
    console.log('🧪 Attempting test INSERT...');

    const testRecord = {
      city: 'Test City',
      state: 'TX',
      lat: 32.7767,
      lng: -96.7970,
      place_id: `test_${Date.now()}`,
      place_data: {
        name: 'Test Place',
        category: 'restaurant',
        rating: 4.5,
        location: { latitude: 32.7767, longitude: -96.7970 }
      },
      category: 'restaurant',
      cached_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
      use_count: 0,
      is_stale: false,
      refresh_cadence_days: 60
    };

    const { data: insertData, error: insertError } = await supabase
      .from('places_cache')
      .insert(testRecord)
      .select();

    if (insertError) {
      console.error('❌ INSERT FAILED:', insertError);
      console.error('\nDiagnosis:');
      if (insertError.code === '42501') {
        console.error('  RLS Policy Error: Authenticated users cannot INSERT');
        console.error('\nFix:');
        console.error('  1. Open Supabase Dashboard SQL Editor');
        console.error('  2. Run this command:');
        console.error('');
        console.error('     DROP POLICY IF EXISTS "Service role can insert places cache" ON places_cache;');
        console.error('     DROP POLICY IF EXISTS "Authenticated users can insert places cache (TEMP)" ON places_cache;');
        console.error('     ');
        console.error('     CREATE POLICY "Authenticated users can insert places cache (TEMP)"');
        console.error('       ON places_cache');
        console.error('       FOR INSERT');
        console.error('       TO authenticated');
        console.error('       WITH CHECK (true);');
        console.error('');
      } else {
        console.error(`  Unknown error code: ${insertError.code}`);
        console.error(`  Message: ${insertError.message}`);
      }
      process.exit(1);
    }

    console.log('✅ INSERT SUCCESSFUL!');
    console.log('Inserted record:', JSON.stringify(insertData, null, 2));

    // Step 4: Verify record was inserted
    const { count: afterCount } = await supabase
      .from('places_cache')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 After INSERT: ${afterCount} places (+${afterCount - beforeCount})`);

    // Step 5: Clean up test record
    console.log('\n🧹 Cleaning up test record...');
    const { error: deleteError } = await supabase
      .from('places_cache')
      .delete()
      .eq('place_id', testRecord.place_id);

    if (deleteError) {
      console.warn('⚠️  Could not delete test record (this is OK):', deleteError.message);
    } else {
      console.log('✅ Test record deleted');
    }

    console.log('\n✅ TEST PASSED!');
    console.log('\n✅ Authenticated users CAN insert into places_cache');
    console.log('✅ Cache seeding should work now');
    console.log('\nNext steps:');
    console.log('  1. Restart your app: npm start');
    console.log('  2. Open feed and wait for "Setting up recommendations for {city}..."');
    console.log('  3. Let cache seed complete (1-2 minutes)');
    console.log('  4. Run: node scripts/check-cache-status.js');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

testCacheInsert().catch(console.error);
