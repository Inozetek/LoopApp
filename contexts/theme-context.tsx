/**
 * Theme Context
 * Provides user-controlled theme preference (light/dark/system)
 * Persists to AsyncStorage and syncs to Supabase user profile
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Appearance, ColorSchemeName, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@loop/theme-preference';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  themePreference: ThemePreference;
  effectiveColorScheme: 'light' | 'dark';
  setThemePreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themePreference: 'system',
  effectiveColorScheme: 'light',
  setThemePreference: () => {},
});

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  // Capture OS scheme once at mount — Android emulators can rapid-fire
  // Appearance change events causing infinite white/black flashing.
  const initialScheme = useRef<ColorSchemeName>(Appearance.getColorScheme()).current;
  const [osScheme, setOsScheme] = useState<ColorSchemeName>(initialScheme);
  // Load stored preference on mount (children render immediately with OS default)
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemePreferenceState(stored);
      }
    });
  }, []);

  // Listen for OS theme changes
  // On Android: heavily debounced (500ms) + ignore duplicate values to prevent flicker loop
  // On iOS: standard 100ms debounce
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const delay = Platform.OS === 'android' ? 500 : 100;

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setOsScheme((prev) => {
          if (prev === colorScheme) return prev;
          return colorScheme;
        });
      }, delay);
    });
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      sub.remove();
    };
  }, []);

  const effectiveColorScheme: 'light' | 'dark' =
    themePreference === 'system'
      ? (osScheme ?? 'light')
      : themePreference;

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setThemePreferenceState(pref);
    AsyncStorage.setItem(THEME_STORAGE_KEY, pref);
  }, []);

  // Always render children — use OS scheme as default until AsyncStorage
  // resolves. A brief theme mismatch is far less disruptive than a black
  // screen (returning null blocks the entire app tree on Android).
  return (
    <ThemeContext.Provider value={{ themePreference, effectiveColorScheme, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  return useContext(ThemeContext);
}
