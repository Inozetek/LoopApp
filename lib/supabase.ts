import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';
import { Platform } from 'react-native';

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.\n' +
    'Required: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

if (!supabaseServiceKey) {
  console.warn(
    '⚠️ Missing SUPABASE_SERVICE_ROLE_KEY - Backend operations (cache seeding) will fail.\n' +
    'Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file for full functionality.'
  );
}

// Create platform-aware storage
// On web, use localStorage wrapper that's SSR-safe
// On native, use AsyncStorage
const createStorage = () => {
  if (Platform.OS === 'web') {
    // Web storage using localStorage (SSR-safe)
    return {
      getItem: async (key: string) => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(key);
      },
      setItem: async (key: string, value: string) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(key, value);
      },
      removeItem: async (key: string) => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(key);
      },
    };
  }
  // Native storage using AsyncStorage
  return AsyncStorage;
};

// Create typed Supabase client for authenticated user operations
const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Create service role client for backend operations (bypasses RLS)
// This client has elevated permissions and should only be used for:
// - Cache seeding (places_cache, events_cache)
// - Background jobs (cleanup, analytics)
// - System operations that users shouldn't trigger directly
const supabaseAdminClient = supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Export with relaxed typing for MVP to avoid type errors
// TODO: Fix type generation in future phase
export const supabase = supabaseClient as any;
export const supabaseAdmin = supabaseAdminClient as any;

// Test connection helper
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase.from('users').select('count').limit(1);
    console.log('Connection test result:', { data, error });
    return !error;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}
