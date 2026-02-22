/**
 * Search Animation Context
 *
 * Provides shared animation values for Grok-style search drawer effects:
 * - Main content scales down when search opens (mirrors menu behavior)
 * - Content shifts LEFT (opposite of menu which shifts right)
 * - Content gets rounded corners during animation
 * - 120fps synchronized animations
 */

import React, { createContext, useContext, useCallback } from 'react';
import { useSharedValue, SharedValue } from 'react-native-reanimated';

interface SearchAnimationContextType {
  /** Search open progress (0 = closed, 1 = fully open) */
  searchProgress: SharedValue<number>;
  /** Whether the search drawer is currently open */
  isSearchOpen: boolean;
  /** Set search open state */
  setSearchOpen: (open: boolean) => void;
  /** Toggle search state */
  toggleSearch: () => void;
}

const SearchAnimationContext = createContext<SearchAnimationContextType | null>(null);

export function SearchAnimationProvider({ children }: { children: React.ReactNode }) {
  const searchProgress = useSharedValue(0);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  const setSearchOpen = useCallback((open: boolean) => {
    setIsSearchOpen(open);
  }, []);

  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => !prev);
  }, []);

  return (
    <SearchAnimationContext.Provider
      value={{
        searchProgress,
        isSearchOpen,
        setSearchOpen,
        toggleSearch,
      }}
    >
      {children}
    </SearchAnimationContext.Provider>
  );
}

export function useSearchAnimation() {
  const context = useContext(SearchAnimationContext);
  if (!context) {
    throw new Error('useSearchAnimation must be used within a SearchAnimationProvider');
  }
  return context;
}
