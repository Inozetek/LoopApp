/**
 * Run Database Migration Script
 *
 * This script runs a SQL migration file against Supabase
 * Run with: node scripts/run-migration.js <migration-file.sql>
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
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

async function runMigration(migrationFile) {
  try {
    // Read the SQL file
    const sqlPath = path.resolve(migrationFile);

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`);
    }

    console.log(`\n📄 Reading migration: ${path.basename(sqlPath)}`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log(`📊 Executing SQL migration...\n`);

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      // Try direct query if rpc doesn't exist
      const { error: queryError } = await supabase.from('_').select('*').limit(0);

      // Since we can't use rpc, we'll need to use the SQL editor
      console.error('❌ Cannot execute SQL directly via API.');
      console.error('\n📝 Please run this migration manually in Supabase SQL Editor:');
      console.error(`   https://supabase.com/dashboard/project/_/sql/new\n`);
      console.log('Copy and paste this SQL:\n');
      console.log('─'.repeat(80));
      console.log(sql);
      console.log('─'.repeat(80));
      process.exit(1);
    }

    console.log(`✅ Migration completed successfully!\n`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

// Get migration file from command line
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('\n❌ Error: Please provide a migration file');
  console.error('Usage: node scripts/run-migration.js <migration-file.sql>\n');
  console.error('Example: node scripts/run-migration.js database/migrations/011_fix_user_creation.sql\n');
  process.exit(1);
}

runMigration(migrationFile);
