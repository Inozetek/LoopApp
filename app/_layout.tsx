import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Urbanist_300Light, Urbanist_400Regular, Urbanist_500Medium, Urbanist_600SemiBold } from '@expo-google-fonts/urbanist';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { Colors } from '@/constants/theme';
import { validateConfig, logValidationResults } from '@/utils/config-validator';

// Keep the splash screen visible while we load fonts
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { session, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Force dark mode for demo
  const colorScheme = 'dark'; // useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Validate configuration on startup
  useEffect(() => {
    const configResult = validateConfig();
    logValidationResults(configResult);
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    // DEMO MODE: Skip auth for quick mentor demo
    // TODO: Remove this after demo - re-enable auth
    const DEMO_MODE = true;
    if (DEMO_MODE) {
      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
      return;
    }

    if (!session) {
      // User is not signed in, redirect to login
      if (!inAuthGroup) {
        router.replace('/auth/login');
      }
    } else if (session && !user) {
      // User is signed in but hasn't completed onboarding
      const currentPath = segments.join('/');
      if (currentPath !== 'auth/onboarding') {
        router.replace('/auth/onboarding');
      }
    } else if (session && user) {
      // User is fully authenticated and has profile
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
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  // Force dark mode for demo
  const colorScheme = 'dark'; // useColorScheme();

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
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootLayoutNav />
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
