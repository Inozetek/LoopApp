/**
 * Run Database Migration 011 - Fix User Creation Trigger
 *
 * This script ensures the database trigger is properly set up to create
 * user profiles when new auth users sign up.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function runMigration() {
  console.log('\n🔧 Running Migration 011: Fix User Creation Trigger\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '011_fix_user_creation.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL loaded');
    console.log('⏳ Executing migration...\n');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // If exec_sql doesn't exist, try direct execution
      if (error.message.includes('function public.exec_sql')) {
        console.log('⚠️  exec_sql function not found, executing statements individually...\n');

        // Split by semicolon and execute each statement
        const statements = migrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s && !s.startsWith('--'));

        for (const statement of statements) {
          console.log(`Executing: ${statement.substring(0, 50)}...`);
          const { error: stmtError } = await supabase.rpc('exec', { query: statement });
          if (stmtError) {
            console.error(`❌ Error executing statement: ${stmtError.message}`);
          } else {
            console.log('✅ Success');
          }
        }
      } else {
        throw error;
      }
    } else {
      console.log('✅ Migration executed successfully\n');
    }

    // Verify the trigger was created
    console.log('🔍 Verifying trigger installation...\n');

    const { data: triggers, error: triggerError } = await supabase
      .from('information_schema.triggers')
      .select('*')
      .eq('trigger_name', 'on_auth_user_created');

    if (triggerError) {
      console.log('⚠️  Could not verify trigger (this might be a permission issue)');
      console.log('   Please manually verify in Supabase SQL Editor:');
      console.log('   SELECT * FROM information_schema.triggers WHERE trigger_name = \'on_auth_user_created\';');
    } else if (!triggers || triggers.length === 0) {
      console.log('⚠️  Trigger not found! Migration may have failed.');
      console.log('   Please run the migration manually in Supabase SQL Editor.');
    } else {
      console.log('✅ Trigger verified: on_auth_user_created exists\n');
    }

    console.log('\n✨ Migration complete!\n');
    console.log('Next steps:');
    console.log('1. Delete existing test users');
    console.log('2. Test signup flow with test@test.com');
    console.log('3. Verify profile is created in database\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n⚠️  Please run the migration manually in Supabase SQL Editor:');
    console.error('   1. Go to Supabase Dashboard → SQL Editor');
    console.error('   2. Paste the contents of database/migrations/011_fix_user_creation.sql');
    console.error('   3. Click "Run"\n');
    process.exit(1);
  }
}

runMigration();
