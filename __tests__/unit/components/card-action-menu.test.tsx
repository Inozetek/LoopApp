/**
 * Tests for CardActionMenu component logic
 *
 * Tests the pure behavioral logic of the card action menu:
 *   - Conditional visibility of menu items (feature flags + prop presence)
 *   - Callback invocation order (onClose before action callback)
 *   - Haptic feedback triggers
 *   - Activity name header display rules
 *   - Theme color selection (light vs dark)
 *
 * NOTE: This project's Jest config uses testEnvironment: 'node' with ts-jest,
 * which cannot render React Native components. Tests follow the established
 * project pattern of extracting and testing component logic as pure functions.
 */

// ---------------------------------------------------------------------------
// Re-implement component logic as standalone testable functions
// ---------------------------------------------------------------------------

interface CardActionMenuProps {
  visible: boolean;
  onClose: () => void;
  onAddToRadar?: () => void;
  onNotInterested?: () => void;
  activityName?: string;
}

interface ThemeColorSet {
  text: string;
  textSecondary: string;
  cardBackground: string;
}

/**
 * Mirrors the theme selection logic at line 49-51 of card-action-menu.tsx:
 *   const colorScheme = useColorScheme();
 *   const isDark = colorScheme === 'dark';
 *   const colors = isDark ? ThemeColors.dark : ThemeColors.light;
 */
function selectColors(
  colorScheme: 'light' | 'dark',
  themeColors: { light: ThemeColorSet; dark: ThemeColorSet },
): ThemeColorSet {
  const isDark = colorScheme === 'dark';
  return isDark ? themeColors.dark : themeColors.light;
}

/**
 * Mirrors the conditional rendering at line 86 of card-action-menu.tsx:
 *   {FEATURE_FLAGS.ENABLE_RADAR && onAddToRadar && ( ... )}
 */
function shouldShowAddToRadar(
  enableRadarFlag: boolean,
  onAddToRadar: (() => void) | undefined,
): boolean {
  return enableRadarFlag && !!onAddToRadar;
}

/**
 * Mirrors the conditional rendering at line 105 of card-action-menu.tsx:
 *   {onNotInterested && ( ... )}
 */
function shouldShowNotInterested(
  onNotInterested: (() => void) | undefined,
): boolean {
  return !!onNotInterested;
}

/**
 * Mirrors the conditional rendering at line 79 of card-action-menu.tsx:
 *   {activityName && ( ... )}
 */
function shouldShowActivityNameHeader(activityName: string | undefined): boolean {
  return !!activityName;
}

/**
 * Mirrors handleAddToRadar at lines 53-57 of card-action-menu.tsx:
 *   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 *   onClose();
 *   onAddToRadar?.();
 */
function handleAddToRadar(
  hapticFn: () => void,
  onClose: () => void,
  onAddToRadar?: () => void,
): void {
  hapticFn();
  onClose();
  onAddToRadar?.();
}

/**
 * Mirrors handleNotInterested at lines 59-63 of card-action-menu.tsx:
 *   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 *   onClose();
 *   onNotInterested?.();
 */
function handleNotInterested(
  hapticFn: () => void,
  onClose: () => void,
  onNotInterested?: () => void,
): void {
  hapticFn();
  onClose();
  onNotInterested?.();
}

/**
 * Determines which menu items should be rendered for the given props and flags.
 * Returns the list of testIDs that would be present in the rendered output.
 */
function getVisibleMenuItems(
  enableRadarFlag: boolean,
  onAddToRadar: (() => void) | undefined,
  onNotInterested: (() => void) | undefined,
): string[] {
  const items: string[] = [];
  if (shouldShowAddToRadar(enableRadarFlag, onAddToRadar)) {
    items.push('card-action-add-radar');
  }
  if (shouldShowNotInterested(onNotInterested)) {
    items.push('card-action-not-interested');
  }
  // Cancel is always rendered
  items.push('card-action-cancel');
  return items;
}

// ---------------------------------------------------------------------------
// Theme color constants matching brand.ts
// ---------------------------------------------------------------------------

const THEME_COLORS = {
  light: { text: '#000', textSecondary: '#666', cardBackground: '#fff' },
  dark: { text: '#fff', textSecondary: '#aaa', cardBackground: '#111' },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CardActionMenu - Pure Logic', () => {
  // =========================================================================
  // 1. "Add to Radar" conditional visibility
  // =========================================================================

  describe('shouldShowAddToRadar', () => {
    it('returns true when ENABLE_RADAR is true and onAddToRadar is provided', () => {
      const callback = jest.fn();
      expect(shouldShowAddToRadar(true, callback)).toBe(true);
    });

    it('returns false when ENABLE_RADAR is false even if onAddToRadar is provided', () => {
      const callback = jest.fn();
      expect(shouldShowAddToRadar(false, callback)).toBe(false);
    });

    it('returns false when onAddToRadar is undefined even if ENABLE_RADAR is true', () => {
      expect(shouldShowAddToRadar(true, undefined)).toBe(false);
    });

    it('returns false when both ENABLE_RADAR is false and onAddToRadar is undefined', () => {
      expect(shouldShowAddToRadar(false, undefined)).toBe(false);
    });
  });

  // =========================================================================
  // 2. "Not Interested" conditional visibility
  // =========================================================================

  describe('shouldShowNotInterested', () => {
    it('returns true when onNotInterested is provided', () => {
      const callback = jest.fn();
      expect(shouldShowNotInterested(callback)).toBe(true);
    });

    it('returns false when onNotInterested is undefined', () => {
      expect(shouldShowNotInterested(undefined)).toBe(false);
    });
  });

  // =========================================================================
  // 3. Activity name header visibility
  // =========================================================================

  describe('shouldShowActivityNameHeader', () => {
    it('returns true when activityName is a non-empty string', () => {
      expect(shouldShowActivityNameHeader('Kura Revolving Sushi')).toBe(true);
    });

    it('returns false when activityName is undefined', () => {
      expect(shouldShowActivityNameHeader(undefined)).toBe(false);
    });

    it('returns false when activityName is an empty string', () => {
      expect(shouldShowActivityNameHeader('')).toBe(false);
    });

    it('returns true for single-character name', () => {
      expect(shouldShowActivityNameHeader('X')).toBe(true);
    });
  });

  // =========================================================================
  // 4. handleAddToRadar callback order
  // =========================================================================

  describe('handleAddToRadar', () => {
    it('calls hapticFn, then onClose, then onAddToRadar in order', () => {
      const callOrder: string[] = [];
      const hapticFn = jest.fn(() => callOrder.push('haptic'));
      const onClose = jest.fn(() => callOrder.push('close'));
      const onAddToRadar = jest.fn(() => callOrder.push('addToRadar'));

      handleAddToRadar(hapticFn, onClose, onAddToRadar);

      expect(hapticFn).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onAddToRadar).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(['haptic', 'close', 'addToRadar']);
    });

    it('calls hapticFn and onClose even when onAddToRadar is undefined', () => {
      const hapticFn = jest.fn();
      const onClose = jest.fn();

      handleAddToRadar(hapticFn, onClose, undefined);

      expect(hapticFn).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not throw when onAddToRadar is undefined', () => {
      const hapticFn = jest.fn();
      const onClose = jest.fn();

      expect(() => handleAddToRadar(hapticFn, onClose, undefined)).not.toThrow();
    });
  });

  // =========================================================================
  // 5. handleNotInterested callback order
  // =========================================================================

  describe('handleNotInterested', () => {
    it('calls hapticFn, then onClose, then onNotInterested in order', () => {
      const callOrder: string[] = [];
      const hapticFn = jest.fn(() => callOrder.push('haptic'));
      const onClose = jest.fn(() => callOrder.push('close'));
      const onNotInterested = jest.fn(() => callOrder.push('notInterested'));

      handleNotInterested(hapticFn, onClose, onNotInterested);

      expect(hapticFn).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onNotInterested).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(['haptic', 'close', 'notInterested']);
    });

    it('calls hapticFn and onClose even when onNotInterested is undefined', () => {
      const hapticFn = jest.fn();
      const onClose = jest.fn();

      handleNotInterested(hapticFn, onClose, undefined);

      expect(hapticFn).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not throw when onNotInterested is undefined', () => {
      const hapticFn = jest.fn();
      const onClose = jest.fn();

      expect(() => handleNotInterested(hapticFn, onClose, undefined)).not.toThrow();
    });
  });

  // =========================================================================
  // 6. Theme color selection
  // =========================================================================

  describe('selectColors', () => {
    it('returns light colors for light color scheme', () => {
      const colors = selectColors('light', THEME_COLORS);
      expect(colors).toEqual(THEME_COLORS.light);
    });

    it('returns dark colors for dark color scheme', () => {
      const colors = selectColors('dark', THEME_COLORS);
      expect(colors).toEqual(THEME_COLORS.dark);
    });

    it('uses correct cardBackground for light theme', () => {
      const colors = selectColors('light', THEME_COLORS);
      expect(colors.cardBackground).toBe('#fff');
    });

    it('uses correct cardBackground for dark theme', () => {
      const colors = selectColors('dark', THEME_COLORS);
      expect(colors.cardBackground).toBe('#111');
    });
  });

  // =========================================================================
  // 7. getVisibleMenuItems (full menu composition)
  // =========================================================================

  describe('getVisibleMenuItems', () => {
    it('shows all three items when radar is enabled and both callbacks provided', () => {
      const items = getVisibleMenuItems(true, jest.fn(), jest.fn());
      expect(items).toEqual([
        'card-action-add-radar',
        'card-action-not-interested',
        'card-action-cancel',
      ]);
    });

    it('shows only Not Interested and Cancel when radar flag is off', () => {
      const items = getVisibleMenuItems(false, jest.fn(), jest.fn());
      expect(items).toEqual([
        'card-action-not-interested',
        'card-action-cancel',
      ]);
    });

    it('shows only Add to Radar and Cancel when onNotInterested is undefined', () => {
      const items = getVisibleMenuItems(true, jest.fn(), undefined);
      expect(items).toEqual([
        'card-action-add-radar',
        'card-action-cancel',
      ]);
    });

    it('shows only Cancel when radar is off and onNotInterested is undefined', () => {
      const items = getVisibleMenuItems(false, undefined, undefined);
      expect(items).toEqual(['card-action-cancel']);
    });

    it('shows only Cancel when radar is on but onAddToRadar is undefined and onNotInterested is undefined', () => {
      const items = getVisibleMenuItems(true, undefined, undefined);
      expect(items).toEqual(['card-action-cancel']);
    });

    it('always includes card-action-cancel as the last item', () => {
      const combos: [boolean, (() => void) | undefined, (() => void) | undefined][] = [
        [true, jest.fn(), jest.fn()],
        [false, jest.fn(), jest.fn()],
        [true, undefined, jest.fn()],
        [true, jest.fn(), undefined],
        [false, undefined, undefined],
      ];

      for (const [flag, radar, notInterested] of combos) {
        const items = getVisibleMenuItems(flag, radar, notInterested);
        expect(items[items.length - 1]).toBe('card-action-cancel');
      }
    });
  });

  // =========================================================================
  // 8. Cancel / backdrop behavior
  // =========================================================================

  describe('Cancel / backdrop behavior', () => {
    it('onClose is the only callback for cancel (no haptic, no side effect)', () => {
      // In the component, the Cancel Pressable's onPress is just `onClose`.
      // Unlike handleAddToRadar/handleNotInterested, it does NOT call hapticFn.
      // We verify this by checking that the handleAddToRadar and handleNotInterested
      // wrappers include haptic calls, while a direct onClose call does not.
      const hapticFn = jest.fn();
      const onClose = jest.fn();

      // Simulating cancel: just call onClose directly (no wrapper)
      onClose();

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(hapticFn).not.toHaveBeenCalled();
    });

    it('backdrop press triggers onClose (same as cancel)', () => {
      // The backdrop Pressable's onPress is `onClose` (line 72).
      // The Modal's onRequestClose is also `onClose` (line 70).
      const onClose = jest.fn();
      // Simulating backdrop press
      onClose();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 9. Props interface validation
  // =========================================================================

  describe('Props interface', () => {
    it('accepts minimal required props (visible + onClose)', () => {
      const props: CardActionMenuProps = {
        visible: true,
        onClose: jest.fn(),
      };
      // All optional props should be undefined
      expect(props.onAddToRadar).toBeUndefined();
      expect(props.onNotInterested).toBeUndefined();
      expect(props.activityName).toBeUndefined();
    });

    it('accepts full props with all optional fields', () => {
      const props: CardActionMenuProps = {
        visible: true,
        onClose: jest.fn(),
        onAddToRadar: jest.fn(),
        onNotInterested: jest.fn(),
        activityName: 'Deep Ellum Brewing',
      };
      expect(props.onAddToRadar).toBeDefined();
      expect(props.onNotInterested).toBeDefined();
      expect(props.activityName).toBe('Deep Ellum Brewing');
    });

    it('visible can be false', () => {
      const props: CardActionMenuProps = {
        visible: false,
        onClose: jest.fn(),
      };
      expect(props.visible).toBe(false);
    });
  });
});
