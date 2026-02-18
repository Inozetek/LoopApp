/**
 * Onboarding Loop Animation
 *
 * SVG-based background animation that grows as user progresses through onboarding.
 * Each step (0-4) adds a node to a visual route. On the final step,
 * the route closes into a loop shape and pulses.
 *
 * Visual Progression:
 * Step 0: "You" center dot — single cyan pulse
 * Step 1: "Identity" node — path draws to upper-right
 * Step 2: "Interests" cluster — dots branch around node 2
 * Step 3: "Home" node — path draws to bottom-left
 * Step 4: Loop closes — path connects back, glow pulse, morph ready
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Line,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  withSpring,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { GROK_SPRING } from '@/constants/animations';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

interface OnboardingLoopAnimationProps {
  currentStep: number;
  size?: number;
  onComplete?: () => void;
}

// Node positions in a pentagonal loop layout (normalized 0-1)
const NODES = [
  { x: 0.50, y: 0.50 }, // Step 0: Center "You"
  { x: 0.75, y: 0.28 }, // Step 1: Upper-right "Identity"
  { x: 0.82, y: 0.62 }, // Step 2: Right "Interests"
  { x: 0.50, y: 0.80 }, // Step 3: Bottom "Home"
  { x: 0.22, y: 0.55 }, // Step 4: Left "Ready" (closes the loop)
];

// Connections between nodes (path segments)
const EDGES = [
  [0, 1], // Step 1: Center → Upper-right
  [1, 2], // Step 2: Upper-right → Right
  [2, 3], // Step 3: Right → Bottom
  [3, 4], // Step 4: Bottom → Left
  [4, 0], // Step 4: Left → Center (closes loop)
];

const NODE_COLORS = [
  '#00BCD4', // Cyan
  '#4FC3F7', // Light Blue
  '#09DB98', // Green
  '#FF9800', // Orange
  '#E040FB', // Purple
];

export function OnboardingLoopAnimation({
  currentStep,
  size = 280,
  onComplete,
}: OnboardingLoopAnimationProps) {
  // Animation values for each node (0 = hidden, 1 = visible)
  const node0 = useSharedValue(0);
  const node1 = useSharedValue(0);
  const node2 = useSharedValue(0);
  const node3 = useSharedValue(0);
  const node4 = useSharedValue(0);
  const nodeValues = [node0, node1, node2, node3, node4];

  // Animation values for edges (0 = hidden, 1 = visible)
  const edge0 = useSharedValue(0);
  const edge1 = useSharedValue(0);
  const edge2 = useSharedValue(0);
  const edge3 = useSharedValue(0);
  const edge4 = useSharedValue(0);
  const edgeValues = [edge0, edge1, edge2, edge3, edge4];

  // Center pulse (continuous after step 0)
  const centerPulse = useSharedValue(1);

  // Final glow (step 4 closing animation)
  const closingGlow = useSharedValue(0);

  useEffect(() => {
    // Step 0: Show center node with pulse
    if (currentStep >= 0) {
      node0.value = withSpring(1, GROK_SPRING);
      centerPulse.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }

    // Step 1: Show node 1 + edge from center
    if (currentStep >= 1) {
      edge0.value = withDelay(100, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
      node1.value = withDelay(400, withSpring(1, GROK_SPRING));
    } else {
      edge0.value = withTiming(0, { duration: 300 });
      node1.value = withTiming(0, { duration: 300 });
    }

    // Step 2: Show node 2 + edge
    if (currentStep >= 2) {
      edge1.value = withDelay(100, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
      node2.value = withDelay(400, withSpring(1, GROK_SPRING));
    } else {
      edge1.value = withTiming(0, { duration: 300 });
      node2.value = withTiming(0, { duration: 300 });
    }

    // Step 3: Show node 3 + edge
    if (currentStep >= 3) {
      edge2.value = withDelay(100, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
      node3.value = withDelay(400, withSpring(1, GROK_SPRING));
    } else {
      edge2.value = withTiming(0, { duration: 300 });
      node3.value = withTiming(0, { duration: 300 });
    }

    // Step 4: Show node 4 + last two edges + closing glow
    if (currentStep >= 4) {
      edge3.value = withDelay(100, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
      node4.value = withDelay(400, withSpring(1, GROK_SPRING));
      // Close the loop
      edge4.value = withDelay(700, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
      // Glow pulse
      closingGlow.value = withDelay(1200, withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      ));
      // Fire onComplete after closing animation finishes
      if (onComplete) {
        const timer = setTimeout(() => onComplete(), 1300);
        return () => clearTimeout(timer);
      }
    } else {
      edge3.value = withTiming(0, { duration: 300 });
      edge4.value = withTiming(0, { duration: 300 });
      node4.value = withTiming(0, { duration: 300 });
      closingGlow.value = withTiming(0, { duration: 300 });
    }
  }, [currentStep]);

  // Node radius
  const baseRadius = size * 0.028;
  const centerRadius = size * 0.04;

  // Create animated props for each node
  const createNodeProps = (nodeValue: Animated.SharedValue<number>, index: number) => {
    return useAnimatedProps(() => {
      const scale = index === 0 ? centerPulse.value : 1;
      return {
        r: (index === 0 ? centerRadius : baseRadius) * nodeValue.value * scale,
        opacity: nodeValue.value * 0.9,
      };
    });
  };

  // Create animated props for each edge
  const createEdgeProps = (edgeValue: Animated.SharedValue<number>, edgeIndex: number) => {
    const [fromIdx, toIdx] = EDGES[edgeIndex];
    const from = NODES[fromIdx];
    const to = NODES[toIdx];

    return useAnimatedProps(() => {
      const progress = edgeValue.value;
      return {
        x1: from.x * size,
        y1: from.y * size,
        x2: interpolate(progress, [0, 1], [from.x * size, to.x * size]),
        y2: interpolate(progress, [0, 1], [from.y * size, to.y * size]),
        opacity: progress * 0.7,
        strokeWidth: 2.5,
      };
    });
  };

  // Closing glow animated props
  const closingGlowProps = useAnimatedProps(() => ({
    r: size * 0.25 * closingGlow.value,
    opacity: closingGlow.value * 0.3,
  }));

  // Create animated props arrays (must call hooks at top level)
  const nodeProps0 = createNodeProps(node0, 0);
  const nodeProps1 = createNodeProps(node1, 1);
  const nodeProps2 = createNodeProps(node2, 2);
  const nodeProps3 = createNodeProps(node3, 3);
  const nodeProps4 = createNodeProps(node4, 4);
  const allNodeProps = [nodeProps0, nodeProps1, nodeProps2, nodeProps3, nodeProps4];

  const edgeProps0 = createEdgeProps(edge0, 0);
  const edgeProps1 = createEdgeProps(edge1, 1);
  const edgeProps2 = createEdgeProps(edge2, 2);
  const edgeProps3 = createEdgeProps(edge3, 3);
  const edgeProps4 = createEdgeProps(edge4, 4);
  const allEdgeProps = [edgeProps0, edgeProps1, edgeProps2, edgeProps3, edgeProps4];

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={styles.svg}
    >
      <Defs>
        <LinearGradient id="cyanGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#00BCD4" stopOpacity="0.8" />
          <Stop offset="1" stopColor="#4FC3F7" stopOpacity="0.6" />
        </LinearGradient>
        <LinearGradient id="greenGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#09DB98" stopOpacity="0.8" />
          <Stop offset="1" stopColor="#00BCD4" stopOpacity="0.6" />
        </LinearGradient>
      </Defs>

      <G>
        {/* Closing glow (step 4 only) */}
        <AnimatedCircle
          cx={NODES[0].x * size}
          cy={NODES[0].y * size}
          fill="#00BCD4"
          animatedProps={closingGlowProps}
        />

        {/* Edges (path segments) */}
        {EDGES.map((_, index) => (
          <AnimatedLine
            key={`edge-${index}`}
            stroke={index < 3 ? 'url(#cyanGrad)' : 'url(#greenGrad)'}
            strokeLinecap="round"
            animatedProps={allEdgeProps[index]}
          />
        ))}

        {/* Nodes */}
        {NODES.map((node, index) => (
          <AnimatedCircle
            key={`node-${index}`}
            cx={node.x * size}
            cy={node.y * size}
            fill={NODE_COLORS[index]}
            animatedProps={allNodeProps[index]}
          />
        ))}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: {
    position: 'absolute',
    alignSelf: 'center',
    opacity: 0.45,
  },
});
