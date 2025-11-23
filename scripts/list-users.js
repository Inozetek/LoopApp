/**
 * List All Users Script
 *
 * This script lists all users in Supabase auth
 * Run with: node scripts/list-users.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function listUsers() {
  try {
    console.log('\n🔍 Fetching all users from Supabase...\n');

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    if (users.length === 0) {
      console.log('📭 No users found in the database.\n');
      return;
    }

    console.log(`Found ${users.length} user(s):\n`);

    for (const user of users) {
      console.log(`📧 ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log(`   Last Sign In: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`);

      // Check if user has profile
      const { data: profile } = await supabase
        .from('users')
        .select('name, home_address, work_address')
        .eq('id', user.id)
        .single();

      if (profile) {
        console.log(`   Profile: Complete`);
        console.log(`   Name: ${profile.name || '(not set)'}`);
        console.log(`   Home: ${profile.home_address || '(not set)'}`);
        console.log(`   Work: ${profile.work_address || '(not set)'}`);
      } else {
        console.log(`   Profile: ⚠️  INCOMPLETE (stuck in onboarding)`);
      }

      console.log('');
    }

    console.log('To delete a user, run: node scripts/delete-user.js <email>\n');

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

listUsers();
