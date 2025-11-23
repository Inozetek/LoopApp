/**
 * Check Auth Users Only
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAuthUsers() {
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log(`\nFound ${users.length} auth user(s):\n`);

    for (const user of users) {
      console.log(`Email: ${user.email}`);
      console.log(`ID: ${user.id}`);
      console.log(`Created: ${user.created_at}`);
      console.log(`Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkAuthUsers();
