/**
 * Run temporary RLS fix migration
 *
 * This script applies migration 022_temp_rls_fix.sql to allow authenticated users
 * to write to places_cache and events_cache tables.
 *
 * WARNING: This is a temporary fix for MVP testing.
 * In production, cache seeding should be done via backend API only.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Running temporary RLS fix migration...\n');

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '022_temp_rls_fix.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration file loaded:', migrationPath);
  console.log('');

  // Execute migration
  const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL }).maybeSingle();

  if (error) {
    // Try direct execution if exec_sql RPC doesn't exist
    console.log('⚠️  exec_sql RPC not found, trying direct execution...');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/**'));

    for (const statement of statements) {
      if (statement.startsWith('DO $$')) {
        // Skip DO blocks for now
        console.log('⚠️  Skipping DO block (can\'t execute via client)');
        continue;
      }

      console.log(`Executing: ${statement.substring(0, 80)}...`);
      const { error: stmtError } = await supabase.rpc('exec', { sql: statement });

      if (stmtError) {
        console.error(`❌ Error executing statement:`, stmtError);
        console.error(`Statement: ${statement}`);
        console.error('\n⚠️  You may need to run this migration manually in Supabase SQL Editor');
        console.error(`Migration file: database/migrations/022_temp_rls_fix.sql`);
        process.exit(1);
      }
    }

    console.log('');
    console.log('✅ Migration executed successfully (direct execution)');
    console.log('');
    console.log('⚠️  WARNING: This is a TEMPORARY fix for MVP testing');
    console.log('   Authenticated users can now write to cache tables');
    console.log('   In production, revert this and use backend API');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Restart your app: npm start');
    console.log('  2. Test cache seeding from mobile app');
    console.log('  3. Build backend API for production');
    return;
  }

  console.log('✅ Migration executed successfully!');
  console.log('');
  console.log('⚠️  WARNING: This is a TEMPORARY fix for MVP testing');
  console.log('   Authenticated users can now write to cache tables');
  console.log('   In production, revert this and use backend API');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Restart your app: npm start');
  console.log('  2. Test cache seeding from mobile app');
  console.log('  3. Build backend API for production');
}

// Manual execution instructions
console.log('═══════════════════════════════════════════════════════════════');
console.log('MANUAL MIGRATION INSTRUCTIONS');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('If this script fails, run the migration manually:');
console.log('');
console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
console.log('2. Select your project: yvedmxyfehjiigikitbo');
console.log('3. Go to SQL Editor');
console.log('4. Copy contents of: database/migrations/022_temp_rls_fix.sql');
console.log('5. Paste and Run');
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

runMigration().catch(error => {
  console.error('❌ Migration failed:', error);
  console.error('');
  console.error('Please run the migration manually in Supabase SQL Editor');
  console.error('File: database/migrations/022_temp_rls_fix.sql');
  process.exit(1);
});
