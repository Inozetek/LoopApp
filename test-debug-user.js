require('dotenv').config({ path: '.env.test' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  console.log('Debugging user creation...\n');

  const testEmail = `test-debug-${Date.now()}@loopapp.com`;

  // Step 1: Sign up
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: 'TestPassword123!',
  });

  if (authError) {
    console.log('Auth error:', authError);
    return;
  }

  const userId = authData.user.id;
  console.log('Created auth user:', userId);

  // Step 2: Check if user row exists in users table
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId);

  console.log('\nUsers table check:');
  console.log('  Error:', checkError);
  console.log('  Found rows:', existingUser?.length);
  console.log('  Data:', existingUser);

  // Step 3: Try update
  const { data: updateData, error: updateError } = await supabase
    .from('users')
    .update({ name: 'Test User' })
    .eq('id', userId)
    .select();

  console.log('\nUpdate attempt:');
  console.log('  Error:', updateError);
  console.log('  Data:', updateData);

  // Cleanup
  await supabase.from('users').delete().eq('id', userId);
  console.log('\nCleaned up test user');
})();
