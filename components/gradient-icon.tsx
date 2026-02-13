/**
 * Gradient Icon Component
 * Creates a gradient mask for tab bar icons
 *
 * UX ENHANCEMENT (v2.0):
 * - Emerald → Blue gradient for "For You" tab (updated colors)
 * - Subtle scale animation on selection
 * - Consistent with new mature color palette
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated as RNAnimated, Easing, Platform } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors } from '@/constants/brand';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { TabBadge } from '@/components/tab-badge';

/**
 * Custom SVG sparkles icon for Android
 * Matches SF Symbols "sparkles" — three four-pointed stars
 * Large star lower-right, medium star upper-left, tiny star between/above
 */
function SparklesIcon({ size, color }: { size: number; color: string }) {
  // Four-pointed star via cubic bezier curves
  // inner ratio 0.18 gives slightly wider, higher-quality points
  const star = (cx: number, cy: number, r: number) => {
    const c = r * 0.18;
    return [
      `M${cx} ${cy - r}`,
      `C${cx + c} ${cy - c}, ${cx + c} ${cy - c}, ${cx + r} ${cy}`,
      `C${cx + c} ${cy + c}, ${cx + c} ${cy + c}, ${cx} ${cy + r}`,
      `C${cx - c} ${cy + c}, ${cx - c} ${cy + c}, ${cx - r} ${cy}`,
      `C${cx - c} ${cy - c}, ${cx - c} ${cy - c}, ${cx} ${cy - r}`,
      'Z',
    ].join(' ');
  };

  return (
    <Svg width={size} height={size} viewBox="-2 -2 52 52" fill="none">
      <Path d={star(30, 28, 20)} fill={color} />
      <Path d={star(10, 12, 8.5)} fill={color} />
      <Path d={star(22, 3.5, 4.2)} fill={color} />
    </Svg>
  );
}

interface GradientIconProps {
  name?: string;
  size: number;
  focused: boolean;
  customIcon?: (props: { size: number; color: string }) => React.ReactNode;
  showBadge?: boolean;
  badgeCount?: number;
}

export function GradientIcon({ name, size, focused, customIcon, showBadge = false, badgeCount = 0 }: GradientIconProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Animation for scale effect when selected
  const scaleAnim = useRef(new RNAnimated.Value(focused ? 1 : 0.9)).current;

  useEffect(() => {
    RNAnimated.spring(scaleAnim, {
      toValue: focused ? 1 : 0.9,
      friction: 6,
      tension: 300,
      useNativeDriver: true,
    }).start();
  }, [focused, scaleAnim]);

  const renderIcon = (iconColor: string) => {
    if (customIcon) {
      return customIcon({ size, color: iconColor });
    }
    // Use custom SVG sparkles on Android for crisp, properly-spaced rendering
    if (name === 'sparkles' && Platform.OS === 'android') {
      return <SparklesIcon size={size} color={iconColor} />;
    }
    return <IconSymbol size={size} name={name as any} color={iconColor} />;
  };

  // If not focused, use same dark gray as other tab icons
  if (!focused) {
    return (
      <TabBadge showDot={showBadge} count={badgeCount}>
        <RNAnimated.View style={{ transform: [{ scale: scaleAnim }] }}>
          {renderIcon(colors.tabIconDefault)}
        </RNAnimated.View>
      </TabBadge>
    );
  }

  return (
    <TabBadge showDot={showBadge} count={badgeCount}>
      <RNAnimated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <MaskedView
          maskElement={
            <View style={{ backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {renderIcon('white')}
            </View>
          }
        >
          <LinearGradient
            colors={[BrandColors.loopGreen, BrandColors.loopBlue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: size, height: size }}
          />
        </MaskedView>
      </RNAnimated.View>
    </TabBadge>
  );
}
