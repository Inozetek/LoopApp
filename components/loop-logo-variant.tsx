/**
 * Loop Logo Variant Component
 *
 * Venn diagram-style logo with two overlapping circles:
 * - Left circle: Cyan (#00A6D9 range)
 * - Right circle: Green (#09DB98 range)
 * - Thin strokes only with very transparent fill
 * - Overlap area shows blended colors
 *
 * Usage in Calendar Header: "L [logo] P" spells "LOOP"
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, Mask, Rect, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BrandColors } from '@/constants/brand';

interface LoopLogoVariantProps {
  size?: number;
  style?: ViewStyle;
  flat?: boolean; // Solid colors without gradients
}

export function LoopLogoVariant({ size = 24, style, flat = false }: LoopLogoVariantProps) {
  // Use a larger internal viewBox for crisper rendering, then scale down
  const scale = 4;
  const internalSize = size * scale;

  const svgWidth = size * 1.4;
  const svgHeight = size;
  const viewBoxWidth = internalSize * 1.4;
  const viewBoxHeight = internalSize;

  const circleRadius = internalSize * 0.36;
  const strokeWidth = internalSize * 0.11; // Slightly thicker for more presence

  // Circle positions (overlapping by ~30%)
  const leftCenterX = viewBoxWidth * 0.36;
  const rightCenterX = viewBoxWidth * 0.64;
  const centerY = viewBoxHeight / 2;

  // Flat mode: solid colors, no gradients
  if (flat) {
    return (
      <View style={[{ width: svgWidth, height: svgHeight }, style]}>
        <Svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        >
          <Circle
            cx={leftCenterX}
            cy={centerY}
            r={circleRadius}
            fill="rgba(0, 166, 217, 0.12)"
            stroke="#00A6D9"
            strokeWidth={strokeWidth}
          />
          <Circle
            cx={rightCenterX}
            cy={centerY}
            r={circleRadius}
            fill="rgba(9, 219, 152, 0.12)"
            stroke="#09DB98"
            strokeWidth={strokeWidth}
          />
        </Svg>
      </View>
    );
  }

  return (
    <View style={[{ width: svgWidth, height: svgHeight }, style]}>
      <Svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      >
        <Defs>
          {/* Enhanced cyan gradient - more depth and shine */}
          <LinearGradient id="cyanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#7DD8FF" stopOpacity="1" />
            <Stop offset="25%" stopColor="#00BFFF" stopOpacity="1" />
            <Stop offset="50%" stopColor="#00A6D9" stopOpacity="1" />
            <Stop offset="75%" stopColor="#0090C0" stopOpacity="1" />
            <Stop offset="100%" stopColor="#00A6D9" stopOpacity="1" />
          </LinearGradient>

          {/* Enhanced green gradient - more depth and shine */}
          <LinearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#6FFFB8" stopOpacity="1" />
            <Stop offset="25%" stopColor="#2EE89E" stopOpacity="1" />
            <Stop offset="50%" stopColor="#09DB98" stopOpacity="1" />
            <Stop offset="75%" stopColor="#00C080" stopOpacity="1" />
            <Stop offset="100%" stopColor="#09DB98" stopOpacity="1" />
          </LinearGradient>

          {/* Inner glow for left circle - more visible */}
          <LinearGradient id="cyanFill" x1="50%" y1="0%" x2="50%" y2="100%">
            <Stop offset="0%" stopColor="#00BFFF" stopOpacity="0.35" />
            <Stop offset="50%" stopColor="#00A6D9" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#0090C0" stopOpacity="0.15" />
          </LinearGradient>

          {/* Inner glow for right circle - more visible */}
          <LinearGradient id="greenFill" x1="50%" y1="0%" x2="50%" y2="100%">
            <Stop offset="0%" stopColor="#2EE89E" stopOpacity="0.35" />
            <Stop offset="50%" stopColor="#09DB98" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#00C080" stopOpacity="0.15" />
          </LinearGradient>
        </Defs>

        {/* Left circle (Cyan) - drawn first */}
        <Circle
          cx={leftCenterX}
          cy={centerY}
          r={circleRadius}
          fill="url(#cyanFill)"
          stroke="url(#cyanGradient)"
          strokeWidth={strokeWidth}
        />

        {/* Right circle (Green) - semi-transparent fill blends with cyan in overlap */}
        <Circle
          cx={rightCenterX}
          cy={centerY}
          r={circleRadius}
          fill="url(#greenFill)"
          stroke="url(#greenGradient)"
          strokeWidth={strokeWidth}
        />
      </Svg>
    </View>
  );
}

/**
 * Metallic 3D version of the Loop logo
 * Ultra-realistic chrome look with thick extruded rings
 * Inspired by luxury brand 3D logos (Chanel-style chrome)
 */
interface LoopLogoMetallicProps {
  size?: number;
  style?: ViewStyle;
}

export function LoopLogoMetallic({ size = 24, style }: LoopLogoMetallicProps) {
  const svgWidth = size * 1.6;
  const svgHeight = size * 1.2;
  const circleRadius = size * 0.28;
  const ringThickness = size * 0.22; // MUCH thicker for real 3D depth

  const leftCenterX = svgWidth * 0.38;
  const rightCenterX = svgWidth * 0.62;
  const centerY = svgHeight / 2;

  return (
    <View style={[{ width: svgWidth, height: svgHeight }, style]}>
      <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        <Defs>
          {/* Chrome cyan - ultra realistic with sharp highlight bands */}
          <LinearGradient id="chromeCyan" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#E8FCFF" stopOpacity="1" />
            <Stop offset="8%" stopColor="#00E5FF" stopOpacity="1" />
            <Stop offset="20%" stopColor="#00B8D4" stopOpacity="1" />
            <Stop offset="35%" stopColor="#004D5C" stopOpacity="1" />
            <Stop offset="45%" stopColor="#001F26" stopOpacity="1" />
            <Stop offset="55%" stopColor="#003D4D" stopOpacity="1" />
            <Stop offset="70%" stopColor="#00ACC1" stopOpacity="1" />
            <Stop offset="85%" stopColor="#4DD0E1" stopOpacity="1" />
            <Stop offset="92%" stopColor="#E0F7FA" stopOpacity="1" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
          </LinearGradient>

          {/* Chrome green - matching style */}
          <LinearGradient id="chromeGreen" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#E8FFF5" stopOpacity="1" />
            <Stop offset="8%" stopColor="#00E676" stopOpacity="1" />
            <Stop offset="20%" stopColor="#00C853" stopOpacity="1" />
            <Stop offset="35%" stopColor="#005C35" stopOpacity="1" />
            <Stop offset="45%" stopColor="#00261A" stopOpacity="1" />
            <Stop offset="55%" stopColor="#004D2E" stopOpacity="1" />
            <Stop offset="70%" stopColor="#00C853" stopOpacity="1" />
            <Stop offset="85%" stopColor="#69F0AE" stopOpacity="1" />
            <Stop offset="92%" stopColor="#E0FFF0" stopOpacity="1" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
          </LinearGradient>

          {/* Outer edge - dark for depth illusion */}
          <LinearGradient id="outerEdgeCyan" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#006064" stopOpacity="1" />
            <Stop offset="50%" stopColor="#001519" stopOpacity="1" />
            <Stop offset="100%" stopColor="#004D40" stopOpacity="1" />
          </LinearGradient>

          <LinearGradient id="outerEdgeGreen" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#1B5E20" stopOpacity="1" />
            <Stop offset="50%" stopColor="#0A1F0D" stopOpacity="1" />
            <Stop offset="100%" stopColor="#2E7D32" stopOpacity="1" />
          </LinearGradient>

          {/* Inner edge highlight - bright for 3D pop */}
          <LinearGradient id="innerHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <Stop offset="15%" stopColor="#FFFFFF" stopOpacity="0.7" />
            <Stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.1" />
            <Stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="85%" stopColor="#FFFFFF" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.8" />
          </LinearGradient>

          {/* Sharp specular streak */}
          <LinearGradient id="specularStreak" x1="20%" y1="0%" x2="80%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="40%" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="48%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="52%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* === LEFT RING (CYAN) === */}

        {/* Drop shadow */}
        <Circle
          cx={leftCenterX + 2}
          cy={centerY + 3}
          r={circleRadius + ringThickness * 0.5}
          fill="none"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth={ringThickness * 0.3}
        />

        {/* Outer dark edge - creates depth */}
        <Circle
          cx={leftCenterX}
          cy={centerY}
          r={circleRadius + ringThickness * 0.48}
          fill="none"
          stroke="url(#outerEdgeCyan)"
          strokeWidth={ringThickness * 0.08}
        />

        {/* Main chrome body */}
        <Circle
          cx={leftCenterX}
          cy={centerY}
          r={circleRadius}
          fill="none"
          stroke="url(#chromeCyan)"
          strokeWidth={ringThickness}
        />

        {/* Inner bright edge - makes it pop */}
        <Circle
          cx={leftCenterX}
          cy={centerY}
          r={circleRadius - ringThickness * 0.48}
          fill="none"
          stroke="url(#innerHighlight)"
          strokeWidth={ringThickness * 0.06}
        />

        {/* Specular highlight streak */}
        <Circle
          cx={leftCenterX}
          cy={centerY}
          r={circleRadius}
          fill="none"
          stroke="url(#specularStreak)"
          strokeWidth={ringThickness * 0.7}
        />

        {/* === RIGHT RING (GREEN) === */}

        {/* Drop shadow */}
        <Circle
          cx={rightCenterX + 2}
          cy={centerY + 3}
          r={circleRadius + ringThickness * 0.5}
          fill="none"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth={ringThickness * 0.3}
        />

        {/* Outer dark edge */}
        <Circle
          cx={rightCenterX}
          cy={centerY}
          r={circleRadius + ringThickness * 0.48}
          fill="none"
          stroke="url(#outerEdgeGreen)"
          strokeWidth={ringThickness * 0.08}
        />

        {/* Main chrome body */}
        <Circle
          cx={rightCenterX}
          cy={centerY}
          r={circleRadius}
          fill="none"
          stroke="url(#chromeGreen)"
          strokeWidth={ringThickness}
        />

        {/* Inner bright edge */}
        <Circle
          cx={rightCenterX}
          cy={centerY}
          r={circleRadius - ringThickness * 0.48}
          fill="none"
          stroke="url(#innerHighlight)"
          strokeWidth={ringThickness * 0.06}
        />

        {/* Specular highlight streak */}
        <Circle
          cx={rightCenterX}
          cy={centerY}
          r={circleRadius}
          fill="none"
          stroke="url(#specularStreak)"
          strokeWidth={ringThickness * 0.7}
        />
      </Svg>
    </View>
  );
}

/**
 * Compact version for inline use (e.g., tab bar, small headers)
 */
export function LoopLogoCompact({ size = 20 }: { size?: number }) {
  return <LoopLogoVariant size={size} />;
}

/**
 * Animated version with continuous 3D horizontal rotation
 * Perfect for login screens and splash/loading states
 */
interface LoopLogoAnimatedProps {
  size?: number;
  style?: ViewStyle;
  duration?: number; // Duration of one full rotation in ms
  metallic?: boolean; // Use metallic 3D version
}

export function LoopLogoAnimated({
  size = 24,
  style,
  duration = 3000,
  metallic = false
}: LoopLogoAnimatedProps) {
  const rotation = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    // Start continuous rotation
    rotation.value = withRepeat(
      withTiming(360, {
        duration,
        easing: Easing.linear,
      }),
      -1, // Infinite repeats
      false // Don't reverse
    );

    // Subtle shimmer/pulse for extra depth
    shimmer.value = withRepeat(
      withTiming(1, {
        duration: duration / 2,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true // Reverse for pulse effect
    );
  }, [duration]);

  const animatedStyle = useAnimatedStyle(() => {
    // Calculate a subtle scale pulse synced with rotation
    const scale = 1 + (shimmer.value * 0.03);

    return {
      transform: [
        { perspective: 1200 },
        { rotateY: `${rotation.value}deg` },
        { scale },
      ],
    };
  });

  return (
    <Animated.View style={[animatedStyle, style]}>
      {metallic ? (
        <LoopLogoMetallic size={size} />
      ) : (
        <LoopLogoVariant size={size} />
      )}
    </Animated.View>
  );
}

/**
 * Premium animated metallic logo - clean 3D rotation
 * Ultra-realistic chrome rings like luxury brand logos
 */
interface LoopLogoPremiumProps {
  size?: number;
  style?: ViewStyle;
  duration?: number;
}

export function LoopLogoPremium({ size = 56, style, duration = 4000 }: LoopLogoPremiumProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Smooth continuous rotation
    rotation.value = withRepeat(
      withTiming(360, {
        duration,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [duration]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotation.value}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[animatedStyle, style]}>
      <LoopLogoMetallic size={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Container styles if needed
  },
});
