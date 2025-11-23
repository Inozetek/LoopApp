/**
 * Verify Database Trigger Setup
 *
 * This script checks if the handle_new_user trigger is properly configured.
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verifyTrigger() {
  console.log('\n🔍 Verifying Database Trigger Setup\n');

  console.log('📋 To manually run the migration in Supabase:');
  console.log('1. Go to: https://supabase.com/dashboard');
  console.log('2. Select your project → SQL Editor');
  console.log('3. Paste contents of: database/migrations/011_fix_user_creation.sql');
  console.log('4. Click "Run"\n');

  console.log('⏳ Checking trigger status...\n');

  try {
    // Try to query the trigger (this may fail due to permissions)
    const { data, error } = await supabase
      .rpc('exec', {
        query: `
          SELECT trigger_name, event_object_table, action_statement
          FROM information_schema.triggers
          WHERE trigger_name = 'on_auth_user_created';
        `
      });

    if (error) {
      console.log('⚠️  Cannot verify trigger programmatically (permission limitation)');
      console.log('   Please manually verify in Supabase SQL Editor with this query:');
      console.log('   SELECT * FROM information_schema.triggers WHERE trigger_name = \'on_auth_user_created\';');
    } else {
      if (data && data.length > 0) {
        console.log('✅ Trigger found: on_auth_user_created');
        console.log('   Table:', data[0].event_object_table);
      } else {
        console.log('❌ Trigger NOT found: on_auth_user_created');
        console.log('   Please run the migration in Supabase SQL Editor!');
      }
    }
  } catch (err) {
    console.log('⚠️  Error checking trigger:', err.message);
    console.log('   Continuing with manual verification recommended...');
  }

  console.log('\n✅ Next: Test signup to verify trigger works\n');
}

verifyTrigger();
