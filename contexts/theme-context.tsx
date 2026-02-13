/**
 * Theme Context
 * Provides user-controlled theme preference (light/dark/system)
 * Persists to AsyncStorage and syncs to Supabase user profile
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
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
  const [osScheme, setOsScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());
  const [loaded, setLoaded] = useState(false);

  // Load stored preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemePreferenceState(stored);
      }
      setLoaded(true);
    });
  }, []);

  // Listen for OS theme changes
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setOsScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const effectiveColorScheme: 'light' | 'dark' =
    themePreference === 'system'
      ? (osScheme ?? 'light')
      : themePreference;

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setThemePreferenceState(pref);
    AsyncStorage.setItem(THEME_STORAGE_KEY, pref);
  }, []);

  // Don't render children until we've loaded the stored preference
  // to avoid a flash of wrong theme
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ themePreference, effectiveColorScheme, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  return useContext(ThemeContext);
}
