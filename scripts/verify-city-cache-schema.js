/**
 * Verify City Cache Schema
 *
 * Tests that the city-based caching tables were created correctly
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
  console.log('🔍 Verifying city-based caching schema...\n');

  // Test 1: Check places_cache table exists
  console.log('1️⃣ Testing places_cache table...');
  const { data: placesData, error: placesError } = await supabase
    .from('places_cache')
    .select('*')
    .limit(1);

  if (placesError) {
    console.error('❌ places_cache table error:', placesError.message);
    return false;
  }
  console.log('✅ places_cache table exists');

  // Test 2: Check events_cache table exists
  console.log('\n2️⃣ Testing events_cache table...');
  const { data: eventsData, error: eventsError } = await supabase
    .from('events_cache')
    .select('*')
    .limit(1);

  if (eventsError) {
    console.error('❌ events_cache table error:', eventsError.message);
    return false;
  }
  console.log('✅ events_cache table exists');

  // Test 3: Check users table has new demographic fields
  console.log('\n3️⃣ Testing users table demographic fields...');
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('date_of_birth, gender')
    .limit(1);

  if (userError) {
    console.error('❌ users table error:', userError.message);
    return false;
  }
  console.log('✅ users table has date_of_birth and gender columns');

  // Test 4: Test helper function exists (check_city_cache)
  console.log('\n4️⃣ Testing helper functions...');
  const { data: functionData, error: functionError } = await supabase
    .rpc('check_city_cache', {
      p_city: 'Dallas',
      p_state: 'TX',
      p_refresh_days: 60
    });

  if (functionError) {
    console.error('❌ check_city_cache function error:', functionError.message);
    return false;
  }
  console.log('✅ check_city_cache function works');
  console.log('   Result:', functionData);

  console.log('\n✅ All schema verification tests passed!\n');
  return true;
}

verifySchema()
  .then(success => {
    if (success) {
      console.log('🎉 City-based caching schema is ready to use!');
      process.exit(0);
    } else {
      console.log('❌ Schema verification failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Verification script error:', error);
    process.exit(1);
  });
