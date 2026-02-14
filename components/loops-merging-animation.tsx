/**
 * Loops Merging Animation
 *
 * Visualizes two people's "loops of activity" combining to find
 * the most convenient shared stop. Each loop is a circular circuit
 * with activity nodes (stops) along it.
 *
 * Animation sequence:
 * 1. Two loops appear separated (left cyan, right green)
 * 2. Nodes pulse to show they're alive
 * 3. Loops slide toward each other
 * 4. They overlap (Venn diagram, like the Loop logo)
 * 5. Intersection glows — the ideal shared stop
 *
 * Used in: Group planning flow, onboarding explainer
 */

import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, RadialGradient, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { BrandColors } from '@/constants/brand';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

// Activity node positions (angles in degrees around each loop)
const NODE_ANGLES = [0, 72, 144, 216, 288]; // 5 stops evenly spaced
const NODE_SIZES = [4, 3.5, 4.5, 3, 4]; // Slightly varied sizes for organic feel

interface LoopsMergingAnimationProps {
  /** Overall size (width). Height is 60% of width. */
  size?: number;
  style?: ViewStyle;
  /** Start animation immediately */
  autoPlay?: boolean;
  /** Called when the merge animation completes one cycle */
  onMergeComplete?: () => void;
  /** Loop the animation continuously */
  loop?: boolean;
  /** Duration of the full merge sequence in ms */
  duration?: number;
}

export function LoopsMergingAnimation({
  size = 220,
  style,
  autoPlay = true,
  onMergeComplete,
  loop = true,
  duration = 3000,
}: LoopsMergingAnimationProps) {
  const height = size * 0.55;
  const loopRadius = size * 0.16;
  const nodeBaseSize = size * 0.018;
  const strokeWidth = size * 0.012;
  const centerY = height / 2;

  // Start positions: loops separated
  const leftStartX = size * 0.28;
  const rightStartX = size * 0.72;

  // End positions: loops overlapping (like logo)
  const leftEndX = size * 0.38;
  const rightEndX = size * 0.62;

  // Shared animation values
  const mergeProgress = useSharedValue(0); // 0 = apart, 1 = merged
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.5);
  const nodesPulse = useSharedValue(0);
  const connectorOpacity = useSharedValue(0);

  const handleComplete = useCallback(() => {
    if (onMergeComplete) {
      onMergeComplete();
    }
  }, [onMergeComplete]);

  const startAnimation = useCallback(() => {
    'worklet';

    // Phase 1: Nodes pulse alive (0-500ms)
    nodesPulse.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    // Phase 2: Loops slide together (500ms-2000ms)
    mergeProgress.value = withDelay(
      400,
      withTiming(1, {
        duration: duration * 0.5,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      })
    );

    // Phase 3: Connector lines appear (1500ms)
    connectorOpacity.value = withDelay(
      duration * 0.55,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) })
    );

    // Phase 4: Glow at intersection (2000ms-2500ms)
    glowOpacity.value = withDelay(
      duration * 0.6,
      withSequence(
        withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }),
        withRepeat(
          withSequence(
            withTiming(0.6, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        )
      )
    );

    glowScale.value = withDelay(
      duration * 0.6,
      withSequence(
        withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) }),
        withRepeat(
          withSequence(
            withTiming(0.9, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        )
      )
    );
  }, [duration]);

  useEffect(() => {
    if (autoPlay) {
      startAnimation();
    }
  }, [autoPlay, startAnimation]);

  // Left loop translation
  const leftLoopStyle = useAnimatedStyle(() => {
    const translateX = interpolate(mergeProgress.value, [0, 1], [0, leftEndX - leftStartX]);
    return {
      transform: [{ translateX }],
    };
  });

  // Right loop translation
  const rightLoopStyle = useAnimatedStyle(() => {
    const translateX = interpolate(mergeProgress.value, [0, 1], [0, rightEndX - rightStartX]);
    return {
      transform: [{ translateX }],
    };
  });

  // Glow overlay style
  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: glowOpacity.value,
      transform: [{ scale: glowScale.value }],
    };
  });

  // Connector line style
  const connectorStyle = useAnimatedStyle(() => {
    return {
      opacity: connectorOpacity.value,
    };
  });

  // Helper: get node position on circle
  const getNodePos = (centerX: number, angleDeg: number) => {
    const rad = (angleDeg - 90) * (Math.PI / 180); // -90 so 0° is top
    return {
      x: centerX + loopRadius * Math.cos(rad),
      y: centerY + loopRadius * Math.sin(rad),
    };
  };

  // Render activity nodes around a loop
  const renderNodes = (centerX: number, color: string, isLeft: boolean) => {
    return NODE_ANGLES.map((angle, i) => {
      const pos = getNodePos(centerX, angle);
      const nodeSize = NODE_SIZES[i] * nodeBaseSize * 0.5;
      return (
        <Circle
          key={`${isLeft ? 'l' : 'r'}-node-${i}`}
          cx={pos.x}
          cy={pos.y}
          r={nodeSize}
          fill={color}
          opacity={0.95}
        />
      );
    });
  };

  // Render dashed connector lines between nodes (loop of activity)
  const renderConnectors = (centerX: number, color: string, isLeft: boolean) => {
    return NODE_ANGLES.map((angle, i) => {
      const from = getNodePos(centerX, angle);
      const toAngle = NODE_ANGLES[(i + 1) % NODE_ANGLES.length];
      const to = getNodePos(centerX, toAngle);
      return (
        <Line
          key={`${isLeft ? 'l' : 'r'}-conn-${i}`}
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={color}
          strokeWidth={strokeWidth * 0.4}
          strokeDasharray={`${size * 0.01},${size * 0.008}`}
          opacity={0.3}
        />
      );
    });
  };

  const svgViewBox = `0 0 ${size} ${height}`;

  return (
    <View style={[{ width: size, height }, style]}>
      {/* Left Loop (Cyan) */}
      <Animated.View style={[StyleSheet.absoluteFill, leftLoopStyle]}>
        <Svg width={size} height={height} viewBox={svgViewBox}>
          <Defs>
            <LinearGradient id="cyanStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#7DD8FF" />
              <Stop offset="50%" stopColor={BrandColors.loopBlue} />
              <Stop offset="100%" stopColor="#0090C0" />
            </LinearGradient>
          </Defs>

          {/* Connectors between nodes */}
          {renderConnectors(leftStartX, BrandColors.loopBlue, true)}

          {/* Main loop circle */}
          <Circle
            cx={leftStartX}
            cy={centerY}
            r={loopRadius}
            fill="rgba(0, 166, 217, 0.06)"
            stroke="url(#cyanStroke)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${size * 0.04},${size * 0.02}`}
          />

          {/* Activity nodes */}
          {renderNodes(leftStartX, BrandColors.loopBlue, true)}
        </Svg>
      </Animated.View>

      {/* Right Loop (Green) */}
      <Animated.View style={[StyleSheet.absoluteFill, rightLoopStyle]}>
        <Svg width={size} height={height} viewBox={svgViewBox}>
          <Defs>
            <LinearGradient id="greenStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#6FFFB8" />
              <Stop offset="50%" stopColor={BrandColors.loopGreen} />
              <Stop offset="100%" stopColor="#00C080" />
            </LinearGradient>
          </Defs>

          {/* Connectors between nodes */}
          {renderConnectors(rightStartX, BrandColors.loopGreen, false)}

          {/* Main loop circle */}
          <Circle
            cx={rightStartX}
            cy={centerY}
            r={loopRadius}
            fill="rgba(9, 219, 152, 0.06)"
            stroke="url(#greenStroke)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${size * 0.04},${size * 0.02}`}
          />

          {/* Activity nodes */}
          {renderNodes(rightStartX, BrandColors.loopGreen, false)}
        </Svg>
      </Animated.View>

      {/* Intersection Glow (appears after merge) */}
      <Animated.View
        style={[StyleSheet.absoluteFill, glowStyle]}
        pointerEvents="none"
      >
        <Svg width={size} height={height} viewBox={svgViewBox}>
          <Defs>
            <RadialGradient id="mergeGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <Stop offset="25%" stopColor="#5EEECA" stopOpacity="0.7" />
              <Stop offset="50%" stopColor={BrandColors.loopGreen} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={BrandColors.loopBlue} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Glow circle at intersection */}
          <Circle
            cx={size / 2}
            cy={centerY}
            r={loopRadius * 0.35}
            fill="url(#mergeGlow)"
          />

          {/* Bright center dot — the ideal shared stop */}
          <Circle
            cx={size / 2}
            cy={centerY}
            r={nodeBaseSize * 2.5}
            fill="#FFFFFF"
            opacity={0.95}
          />
          <Circle
            cx={size / 2}
            cy={centerY}
            r={nodeBaseSize * 1.8}
            fill={BrandColors.loopGreen}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * Compact version for inline use (e.g., group planning button)
 */
export function LoopsMergingCompact({ size = 100 }: { size?: number }) {
  return <LoopsMergingAnimation size={size} duration={2500} />;
}

const styles = StyleSheet.create({
  // Reserved for future use
});
