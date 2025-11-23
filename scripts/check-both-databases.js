/**
 * Check Both Supabase Databases
 */

const { createClient } = require('@supabase/supabase-js');

// Database 1 (NEW - should be using this)
const supabase1 = createClient(
  'https://yvedmxyfehjiigikitbo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2ZWRteHlmZWhqaWlnaWtpdGJvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI4ODgyMCwiZXhwIjoyMDc1ODY0ODIwfQ.tfGsb5ozoqUlo4jyv-_1meBAR50sas8m07VuB9188Vo',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Database 2 (OLD)
const supabase2 = createClient(
  'https://qcjyatstnnalxxugfwqy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjanlhdHN0bm5hbHh4dWdmd3F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDgxNzMsImV4cCI6MjA3NjU4NDE3M30.KH8g7-k4fahc0ysUS73btM7DYWcS_Hco4IaiewIP7XE',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkBoth() {
  console.log('\n=== CHECKING DATABASE 1 (NEW - yvedmxyfehjiigikitbo) ===\n');

  const { data: { users: users1 } } = await supabase1.auth.admin.listUsers();
  console.log(`Auth users: ${users1.length}`);
  if (users1.length > 0) {
    users1.forEach(u => console.log(`  - ${u.email}`));
  }

  console.log('\n=== CHECKING DATABASE 2 (OLD - qcjyatstnnalxxugfwqy) ===\n');

  const { data: { users: users2 } } = await supabase2.auth.admin.listUsers();
  console.log(`Auth users: ${users2.length}`);
  if (users2.length > 0) {
    users2.forEach(u => console.log(`  - ${u.email}`));
  }

  console.log('\n');
}

checkBoth();
