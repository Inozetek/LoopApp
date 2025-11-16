/**
 * Fade In View
 *
 * Smooth fade-in animation for any content.
 * Adds polish to loading states and screen transitions.
 */

import { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface FadeInViewProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: ViewStyle;
}

export function FadeInView({
  children,
  delay = 0,
  duration = 600,
  style,
}: FadeInViewProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * Fade In Up View
 *
 * Fade in with upward movement (like toast notifications)
 */
interface FadeInUpViewProps extends FadeInViewProps {
  distance?: number;
}

export function FadeInUpView({
  children,
  delay = 0,
  duration = 600,
  distance = 20,
  style,
}: FadeInUpViewProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(distance);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      })
    );

    translateY.value = withDelay(
      delay,
      withTiming(0, {
        duration,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * Scale In View
 *
 * Fade in with scale animation (good for cards)
 */
interface ScaleInViewProps extends FadeInViewProps {
  startScale?: number;
}

export function ScaleInView({
  children,
  delay = 0,
  duration = 400,
  startScale = 0.9,
  style,
}: ScaleInViewProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(startScale);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      })
    );

    scale.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.back(1.5)),
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * Staggered List Item
 *
 * Use for staggered animations in FlatList
 */
interface StaggeredItemProps {
  children: React.ReactNode;
  index: number;
  staggerDelay?: number;
  style?: ViewStyle;
}

export function StaggeredListItem({
  children,
  index,
  staggerDelay = 50,
  style,
}: StaggeredItemProps) {
  return (
    <FadeInUpView delay={index * staggerDelay} duration={400} distance={10} style={style}>
      {children}
    </FadeInUpView>
  );
}
