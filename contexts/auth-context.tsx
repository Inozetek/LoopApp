import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import * as Facebook from 'expo-facebook';
import { supabase } from '@/lib/supabase';
import { User, UserInsert, UserUpdate } from '@/types/database';
import { extractInterestsFromFacebook } from '@/services/facebook';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; user: SupabaseUser | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithFacebook: () => Promise<{ error: Error | null; facebookToken?: string }>;
  signOut: () => Promise<{ error: Error | null }>;
  updateUserProfile: (userData: UserUpdate) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// DEMO MODE: Mock user for quick demos without auth
const DEMO_MODE = false;
const MOCK_USER: User = {
  id: '00000000-0000-0000-0000-000000000001', // Valid UUID for demo mode
  email: 'demo@loop.app',
  name: 'Demo User',
  phone: null,
  profile_picture_url: null,
  home_location: null,
  home_address: null,
  work_location: null,
  work_address: null,
  current_location: null,
  commute_route: null,
  interests: ['coffee', 'live music', 'hiking', 'food', 'art'],
  preferences: {
    budget: 2,
    max_distance_miles: 5,
    preferred_times: ['evening'],
    notification_enabled: true
  },
  ai_profile: {
    preferred_distance_miles: 5.0,
    budget_level: 2,
    favorite_categories: ['coffee', 'live music'],
    disliked_categories: [],
    price_sensitivity: 'medium',
    time_preferences: ['evening'],
    distance_tolerance: 'medium'
  },
  subscription_tier: 'free',
  subscription_status: 'active',
  stripe_customer_id: null,
  subscription_end_date: null,
  loop_score: 150,
  streak_days: 5,
  last_active_date: new Date().toISOString().split('T')[0],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_login_at: new Date().toISOString(),
  // Phase 2 fields
  referral_code: 'DEMO01',
  referred_by_user_id: null,
  referral_count: 0,
  referral_credits_cents: 0,
  last_refresh_at: new Date().toISOString(),
  privacy_settings: {
    share_loop_with: 'friends',
    discoverable: true,
    share_location: true
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(DEMO_MODE ? MOCK_USER : null);
  const [loading, setLoading] = useState(DEMO_MODE ? false : true);

  useEffect(() => {
    // Skip auth in demo mode
    if (DEMO_MODE) {
      return;
    }

    // Initialize auth state with aggressive error recovery
    async function initializeAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        // Handle any auth errors (including invalid refresh tokens)
        if (error) {
          console.log('🔄 Session error detected, clearing all auth state...');
          // Aggressively clear everything
          await supabase.auth.signOut({ scope: 'local' });
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        setSession(session);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        // Catch any unexpected errors and clear state
        console.log('🔄 Auth initialization error, clearing state');
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    }

    initializeAuth();

    // Listen for auth changes with error handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, 'Session:', session ? 'exists' : 'null');

      try {
        // Handle SIGNED_OUT event
        if (event === 'SIGNED_OUT') {
          console.log('🚪 User signed out');
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        // Handle TOKEN_REFRESHED errors silently
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.log('🔄 Token refresh failed, clearing session...');
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        // For all other events, update session normally
        setSession(session);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setLoading(false);
        }
      } catch (error) {
        // Silently handle any errors in auth state changes
        console.log('🔄 Error in auth state change, clearing session:', error);
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle no rows gracefully

      if (error) {
        console.error('Error fetching user profile:', error);
        setUser(null);
      } else if (data) {
        setUser(data);
      } else {
        // User profile doesn't exist yet (new signup, needs onboarding)
        console.log('User profile not found, user needs to complete onboarding');
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: string, password: string) {
    try {
      console.log('Attempting signup with Supabase...');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      console.log('Signup response:', { data, error });

      if (error) {
        console.error('Supabase signup error:', error);
        throw error;
      }

      // Note: User profile will be created during onboarding
      return { error: null, user: data.user };
    } catch (error) {
      console.error('Sign up error:', error);

      // Provide more helpful error message for network issues
      if (error instanceof Error && error.message.includes('Network request failed')) {
        return {
          error: new Error(
            'Network Error: Cannot connect to Supabase. Please check:\n' +
            '1. Your internet connection\n' +
            '2. If using Android emulator, ensure network is enabled\n' +
            '3. Try restarting the app and emulator'
          ),
          user: null,
        };
      }

      return {
        error: error instanceof Error ? error : new Error('Failed to sign up'),
        user: null,
      };
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        error: error instanceof Error ? error : new Error('Failed to sign in'),
      };
    }
  }

  async function signInWithGoogle() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'loopapp://auth/callback', // This needs to match your app scheme
        },
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Google sign in error:', error);
      return {
        error: error instanceof Error ? error : new Error('Failed to sign in with Google'),
      };
    }
  }

  async function signInWithFacebook() {
    try {
      const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

      if (!facebookAppId) {
        throw new Error('Facebook App ID not configured. Please add EXPO_PUBLIC_FACEBOOK_APP_ID to .env');
      }

      // Initialize Facebook SDK
      await Facebook.initializeAsync({ appId: facebookAppId });

      // Request permissions: basic profile + likes for interest extraction
      const result = await Facebook.logInWithReadPermissionsAsync({
        permissions: ['public_profile', 'email', 'user_likes'],
      }) as any;

      if (result.type !== 'success' || !result.token) {
        return { error: new Error('Facebook login was cancelled or failed') };
      }

      console.log('Facebook login successful, token received');

      // Sign in to Supabase with Facebook token
      const { error: supabaseError } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: 'loopapp://auth/callback',
        },
      });

      if (supabaseError) {
        console.error('Supabase Facebook sign in error:', supabaseError);
        throw supabaseError;
      }

      // Extract interests from Facebook (will be used in onboarding)
      console.log('Extracting interests from Facebook...');
      const interests = await extractInterestsFromFacebook(result.token);
      console.log('Extracted interests:', interests);

      // Store interests temporarily for onboarding to use
      // You'll need to pass this to the onboarding screen
      // For now, we'll log it
      console.log('Facebook interests extracted successfully:', {
        totalInterests: interests.interests.length,
        totalCategories: interests.categories.length,
      });

      return { error: null, facebookToken: result.token };
    } catch (error) {
      console.error('Facebook sign in error:', error);
      return {
        error: error instanceof Error ? error : new Error('Failed to sign in with Facebook'),
      };
    }
  }

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return {
        error: error instanceof Error ? error : new Error('Failed to sign out'),
      };
    }
  }

  async function resetPassword(email: string) {
    try {
      console.log('Sending password reset email to:', email);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'loopapp://auth/reset-password', // Deep link for password reset
      });

      if (error) throw error;

      console.log('✅ Password reset email sent');
      return { error: null };
    } catch (error) {
      console.error('Password reset error:', error);
      return {
        error: error instanceof Error ? error : new Error('Failed to send password reset email'),
      };
    }
  }

  async function updateUserProfile(userData: UserUpdate) {
    if (!session?.user) {
      return { error: new Error('No authenticated user') };
    }

    try {
      // UPSERT instead of UPDATE - creates profile if it doesn't exist
      // This handles the case where the database trigger fails to create the profile
      const { error } = await supabase
        .from('users')
        .upsert({
          id: session.user.id,
          email: session.user.email,
          ...userData
        }, {
          onConflict: 'id'
        });

      if (error) throw error;

      // Refresh user profile
      await fetchUserProfile(session.user.id);

      return { error: null };
    } catch (error) {
      console.error('Update profile error:', error);
      return {
        error: error instanceof Error ? error : new Error('Failed to update profile'),
      };
    }
  }

  const value = {
    session,
    user,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithFacebook,
    signOut,
    updateUserProfile,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
