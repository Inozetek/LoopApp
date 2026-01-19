const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

const sql = fs.readFileSync('migrations/create-user-trigger.sql', 'utf8');

console.log('Applying migration: create-user-trigger.sql\n');
console.log('SQL:', sql);
console.log('\nNote: Run this via Supabase SQL Editor with SUPERUSER privileges');
console.log('Anon key cannot create triggers - need service role key or SQL editor');
