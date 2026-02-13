/**
 * Delegates to ThemeContext so every component calling useColorScheme()
 * automatically respects the user's light/dark/system override.
 */
import { useThemeContext } from '@/contexts/theme-context';

export function useColorScheme(): 'light' | 'dark' {
  const { effectiveColorScheme } = useThemeContext();
  return effectiveColorScheme;
}
