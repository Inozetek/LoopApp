/**
 * Delete User Script
 *
 * This script deletes a user from Supabase auth and the users table.
 * Run with: node scripts/delete-user.js <email>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deleteUser(email) {
  try {
    console.log(`\n🔍 Looking for user with email: ${email}`);

    // Step 1: Find user in auth.users
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const user = users.find(u => u.email === email);

    if (!user) {
      console.log(`⚠️  No user found with email: ${email}`);
      console.log(`\nAvailable users:`);
      users.forEach(u => console.log(`  - ${u.email} (${u.id})`));
      return;
    }

    console.log(`✅ Found user: ${user.email}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Created: ${user.created_at}`);

    // Step 2: Check if user has profile in users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      console.log(`📋 User profile found in database:`);
      console.log(`   Name: ${profile.name || '(not set)'}`);
      console.log(`   Home Address: ${profile.home_address || '(not set)'}`);
      console.log(`   Work Address: ${profile.work_address || '(not set)'}`);
    } else {
      console.log(`📋 No profile found in users table (incomplete signup)`);
    }

    // Step 3: Delete user from auth (this will cascade delete from users table via trigger)
    console.log(`\n🗑️  Deleting user from Supabase Auth...`);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      throw new Error(`Failed to delete user: ${deleteError.message}`);
    }

    console.log(`✅ User deleted successfully!`);
    console.log(`\n✨ You can now sign up with ${email} again.\n`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('\n❌ Error: Please provide an email address');
  console.error('Usage: node scripts/delete-user.js <email>\n');
  console.error('Example: node scripts/delete-user.js user@example.com\n');
  process.exit(1);
}

// Run the delete function
deleteUser(email);
