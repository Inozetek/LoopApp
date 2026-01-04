/**
 * Loop Brand Design System
 * Modern, sleek color palette inspired by Instagram/Snapchat
 * Built for millions of users with investor-grade polish
 */

export const BrandColors = {
  // Primary Brand Colors (Updated to Neon/Cyberpunk aesthetic)
  loopBlue: '#00BFFF',      // Neon Cyan - primary CTA
  loopBlueLight: '#33CFFF',  // Lighter cyan for highlights
  loopBlueDark: '#00A0E3',   // Darker cyan for pressed states

  loopGreen: '#00FF9F',     // Neon Mint Green - success/secondary
  loopGreenLight: '#33FFB2', // Lighter mint for highlights
  loopGreenDark: '#00E38C',  // Darker mint for pressed states

  loopOrange: '#FF9500',    // Orange for warnings/highlights
  loopOrangeLight: '#FFB340', // Lighter orange
  loopOrangeDark: '#E08500',  // Darker orange

  // Neutral Palette (Modern, High Contrast)
  black: '#000000',
  almostBlack: '#0A0A0A',
  darkGray: '#1C1C1E',      // iOS 13 dark card
  mediumGray: '#2C2C2E',
  lightGray: '#48484A',
  veryLightGray: '#8E8E93',

  white: '#FFFFFF',
  offWhite: '#F9F9F9',
  lightBackground: '#F2F2F7', // iOS light background

  // Semantic Colors
  success: '#00D9A3',
  error: '#FF3B30',
  warning: '#FF9500',
  info: '#0066FF',

  // Social/Engagement Colors (Instagram-inspired)
  like: '#FF3B6C',          // Heart red
  star: '#FFD700',          // Star yellow
  verified: '#0066FF',      // Verified blue

  // Opacity Variants (for overlays)
  blackOverlay: 'rgba(0, 0, 0, 0.4)',
  whiteOverlay: 'rgba(255, 255, 255, 0.9)',
  blueOverlay: 'rgba(0, 102, 255, 0.1)',
  greenOverlay: 'rgba(0, 217, 163, 0.1)',
};

export const ThemeColors = {
  light: {
    // Backgrounds
    background: BrandColors.white,
    backgroundSecondary: BrandColors.lightBackground,
    card: BrandColors.white,
    cardBackground: BrandColors.white, // Alias for card
    cardElevated: BrandColors.white,

    // Text
    text: BrandColors.almostBlack,
    textSecondary: BrandColors.veryLightGray,
    textTertiary: BrandColors.lightGray,

    // Brand
    primary: BrandColors.loopBlueDark, // Using darker cyan for better visibility
    primaryLight: BrandColors.loopBlue,
    primaryDark: BrandColors.loopBlueDark,
    secondary: BrandColors.loopGreen,
    secondaryLight: BrandColors.loopGreenLight,
    secondaryDark: BrandColors.loopGreenDark,

    // UI Elements
    border: '#E5E5EA',
    borderLight: '#F2F2F7',
    separator: '#C6C6C8',
    shadow: 'rgba(0, 0, 0, 0.1)',
    icon: BrandColors.veryLightGray, // Icon tint color

    // Interactive
    tabIconDefault: BrandColors.veryLightGray,
    tabIconSelected: BrandColors.loopBlueDark,
    tint: BrandColors.loopBlueDark,

    // Feedback
    success: BrandColors.success,
    error: BrandColors.error,
    warning: BrandColors.warning,
    like: BrandColors.like,
  },

  dark: {
    // Backgrounds (True black for OLED)
    background: BrandColors.black,
    backgroundSecondary: BrandColors.almostBlack,
    card: BrandColors.darkGray,
    cardBackground: BrandColors.darkGray, // Alias for card
    cardElevated: BrandColors.mediumGray,

    // Text
    text: BrandColors.white,
    textSecondary: BrandColors.veryLightGray,
    textTertiary: BrandColors.lightGray,

    // Brand
    primary: BrandColors.loopBlueDark, // Using darker cyan for better visibility
    primaryLight: BrandColors.loopBlue,
    primaryDark: BrandColors.loopBlueDark,
    secondary: BrandColors.loopGreen,
    secondaryLight: BrandColors.loopGreenLight,
    secondaryDark: BrandColors.loopGreenDark,

    // UI Elements
    border: BrandColors.mediumGray,
    borderLight: BrandColors.darkGray,
    separator: BrandColors.lightGray,
    shadow: 'rgba(0, 0, 0, 0.5)',
    icon: BrandColors.veryLightGray, // Icon tint color

    // Interactive
    tabIconDefault: BrandColors.veryLightGray,
    tabIconSelected: BrandColors.loopBlueDark,
    tint: BrandColors.loopBlueDark,

    // Feedback
    success: BrandColors.success,
    error: BrandColors.error,
    warning: BrandColors.warning,
    like: BrandColors.like,
  },
};

// Typography Scale (Modern, Responsive)
export const Typography = {
  // Display (Hero text)
  displayLarge: {
    fontSize: 57,
    lineHeight: 64,
    fontWeight: '700' as const,
    letterSpacing: -0.25,
  },
  displayMedium: {
    fontSize: 45,
    lineHeight: 52,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  displaySmall: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },

  // Headlines (Section titles)
  headlineLarge: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  headlineMedium: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  headlineSmall: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },

  // Titles (Card/List headers)
  titleLarge: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  titleMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
    letterSpacing: 0.15,
  },
  titleSmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },

  // Body (Main content)
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
    letterSpacing: 0.5,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: 0.25,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    letterSpacing: 0.4,
  },

  // Labels (Buttons, tabs)
  labelLarge: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },

  // Shorthand aliases (for backward compatibility)
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: 0.25,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    letterSpacing: 0.4,
  },
};

// Spacing System (8pt grid)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Border Radius (Modern, rounded)
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

// Shadows (Elevation)
export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
};

// Animation Timing (Snappy, responsive)
export const Animation = {
  fast: 150,
  medium: 250,
  slow: 350,
  verySlow: 500,

  // Easing curves
  easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)',
};

// Layout Constants
export const Layout = {
  screenPadding: Spacing.md,
  cardSpacing: Spacing.md,
  sectionSpacing: Spacing.xl,
  maxContentWidth: 600, // For tablets/web
};
