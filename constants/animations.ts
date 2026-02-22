/**
 * Animation Constants
 *
 * Grok-quality spring configurations and timing constants
 * for premium, native-feeling animations throughout the app.
 */

import { Easing } from 'react-native-reanimated';

/**
 * Grok-Quality Spring Configuration
 *
 * This is the "secret sauce" - matches iOS native feel exactly.
 * damping ratio of 0.8 creates smooth, premium animations.
 */
export const GROK_SPRING = {
  duration: 350,
  dampingRatio: 0.8,
} as const;

/**
 * Alternative spring config using traditional parameters
 * Use this when you need more control over the physics
 */
export const GROK_SPRING_PHYSICS = {
  damping: 15,
  mass: 0.8,
  stiffness: 120,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
} as const;

/**
 * Quick spring for micro-interactions
 * (button presses, icon bounces)
 */
export const QUICK_SPRING = {
  duration: 200,
  dampingRatio: 0.7,
} as const;

/**
 * Slower spring for larger motions
 * (modals, sheets, full-screen transitions)
 */
export const MODAL_SPRING = {
  duration: 400,
  dampingRatio: 0.85,
} as const;

/**
 * Menu open spring — slower, smoother for icon press / programmatic open.
 * Gives a premium, deliberate feel (vs the snappier GROK_SPRING used for close).
 */
export const MENU_OPEN_SPRING = {
  duration: 500,
  dampingRatio: 0.82,
} as const;

/**
 * Snappy spring for collapsible sections
 */
export const COLLAPSIBLE_SPRING = {
  duration: 300,
  dampingRatio: 0.75,
} as const;

/**
 * Timing configurations
 */
export const TIMING = {
  /** Fast fade for backdrops */
  backdropFadeIn: { duration: 200 },
  backdropFadeOut: { duration: 150 },

  /** Content fade with easing */
  contentFadeIn: {
    duration: 200,
    easing: Easing.out(Easing.quad),
  },
  contentFadeOut: {
    duration: 100,
    easing: Easing.in(Easing.quad),
  },

  /** Blur transitions */
  blurIn: {
    duration: 300,
    easing: Easing.out(Easing.cubic),
  },
  blurOut: {
    duration: 150,
    easing: Easing.in(Easing.quad),
  },

  /** Scale animations */
  scaleIn: {
    duration: 150,
    easing: Easing.out(Easing.quad),
  },
  scaleOut: {
    duration: 100,
    easing: Easing.in(Easing.quad),
  },
} as const;

/**
 * Backdrop opacity values
 */
export const BACKDROP = {
  /** Standard modal backdrop opacity */
  modal: 0.4,
  /** Lighter backdrop for popovers */
  popover: 0.2,
  /** Darker backdrop for critical modals */
  critical: 0.6,
} as const;

/**
 * Animation delays
 */
export const DELAYS = {
  /** Stagger delay for list items */
  stagger: 50,
  /** Delay before content appears in modal */
  contentAppear: 50,
  /** Delay before backdrop fades out on close */
  backdropFadeDelay: 50,
} as const;

/**
 * Scale values for animations
 */
export const SCALES = {
  /** Initial scale for modals appearing */
  modalInitial: 0.95,
  /** Scale when pressed */
  pressed: 0.97,
  /** Normal scale */
  normal: 1,
  /** Main content scale when side menu is open */
  menuOpen: 0.92,
} as const;

/**
 * Menu spring configuration
 * Optimized for Grok-style side menu drawer
 */
export const MENU_SPRING = {
  mass: 1,
  stiffness: 100,
  damping: 12,
  overshootClamping: true,
} as const;

/**
 * Side menu dimensions
 */
export const MENU_DIMENSIONS = {
  /** Width as percentage of screen */
  widthPercentage: 0.85,
  /** Main content offset when menu is open */
  contentOffsetPercentage: 0.3,
  /** Border radius of main content when menu is open */
  contentBorderRadius: 20,
  /** Velocity threshold for gesture-based closing */
  velocityThreshold: 500,
  /** Drag threshold percentage for closing */
  dragThreshold: 0.3,
} as const;

/**
 * Menu blur / glass effect constants
 * Lower overlay opacity lets the BlurView show through for a frosted-glass look.
 */
export const BLUR = {
  menuIntensityIOS: 100,
  menuIntensityAndroid: 120,
  overlayOpacityDark: 0.55,
  overlayOpacityLight: 0.60,
} as const;

/**
 * Menu content blur / transition constants
 * Grok-style dual-direction blur swap when menu opens:
 * - Background (main content): sharp → blurred + scaled + shifted
 * - Menu content: blurred/invisible → sharp/opaque (materialization)
 */
export const MENU_CONTENT_BLUR = {
  /** Max blur intensity on the background when menu is open (iOS) */
  backgroundBlurIntensity: 140,
  /** Starting blur on menu content before it sharpens (iOS: intensity animates down; Android: fixed intensity, opacity fades) */
  menuMaterializeBlur: 70,
  /** Background scale when menu is open */
  contentScale: 0.92,
  /** Background shift to the right (px) */
  contentTranslateX: 60,
  /** Rounded corners on background */
  contentBorderRadius: 20,
  /** Backdrop opacity behind the drawer (solid black feel) */
  backdropOpacity: 0.85,
  /** Lighter backdrop for light mode (frosted, not opaque) */
  backdropOpacityLight: 0.35,
  /** Blur intensity on the drawer panel itself (frosted glass) */
  drawerBlurIntensity: 120,
  /** Starting opacity of drawer dark overlay (panel bg) */
  drawerMinOpacity: 0.55,
  /** Final opacity of drawer dark overlay when fully open */
  drawerMaxOpacity: 0.97,
} as const;

/**
 * Bottom sheet blur constants for frosted glass modals
 */
export const BOTTOM_SHEET_BLUR = {
  /** Backdrop blur intensity for native platforms (iOS + Android via dimezisBlurView) */
  backdropIntensityIOS: 25,
  /** Backdrop blur intensity fallback for web / opacity-based path */
  backdropIntensityAndroid: 35,
  /** Semi-transparent overlay on top of blur */
  backdropOverlayOpacity: 0.25,
  /** Sheet scale when appearing (materialization) */
  sheetInitialScale: 0.97,
} as const;
