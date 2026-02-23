import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useCallback } from 'react';
import { View, LogBox, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Urbanist_300Light, Urbanist_400Regular, Urbanist_500Medium, Urbanist_600SemiBold } from '@expo-google-fonts/urbanist';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeContextProvider } from '@/contexts/theme-context';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { TabNotificationsProvider } from '@/contexts/tab-notifications-context';
import { MenuAnimationProvider } from '@/contexts/menu-animation-context';
import { SearchAnimationProvider } from '@/contexts/search-animation-context';
import { NetworkProvider } from '@/contexts/network-context';
import { ErrorBoundary } from '@/components/error-boundary';
import { OfflineBanner } from '@/components/offline-banner';
import { Colors } from '@/constants/theme';
import { validateEnvironment, logValidationResults, printEnvironmentInfo } from '@/utils/env-validator';
import { initializeErrorLogging } from '@/utils/error-logger';
import { handleRadarNotificationTap } from '@/services/radar-push-service';
import { initSentry } from '@/lib/sentry';
import '@/services/notification-service';

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

/**
 * Returns true if the URL is a dev-client launcher URL that should NOT be
 * treated as an app deep link.  These are injected by expo-dev-client when
 * it hands control to the JS bundle and must be ignored.
 */
function isDevClientUrl(url: string): boolean {
  return url.includes('expo-development-client');
}

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

    // 2. Initialize Sentry crash reporting (must run before error logger)
    initSentry();

    // 3. Initialize error logging (wires error-logger.ts → Sentry)
    initializeErrorLogging();

    // 4. In production, prevent app from starting if required env vars are missing
    if (!envResult.isValid && process.env.NODE_ENV === 'production') {
      console.error('❌ Cannot start app: Required environment variables are missing');
    }
  }, []);

  // Listen for notification taps (deep-linking for radar alerts).
  // Use a ref for router so the effect doesn't re-subscribe on every render.
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const radarData = handleRadarNotificationTap(data);
      if (radarData) {
        routerRef.current.push('/(tabs)');
      }
    });
    return () => subscription.remove();
  }, []);

  // Deep link handler — only processes real app deep links, not dev-client URLs.
  // Uses a ref flag to ensure getInitialURL is only processed once.
  const initialUrlHandled = useRef(false);

  const handleDeepLink = useCallback((url: string) => {
    if (isDevClientUrl(url)) return;

    try {
      const parsed = new URL(url.replace('loopapp://', 'https://loopapp.com/'));
      const pathParts = parsed.pathname.split('/').filter(Boolean);

      if (pathParts[0] === 'activity' && pathParts[1]) {
        routerRef.current.push({ pathname: '/(tabs)', params: { activityId: pathParts[1] } });
      } else if (pathParts[0] === 'profile' && pathParts[1]) {
        routerRef.current.push({ pathname: '/friend-profile', params: { userId: pathParts[1] } });
      } else if (pathParts[0] === 'chat' && pathParts[1]) {
        routerRef.current.push({ pathname: '/chat/[id]', params: { id: pathParts[1] } });
      }
      // No else fallback — unrecognized deep links are silently ignored
      // instead of pushing to /(tabs) which caused infinite remount loops.
    } catch (err) {
      console.warn('[deep-link] Failed to parse URL:', url, err);
    }
  }, []);

  useEffect(() => {
    // Handle cold-start deep link (only once)
    if (!initialUrlHandled.current) {
      initialUrlHandled.current = true;
      Linking.getInitialURL().then((url) => {
        if (url) handleDeepLink(url);
      });
    }

    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });
    return () => subscription.remove();
  }, [handleDeepLink]);

  // Track auth state to avoid redundant redirects on tab switches
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
    // Show a blank screen matching the theme background while auth initializes.
    // The feed screen's own skeleton shimmer handles the visible loading state.
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }} />
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="chat" options={{ headerShown: false }} />
      <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
}

/** Inner wrapper that reads ThemeContext (must be inside ThemeContextProvider) */
function ThemedApp() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ErrorBoundary fallbackMessage="The app encountered an unexpected error. Tap below to reload.">
        <RootLayoutNav />
      </ErrorBoundary>
      <OfflineBanner />
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

function RootLayout() {
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
    // Solid black during font loading to prevent white flash on Android
    return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
      <NetworkProvider>
        <ThemeContextProvider>
          <AuthProvider>
            <TabNotificationsProvider>
              <MenuAnimationProvider>
                <SearchAnimationProvider>
                  <ThemedApp />
                </SearchAnimationProvider>
              </MenuAnimationProvider>
            </TabNotificationsProvider>
          </AuthProvider>
        </ThemeContextProvider>
      </NetworkProvider>
    </GestureHandlerRootView>
  );
}

export default RootLayout;
