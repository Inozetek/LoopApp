/**
 * Check User Profile Details
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

async function checkProfile(email) {
  try {
    // Get auth user
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const authUser = users.find(u => u.email === email);

    if (!authUser) {
      console.log('No auth user found');
      return;
    }

    console.log('Auth User:', authUser.id);

    // Get profile
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    console.log('\nProfile Data:');
    console.log(JSON.stringify(profile, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

checkProfile('nick_casey@icloud.com');
