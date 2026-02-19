/**
 * Loop Brand Design System
 * Sophisticated, mature color palette with harmonious chart colors
 * Built for millions of users with investor-grade polish
 *
 * COLOR PALETTE v3.0 (User-Approved):
 * - Primary Cyan (#00A6D9) - vibrant yet professional
 * - Primary Green (#09DB98) - fresh and distinct
 * - Harmonious chart colors for score breakdown (no visual noise)
 * - Full color scales provided for variants
 */

export const BrandColors = {
  // ============================================================================
  // PRIMARY BRAND COLORS (User-Approved v3.0)
  // ============================================================================

  // PRIMARY CYAN SCALE (for loopBlue)
  // 50: #E6F9FF, 100: #B8EEFF, 200: #8AE4FF, 300: #5CD9FF, 400: #2ECEFF
  // 500: #00C3FF, 600: #00A6D9 ← PRIMARY, 700: #007DA3, 800: #005A75, 900: #003747
  // PREVIOUS: '#4A80F0' (Material Blue 500 - too purple)
  loopBlue: '#00A6D9',       // Primary Cyan - vibrant yet professional
  loopBlueLight: '#2ECEFF',  // Cyan 400 - bright highlight
  loopBlueDark: '#007DA3',   // Cyan 700 - pressed states, dark variant

  // Strong Match Highlight (matches new cyan palette)
  // PREVIOUS: '#3B82F6'
  strongMatchGlow: '#00A6D9', // Same as loopBlue for cohesion

  // PRIMARY GREEN SCALE (for loopGreen)
  // 50: #09DB98 ← PRIMARY, 100: #34D296, 200: #47C993, 300: #55C091
  // PREVIOUS: '#10B981' (Emerald 500 - too dark/muted)
  loopGreen: '#09DB98',      // Primary Green - fresh, vibrant
  loopGreenLight: '#34D296', // Green 100 - softer highlight
  loopGreenDark: '#47C993',  // Green 200 - pressed states

  // ORANGE (unchanged - already good)
  loopOrange: '#F59E0B',     // Amber 500 - warm, friendly
  loopOrangeLight: '#FBBF24', // Amber 400 - highlight
  loopOrangeDark: '#D97706',  // Amber 600 - pressed states

  // ============================================================================
  // ACCENT COLORS (for charts, highlights, variety)
  // ============================================================================
  accentLime: '#D1E800',     // Bright lime - attention-grabbing
  accentYellow: '#F0DA6A',   // Warm yellow - friendly
  accentGold: '#EDB95A',     // Premium gold - achievement
  accentPurple: '#553C96',   // Deep purple - sophisticated

  // ============================================================================
  // NEUTRAL PALETTE (Unchanged - already modern and high contrast)
  // ============================================================================
  black: '#000000',
  almostBlack: '#0A0A0A',
  darkGray: '#1C1C1E',      // iOS 13 dark card
  mediumGray: '#2C2C2E',
  lightGray: '#48484A',
  veryLightGray: '#8E8E93',

  white: '#FFFFFF',
  offWhite: '#F9F9F9',
  lightBackground: '#F2F2F7', // iOS light background

  // ============================================================================
  // SEMANTIC COLORS (Updated to match v3.0 palette)
  // ============================================================================
  success: '#09DB98',        // Matches loopGreen for consistency
  error: '#EF4444',          // Tailwind Red 500 - slightly softer than iOS red
  warning: '#F59E0B',        // Matches loopOrange
  info: '#00A6D9',           // Matches loopBlue - cohesive palette

  // ============================================================================
  // SOCIAL/ENGAGEMENT COLORS (Refined)
  // ============================================================================
  like: '#EC4899',           // Pink 500 - modern heart color
  star: '#F59E0B',           // Amber 500 - star/rating gold
  verified: '#00A6D9',       // Matches loopBlue - verified badge

  // ============================================================================
  // OPACITY VARIANTS (Updated to use v3.0 colors)
  // ============================================================================
  blackOverlay: 'rgba(0, 0, 0, 0.4)',
  whiteOverlay: 'rgba(255, 255, 255, 0.9)',
  blueOverlay: 'rgba(0, 166, 217, 0.1)',   // Based on new loopBlue #00A6D9
  greenOverlay: 'rgba(9, 219, 152, 0.1)',  // Based on new loopGreen #09DB98

  // ============================================================================
  // BOTTOM SHEET COLORS (Updated accents to match new palette)
  // ============================================================================
  sheetBackground: '#1C1C1E',        // Dark gray background (YouTube-inspired)
  sheetHandle: '#3A3A3C',            // Handle indicator (subtle gray)
  sheetText: '#FFFFFF',              // Primary text (white)
  sheetSubtext: '#8E8E93',           // Secondary text (light gray)
  sheetBorder: '#3A3A3C',            // Separator lines (subtle gray)
  sheetDestructive: '#EF4444',       // Matches error color
  sheetBackdrop: 'rgba(0,0,0,0.5)',  // Semi-transparent black backdrop

  // Loop Brand Accents for Bottom Sheets (v3.0)
  sheetPrimaryAction: '#00A6D9',     // Matches new loopBlue
  sheetFeaturedAction: '#F59E0B',    // Matches loopOrange
  sheetPrimaryActionPressed: '#007DA3', // Matches new loopBlueDark

  // ============================================================================
  // EXTENDED PALETTE (Slightly refined for cohesion)
  // ============================================================================
  loopPurple: '#8B5CF6',    // Violet 500 - unchanged, already good
  loopViolet: '#8B5CF6',   // Alias for loopPurple — used in card-action-menu, radar, etc.
  loopPink: '#EC4899',      // Pink 500 - unchanged, already good
  loopIndigo: '#6366F1',    // Indigo 500 - unchanged, already good
  loopTeal: '#14B8A6',      // Teal 500 - unchanged, already good
  gray: '#8E8E93',           // iOS system gray — alias for veryLightGray

  // ============================================================================
  // ROUTE LINE COLORS (Google Maps navigation inspired)
  // ============================================================================
  routeCompleted: '#1A73E8',        // Google Maps blue - bold, authoritative
  routeCompletedBorder: '#0D47A1',  // Darker navy border for completed routes
  routeFuture: '#90CAF9',           // Light blue - clearly lighter than completed
  routeFutureBorder: '#5B9BD5',     // Medium blue border for future routes
  routeInProgress: '#1A73E8',       // Same blue as completed, animated opacity
  routeInProgressBorder: '#0D47A1', // Same border as completed
};

// Category colors for calendar events and activity cards
export const CategoryColors: Record<string, string> = {
  dining: '#EF4444',         // Red 500 - warmer, more appetizing
  entertainment: BrandColors.loopBlue,
  fitness: BrandColors.loopGreen,
  social: BrandColors.loopPurple,
  work: BrandColors.loopIndigo,
  personal: BrandColors.loopOrange,
  travel: BrandColors.loopTeal,
  other: BrandColors.veryLightGray,
};

// Score bar segment colors (stacked bar in activity cards)
// MUTED DATA-VIZ PALETTE — understated, distinct, professional
// Desaturated tones inspired by Linear/Stripe dashboards
export const ScoreBarColors = {
  interest: '#5B8DEF',    // Soft blue - primary factor, trustworthy
  location: '#4DBBA1',    // Sage green - grounded, proximity
  time: '#9B8ACA',        // Dusty lavender - calm, temporal
  feedback: '#E8845A',    // Muted coral - warm personal touch
  social: '#7C8DB5',      // Slate blue - subtle, collaborative
};

// Alias for components that import ChartColors
export const ChartColors = ScoreBarColors;

// Match score tile colors (5-tier) - Updated to new cyan/green palette
export const MatchScoreColors = {
  excellent: { color: '#09DB98', bg: 'rgba(9, 219, 152, 0.12)' },    // 85+ (primary green)
  good:      { color: '#00A6D9', bg: 'rgba(0, 166, 217, 0.12)' },    // 75-84 (primary cyan)
  fair:      { color: '#2ECEFF', bg: 'rgba(46, 206, 255, 0.12)' },   // 60-74 (light cyan)
  average:   { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },   // 35-59 (amber)
  low:       { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' },    // <35 (red)
};

// Context badge colors (for context-detection service)
// Uses new mature palette for professional appearance
export const ContextBadgeColors: Record<string, string> = {
  free: BrandColors.loopGreen,         // #10B981 - emerald
  available: BrandColors.loopBlue,     // #4A80F0 - material blue
  on_route: BrandColors.loopPurple,    // #8B5CF6 - violet
  friend_loves: BrandColors.loopPink,  // #EC4899 - pink
  group_friendly: BrandColors.loopOrange, // #F59E0B - amber
  before_event: BrandColors.loopIndigo,   // #6366F1 - indigo
  after_event: BrandColors.loopIndigo,    // #6366F1 - indigo
  walking_distance: BrandColors.loopTeal, // #14B8A6 - teal
  time_limited: BrandColors.error,        // #EF4444 - red
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

    // Brand (Updated to use new mature blue palette)
    primary: BrandColors.loopBlue,     // #4A80F0 - primary actions
    primaryLight: BrandColors.loopBlueLight,
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

    // Interactive (Updated to use new blue)
    tabIconDefault: BrandColors.veryLightGray,
    tabIconSelected: BrandColors.loopBlue,  // Use main blue for better visibility
    tint: BrandColors.loopBlue,

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

    // Brand (Updated to use new mature blue palette)
    primary: BrandColors.loopBlue,     // #4A80F0 - primary actions (same as light for consistency)
    primaryLight: BrandColors.loopBlueLight,
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

    // Interactive (Updated to use new blue)
    tabIconDefault: BrandColors.veryLightGray,
    tabIconSelected: BrandColors.loopBlue,  // Use main blue for better visibility
    tint: BrandColors.loopBlue,

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
