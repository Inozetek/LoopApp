/**
 * Set home_location for test user to Dallas, TX
 * This allows testing city-based caching without having to go through onboarding
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setTestUserLocation() {
  console.log('🔧 Setting home_location for test user...\n');

  const testEmail = 't4@test.com';

  // Dallas, TX coordinates
  const dallasLat = 32.7767;
  const dallasLng = -96.7970;

  console.log(`📍 Setting location for ${testEmail}:`);
  console.log(`   City: Dallas, TX`);
  console.log(`   Coordinates: ${dallasLat}, ${dallasLng}\n`);

  // Update user's home_location using PostGIS
  const { data, error } = await supabase.rpc('set_user_home_location', {
    p_email: testEmail,
    p_latitude: dallasLat,
    p_longitude: dallasLng
  });

  if (error) {
    // If RPC function doesn't exist, use raw SQL
    console.log('⚠️ RPC function not found, using direct update...');

    const { error: updateError } = await supabase
      .from('users')
      .update({
        home_location: `POINT(${dallasLng} ${dallasLat})` // PostGIS format: POINT(lng lat)
      })
      .eq('email', testEmail);

    if (updateError) {
      console.error('❌ Error updating home_location:', updateError);
      process.exit(1);
    }
  }

  // Verify update
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('email, home_location')
    .eq('email', testEmail)
    .single();

  if (fetchError) {
    console.error('❌ Error fetching user:', fetchError);
    process.exit(1);
  }

  console.log('✅ Successfully updated home_location!');
  console.log('📍 User data:', JSON.stringify(user, null, 2));
  console.log('\n✅ Test user is now ready for city-based caching!');
  console.log('🔄 Restart the app to see "Setting up recommendations for Dallas..."');
}

setTestUserLocation().catch(console.error);
