/**
 * Test Signup Flow End-to-End
 *
 * This script simulates the complete signup and onboarding process to verify:
 * 1. User can sign up
 * 2. Profile is created (either by trigger or UPSERT)
 * 3. Onboarding can complete successfully
 * 4. No infinite redirect loops
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const adminSupabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TEST_EMAIL = 'test@test.com';
const TEST_PASSWORD = 'testpassword123';

async function cleanup() {
  console.log('\n🧹 Cleaning up existing test user...\n');

  try {
    // Always delete from users table first (handles orphaned profiles)
    const { error: deleteError } = await adminSupabase
      .from('users')
      .delete()
      .eq('email', TEST_EMAIL);

    if (deleteError && deleteError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.log(`⚠️  Error deleting from users table: ${deleteError.message}`);
    }

    // Then delete from auth
    const { data: { users } } = await adminSupabase.auth.admin.listUsers();
    const existingUser = users.find(u => u.email === TEST_EMAIL);

    if (existingUser) {
      await adminSupabase.auth.admin.deleteUser(existingUser.id);
      console.log(`✅ Deleted existing user: ${TEST_EMAIL}`);
    } else {
      console.log(`✅ Cleanup complete (no auth user found)`);
    }

    // Wait a moment for cleanup to propagate
    await new Promise(resolve => setTimeout(resolve, 500));

  } catch (error) {
    console.log(`⚠️  Cleanup error (non-critical): ${error.message}`);
  }
}

async function testSignup() {
  console.log('\n📝 Step 1: Testing Signup\n');

  const { data, error } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error) {
    console.error(`❌ Signup failed: ${error.message}`);
    return null;
  }

  if (!data.user) {
    console.error(`❌ Signup succeeded but no user returned`);
    return null;
  }

  console.log(`✅ Signup successful`);
  console.log(`   User ID: ${data.user.id}`);
  console.log(`   Email: ${data.user.email}`);

  return data.user;
}

async function checkProfileCreation(userId) {
  console.log('\n🔍 Step 2: Checking if trigger created profile\n');

  // Wait a moment for trigger to execute
  await new Promise(resolve => setTimeout(resolve, 1000));

  const { data, error } = await adminSupabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error(`❌ Error checking profile: ${error.message}`);
    return false;
  }

  if (data) {
    console.log(`✅ Profile created by trigger!`);
    console.log(`   Name: ${data.name}`);
    console.log(`   Email: ${data.email}`);
    return true;
  } else {
    console.log(`⚠️  No profile found - trigger did NOT create it`);
    console.log(`   This is OK - UPSERT will create it during onboarding`);
    return false;
  }
}

async function simulateOnboarding(userId, session) {
  console.log('\n📋 Step 3: Simulating Onboarding Completion\n');

  // Simulate what updateUserProfile() does with UPSERT
  // Use WKT (Well-Known Text) format for PostGIS geography columns
  const profileData = {
    id: userId,
    email: TEST_EMAIL,
    name: 'Test User',
    interests: ['coffee', 'music', 'hiking'],
    home_address: '123 Test St, Test City, TX 12345',
    home_location: `POINT(-97.7431 30.2672)`, // WKT format for PostGIS
    work_address: '456 Work Ave, Test City, TX 12345',
    work_location: `POINT(-97.7500 30.2700)`, // WKT format for PostGIS
    preferences: {
      budget: 50,
      max_distance_miles: 10,
      preferred_times: ['evening', 'weekend'],
      notification_enabled: true,
    },
    privacy_settings: {
      share_loop_with: 'friends',
      discoverable: true,
      share_location: true,
    }
  };

  console.log('⏳ Executing UPSERT (simulating updateUserProfile)...');

  const { data, error } = await adminSupabase
    .from('users')
    .upsert(profileData, { onConflict: 'id' });

  if (error) {
    console.error(`❌ UPSERT failed: ${error.message}`);
    console.error(`   Details:`, error);
    return false;
  }

  console.log(`✅ UPSERT succeeded`);

  // Verify profile was created/updated
  const { data: profile, error: fetchError } = await adminSupabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError || !profile) {
    console.error(`❌ Profile verification failed: ${fetchError?.message || 'Profile not found'}`);
    return false;
  }

  console.log(`✅ Profile verified in database`);
  console.log(`   Name: ${profile.name}`);
  console.log(`   Interests: ${profile.interests?.join(', ')}`);
  console.log(`   Home: ${profile.home_address}`);

  return true;
}

async function verifyNoLoop(userId) {
  console.log('\n🔄 Step 4: Verifying No Infinite Loop\n');

  // Check that we have BOTH session and user profile
  // This is what the layout checks to determine where to route

  const { data: profile } = await adminSupabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    console.error(`❌ LOOP DETECTED: Profile not found - layout would redirect to onboarding`);
    return false;
  }

  console.log(`✅ No loop: Profile exists, layout will navigate to /(tabs)`);
  return true;
}

async function runTests() {
  console.log('\n========================================');
  console.log('  SIGNUP FLOW END-TO-END TEST');
  console.log('========================================\n');

  try {
    // Step 0: Cleanup
    await cleanup();

    // Step 1: Signup
    const user = await testSignup();
    if (!user) {
      console.log('\n❌ TEST FAILED: Signup failed\n');
      process.exit(1);
    }

    // Step 2: Check if trigger created profile
    const triggerWorked = await checkProfileCreation(user.id);

    // Step 3: Simulate onboarding (UPSERT)
    const onboardingSuccess = await simulateOnboarding(user.id);
    if (!onboardingSuccess) {
      console.log('\n❌ TEST FAILED: Onboarding simulation failed\n');
      process.exit(1);
    }

    // Step 4: Verify no loop
    const noLoop = await verifyNoLoop(user.id);
    if (!noLoop) {
      console.log('\n❌ TEST FAILED: Loop detected\n');
      process.exit(1);
    }

    // Summary
    console.log('\n========================================');
    console.log('  TEST RESULTS');
    console.log('========================================\n');
    console.log(`✅ Signup: SUCCESS`);
    console.log(`${triggerWorked ? '✅' : '⚠️ '} Trigger: ${triggerWorked ? 'WORKING' : 'NOT WORKING (OK - UPSERT handles it)'}`);
    console.log(`✅ UPSERT: SUCCESS`);
    console.log(`✅ Profile Created: SUCCESS`);
    console.log(`✅ No Loop: SUCCESS`);
    console.log('\n✨ ALL TESTS PASSED!\n');
    console.log('📱 You can now test in the mobile app:');
    console.log(`   Email: ${TEST_EMAIL}`);
    console.log(`   Password: ${TEST_PASSWORD}`);
    console.log(`   (Already onboarded - should go straight to feed)\n`);

  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR:', error);
    process.exit(1);
  }
}

runTests();
