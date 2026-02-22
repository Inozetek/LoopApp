/**
 * OAuth Service
 *
 * Centralized OAuth logic for native Google, Facebook, and Apple sign-in.
 * Prioritizes Google and Facebook for rich data extraction (interests, travel history).
 * Apple Sign-In included for App Store compliance.
 */

import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';
import { extractGoogleInterests, type ExtractedGoogleData } from '@/services/google-data';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Configure Google Sign-In on module load
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

let googleConfigured = false;

/**
 * Initialize Google Sign-In configuration
 * Must be called before any Google sign-in attempts
 */
export function configureGoogleSignIn(): void {
  if (googleConfigured) return;

  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true, // Get refresh token for server-side access
      scopes: [
        'profile',
        'email',
        // Calendar scope for schedule & free time detection
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
    });
    googleConfigured = true;
    console.log('✅ Google Sign-In configured');
  } catch (error) {
    console.error('❌ Failed to configure Google Sign-In:', error);
  }
}

// ============================================================================
// GOOGLE SIGN-IN (Primary - Rich Data)
// ============================================================================

export interface GoogleSignInResult {
  error: Error | null;
  user?: {
    id: string;
    email: string;
    name: string;
    photo?: string;
  };
  extractedData?: ExtractedGoogleData;
  idToken?: string;
}

/**
 * Sign in with Google (native flow)
 * Uses @react-native-google-signin for native experience
 * Extracts user interests from YouTube subscriptions
 */
export async function signInWithGoogleNative(): Promise<GoogleSignInResult> {
  try {
    // Ensure Google is configured
    configureGoogleSignIn();

    // Check if Play Services are available (Android)
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Perform sign-in
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      return { error: new Error('Google sign-in was cancelled') };
    }

    const { data } = response;
    const idToken = data.idToken;

    if (!idToken) {
      return { error: new Error('No ID token received from Google') };
    }

    // Sign in to Supabase with Google ID token
    const { data: supabaseData, error: supabaseError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (supabaseError) {
      console.error('Supabase Google sign-in error:', supabaseError);
      return { error: supabaseError };
    }

    // Extract interests from Google data
    let extractedData: ExtractedGoogleData | undefined;
    try {
      const tokens = await GoogleSignin.getTokens();
      if (tokens.accessToken) {
        extractedData = await extractGoogleInterests(tokens.accessToken);
        console.log('📊 Extracted Google Calendar data:', {
          categories: extractedData.categories.length,
          calendarEvents: extractedData.calendarEvents.length,
          favoritePlaces: extractedData.favoritePlaces.length,
        });
      }
    } catch (extractError) {
      console.warn('Could not extract Google interests:', extractError);
    }

    console.log('✅ Google Sign-In successful:', {
      email: data.user.email,
      name: data.user.name,
      hasExtractedData: !!extractedData,
    });

    return {
      error: null,
      user: {
        id: data.user.id,
        email: data.user.email || '',
        name: data.user.name || '',
        photo: data.user.photo || undefined,
      },
      extractedData,
      idToken,
    };
  } catch (error: any) {
    // Handle specific error codes
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          return { error: new Error('Sign-in was cancelled') };
        case statusCodes.IN_PROGRESS:
          return { error: new Error('Sign-in already in progress') };
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          // Fall back to OAuth redirect on devices without Play Services
          console.log('Play Services not available, falling back to OAuth redirect');
          return signInWithGoogleOAuth();
        default:
          console.error('Google Sign-In error:', error);
          return { error: new Error(error.message || 'Google Sign-In failed') };
      }
    }

    console.error('Google Sign-In error:', error);
    return {
      error: error instanceof Error ? error : new Error('Google Sign-In failed'),
    };
  }
}

/**
 * Fallback: Sign in with Google using OAuth redirect
 * Used when native sign-in is not available
 */
async function signInWithGoogleOAuth(): Promise<GoogleSignInResult> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'loopapp://auth/callback',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      return { error };
    }

    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Google Sign-In failed'),
    };
  }
}

/**
 * Sign out from Google
 */
export async function signOutFromGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.warn('Error signing out from Google:', error);
  }
}

/**
 * Check if user is currently signed in with Google
 */
export async function isGoogleSignedIn(): Promise<boolean> {
  try {
    return await (GoogleSignin as any).isSignedIn();
  } catch {
    return false;
  }
}

// ============================================================================
// APPLE SIGN-IN (App Store Compliance)
// ============================================================================

/**
 * Check if Apple Sign-In is available on this device
 * Only available on iOS 13+ with Apple ID configured
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch (error) {
    console.warn('Error checking Apple Sign-In availability:', error);
    return false;
  }
}

/**
 * Sign in with Apple (native iOS flow)
 * Uses expo-apple-authentication for native experience
 */
export async function signInWithAppleNative(): Promise<{
  error: Error | null;
  user?: { email?: string; fullName?: string };
}> {
  try {
    const isAvailable = await isAppleSignInAvailable();
    if (!isAvailable) {
      return {
        error: new Error('Apple Sign-In is not available on this device'),
      };
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return {
        error: new Error('No identity token received from Apple'),
      };
    }

    const { data, error: supabaseError } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (supabaseError) {
      console.error('Supabase Apple sign-in error:', supabaseError);
      return { error: supabaseError };
    }

    const fullName = credential.fullName
      ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
      : undefined;

    console.log('✅ Apple Sign-In successful:', {
      email: credential.email,
      fullName,
      userId: data.user?.id,
    });

    return {
      error: null,
      user: {
        email: credential.email || undefined,
        fullName: fullName || undefined,
      },
    };
  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      return { error: new Error('Sign-in was cancelled') };
    }

    console.error('Apple Sign-In error:', error);
    return {
      error: error instanceof Error ? error : new Error('Apple Sign-In failed'),
    };
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize all OAuth providers
 * Call this early in app startup
 */
export function initializeOAuth(): void {
  configureGoogleSignIn();
}
