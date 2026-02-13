/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#00A0E3'; // Darker Neon Cyan - matches BrandColors.loopBlueDark
const tintColorDark = '#00A0E3'; // Darker Neon Cyan (same in dark mode for consistency)

export const Colors = {
  light: {
    text: '#11181C',
    textSecondary: '#2C3338',      // Very dark gray for headers (slightly lighter than text)
    background: '#F5F5F5',         // Slightly darker white like eBay
    tint: tintColorLight,
    icon: '#3A3F44',               // Darker gray for navbar icons (was #687076)
    tabIconDefault: '#3A3F44',     // Darker gray for inactive tabs (was #687076)
    tabIconSelected: tintColorLight,
    card: '#ffffff',
    border: '#e0e0e0',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#C8CACC',      // Slightly dimmer than pure white for headers
    background: '#0D0D0D',         // Darker background for more navbar contrast (was #151718)
    tint: tintColorDark,
    icon: '#FFFFFF',               // White icons like eBay (was #6B7075)
    tabIconDefault: '#FFFFFF',     // White inactive tabs like eBay (was #6B7075)
    tabIconSelected: tintColorDark,
    card: '#161618',               // Match tab bar for cohesive dark mode (was #1A1A1A)
    border: '#2A2A2C',             // Darker, subtler border (was #2f3133)
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
