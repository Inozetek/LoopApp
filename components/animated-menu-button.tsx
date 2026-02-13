/**
 * Animated Menu Button (Grok-style)
 *
 * Premium hamburger menu button with:
 * - Hamburger-to-chevron morphing animation
 * - Pressed state with glow effect
 * - 120fps spring animations
 */

import React from 'react';
import { StyleSheet, Pressable, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GROK_SPRING } from '@/constants/animations';
import { BrandColors } from '@/constants/brand';

interface AnimatedMenuButtonProps {
  isOpen: boolean;
  onPress: () => void;
  color?: string;
  size?: number;
}

export function AnimatedMenuButton({
  isOpen,
  onPress,
  color = '#FFFFFF',
  size = 26,
}: AnimatedMenuButtonProps) {
  // Animation values
  const pressed = useSharedValue(0);
  const morphProgress = useSharedValue(isOpen ? 1 : 0);

  // Update morph animation when isOpen changes
  React.useEffect(() => {
    morphProgress.value = withSpring(isOpen ? 1 : 0, GROK_SPRING);
  }, [isOpen]);

  // Pressed glow style
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [0, 0.6], Extrapolate.CLAMP),
    transform: [{ scale: interpolate(pressed.value, [0, 1], [0.8, 1.2], Extrapolate.CLAMP) }],
  }));

  // Container scale on press
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.92], Extrapolate.CLAMP) }],
  }));

  // Hamburger line animations for morphing to chevron
  const lineWidth = size * 0.75;
  const lineHeight = 2;
  const lineSpacing = 5;

  // Top line - rotates to form top of chevron
  const topLineStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      morphProgress.value,
      [0, 1],
      [0, 45],
      Extrapolate.CLAMP
    );
    const translateY = interpolate(
      morphProgress.value,
      [0, 1],
      [0, lineSpacing + lineHeight / 2],
      Extrapolate.CLAMP
    );
    const translateX = interpolate(
      morphProgress.value,
      [0, 1],
      [0, 2],
      Extrapolate.CLAMP
    );
    const width = interpolate(
      morphProgress.value,
      [0, 1],
      [lineWidth, lineWidth * 0.6],
      Extrapolate.CLAMP
    );

    return {
      width,
      transform: [
        { translateY },
        { translateX },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  // Middle line - fades out
  const middleLineStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      morphProgress.value,
      [0, 0.3],
      [1, 0],
      Extrapolate.CLAMP
    );
    const scaleX = interpolate(
      morphProgress.value,
      [0, 0.3],
      [1, 0],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ scaleX }],
    };
  });

  // Bottom line - rotates to form bottom of chevron
  const bottomLineStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      morphProgress.value,
      [0, 1],
      [0, -45],
      Extrapolate.CLAMP
    );
    const translateY = interpolate(
      morphProgress.value,
      [0, 1],
      [0, -(lineSpacing + lineHeight / 2)],
      Extrapolate.CLAMP
    );
    const translateX = interpolate(
      morphProgress.value,
      [0, 1],
      [0, 2],
      Extrapolate.CLAMP
    );
    const width = interpolate(
      morphProgress.value,
      [0, 1],
      [lineWidth, lineWidth * 0.6],
      Extrapolate.CLAMP
    );

    return {
      width,
      transform: [
        { translateY },
        { translateX },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPressIn={() => {
        pressed.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, { damping: 15, stiffness: 400 });
      }}
      onPress={handlePress}
      style={styles.pressable}
    >
      <Animated.View style={[styles.container, containerStyle]}>
        {/* Glow effect */}
        <Animated.View style={[styles.glowContainer, glowStyle]}>
          <LinearGradient
            colors={[
              `${BrandColors.loopBlue}00`,
              `${BrandColors.loopBlue}40`,
              `${BrandColors.loopBlue}60`,
              `${BrandColors.loopBlue}40`,
              `${BrandColors.loopBlue}00`,
            ]}
            style={styles.glow}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
          />
        </Animated.View>

        {/* Hamburger lines container */}
        <View style={[styles.linesContainer, { width: size, height: size }]}>
          {/* Top line */}
          <Animated.View
            style={[
              styles.line,
              { backgroundColor: color, height: lineHeight },
              topLineStyle,
            ]}
          />

          {/* Middle line */}
          <Animated.View
            style={[
              styles.line,
              {
                backgroundColor: color,
                height: lineHeight,
                width: lineWidth,
              },
              middleLineStyle,
            ]}
          />

          {/* Bottom line */}
          <Animated.View
            style={[
              styles.line,
              { backgroundColor: color, height: lineHeight },
              bottomLineStyle,
            ]}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    padding: 8,
  },
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowContainer: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  glow: {
    flex: 1,
    borderRadius: 24,
  },
  linesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  line: {
    borderRadius: 1,
  },
});
