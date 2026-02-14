import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Urbanist_300Light, Urbanist_400Regular, Urbanist_500Medium, Urbanist_600SemiBold } from '@expo-google-fonts/urbanist';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeContextProvider } from '@/contexts/theme-context';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { TabNotificationsProvider } from '@/contexts/tab-notifications-context';
import { MenuAnimationProvider } from '@/contexts/menu-animation-context';
import { ErrorBoundary } from '@/components/error-boundary';
import { Colors } from '@/constants/theme';
import { validateEnvironment, logValidationResults, printEnvironmentInfo } from '@/utils/env-validator';
import { initializeErrorLogging } from '@/utils/error-logger';

// Suppress known auth errors that are handled gracefully
LogBox.ignoreLogs([
  'Invalid Refresh Token',
  'refresh token not found',
  'AuthApiError',
]);

// Keep the splash screen visible while we load fonts
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { session, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Initialize production services on startup
  useEffect(() => {
    // 1. Validate environment variables
    const envResult = validateEnvironment();
    logValidationResults(envResult);
    printEnvironmentInfo();

    // 2. Initialize error logging (Sentry integration)
    initializeErrorLogging();

    // 3. In production, prevent app from starting if required env vars are missing
    if (!envResult.isValid && process.env.NODE_ENV === 'production') {
      console.error('❌ Cannot start app: Required environment variables are missing');
      // In a real production app, you might want to show an error screen
    }
  }, []);

  // Track auth state to avoid redundant logging on tab switches
  const lastAuthState = useRef<string>('');

  useEffect(() => {
    if (loading) return;

    // Skip re-execution if auth state hasn't changed (e.g. tab switch)
    const authStateKey = `${!!session}-${!!user}`;
    if (authStateKey === lastAuthState.current) return;
    lastAuthState.current = authStateKey;

    const inAuthGroup = segments[0] === 'auth';

    console.log('🔐 Auth State:', {
      session: session ? 'EXISTS' : 'NULL',
      user: user ? 'EXISTS' : 'NULL',
      inAuthGroup,
    });

    if (!session) {
      console.log('→ No session, redirecting to login');
      if (!inAuthGroup) {
        router.replace('/auth/login');
      }
    } else if (session && !user) {
      console.log('→ Session exists but no user profile, redirecting to onboarding');
      const currentPath = segments.join('/');
      if (currentPath !== 'auth/onboarding') {
        router.replace('/auth/onboarding');
      }
    } else if (session && user) {
      console.log('→ Fully authenticated, redirecting to main app');
      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [session, user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Load Urbanist font
  const [fontsLoaded] = useFonts({
    'Urbanist-Light': Urbanist_300Light,
    'Urbanist-Regular': Urbanist_400Regular,
    'Urbanist-Medium': Urbanist_500Medium,
    'Urbanist-SemiBold': Urbanist_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeContextProvider>
        <AuthProvider>
          <TabNotificationsProvider>
            <MenuAnimationProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <ErrorBoundary fallbackMessage="The app encountered an unexpected error. Tap below to reload.">
                  <RootLayoutNav />
                </ErrorBoundary>
                <StatusBar style="auto" />
              </ThemeProvider>
            </MenuAnimationProvider>
          </TabNotificationsProvider>
        </AuthProvider>
      </ThemeContextProvider>
    </GestureHandlerRootView>
  );
}
