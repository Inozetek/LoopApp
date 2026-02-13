/**
 * Menu Animation Context
 *
 * Provides shared animation values for Grok-style side menu effects:
 * - Main content scales down when menu opens
 * - Content gets rounded corners during animation
 * - 120fps synchronized animations
 * - Edge pan gesture support for opening menu from screen edge
 */

import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { Dimensions } from 'react-native';
import { useSharedValue, SharedValue } from 'react-native-reanimated';

const SCREEN_WIDTH = Dimensions.get('window').width;
const EDGE_PAN_THRESHOLD = 30; // Pixels from left edge to trigger pan

interface MenuAnimationContextType {
  /** Menu open progress (0 = closed, 1 = fully open) */
  menuProgress: SharedValue<number>;
  /** Whether the menu is currently open */
  isMenuOpen: boolean;
  /** Set menu open state */
  setMenuOpen: (open: boolean) => void;
  /** Toggle menu state */
  toggleMenu: () => void;
  /** Open menu (for edge pan gesture) */
  openMenu: () => void;
  /** Register a menu open callback (for tab screens) */
  registerOpenCallback: (callback: () => void) => void;
  /** Unregister the menu open callback */
  unregisterOpenCallback: () => void;
}

const MenuAnimationContext = createContext<MenuAnimationContextType | null>(null);

export function MenuAnimationProvider({ children }: { children: React.ReactNode }) {
  const menuProgress = useSharedValue(0);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const openCallbackRef = useRef<(() => void) | null>(null);

  const setMenuOpen = useCallback((open: boolean) => {
    setIsMenuOpen(open);
    // Note: The actual animation is handled by MainMenuModal
    // This context just tracks the state for other components
  }, []);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  const openMenu = useCallback(() => {
    // Call the registered callback (from the active tab screen)
    if (openCallbackRef.current) {
      openCallbackRef.current();
    }
  }, []);

  const registerOpenCallback = useCallback((callback: () => void) => {
    openCallbackRef.current = callback;
  }, []);

  const unregisterOpenCallback = useCallback(() => {
    openCallbackRef.current = null;
  }, []);

  return (
    <MenuAnimationContext.Provider
      value={{
        menuProgress,
        isMenuOpen,
        setMenuOpen,
        toggleMenu,
        openMenu,
        registerOpenCallback,
        unregisterOpenCallback,
      }}
    >
      {children}
    </MenuAnimationContext.Provider>
  );
}

export function useMenuAnimation() {
  const context = useContext(MenuAnimationContext);
  if (!context) {
    throw new Error('useMenuAnimation must be used within a MenuAnimationProvider');
  }
  return context;
}
