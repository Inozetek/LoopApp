// Run this to test Supabase connection
import { supabase, testSupabaseConnection } from './lib/supabase';

async function runTest() {
  console.log('=== Testing Supabase Connection ===');
  console.log('Supabase URL:', 'https://yvedmxyfehjigikibo.supabase.co');

  // Test 1: Direct fetch
  console.log('\nTest 1: Direct fetch to Supabase...');
  try {
    const response = await fetch('https://yvedmxyfehjigikibo.supabase.co/rest/v1/', {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2ZWRteHlmZWhqaWlnaWtpdGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyODg4MjAsImV4cCI6MjA3NTg2NDgyMH0.ikPelaqCGya_ChwgGsDNzFn_7vP7bOvpJA78ZhuEiVc'
      }
    });
    console.log('Direct fetch status:', response.status);
    console.log('Direct fetch OK:', response.ok);
  } catch (error) {
    console.error('Direct fetch failed:', error);
  }

  // Test 2: Supabase client query
  console.log('\nTest 2: Supabase client query...');
  const connected = await testSupabaseConnection();
  console.log('Connection test result:', connected);

  // Test 3: Auth signup test
  console.log('\nTest 3: Auth endpoint test...');
  try {
    const { data, error } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'test123456',
    });
    console.log('Auth test result:', { data, error });
  } catch (error) {
    console.error('Auth test failed:', error);
  }

  console.log('\n=== Test Complete ===');
}

runTest();
