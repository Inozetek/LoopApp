/**
 * Liquid Glass Tab Bar
 *
 * Premium tab bar with:
 * - Draggable glass lens indicator
 * - Tap OR drag to switch tabs
 * - Smooth spring animations
 * - Glass effect using BlurView (Expo Go compatible)
 * - Navigation happens on drag END (not during drag) for stability
 */

import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { GROK_SPRING } from '@/constants/animations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tab bar dimensions
const TAB_BAR_HORIZONTAL_PADDING = 16;
const TAB_BAR_INNER_HEIGHT = 56;
const LENS_HEIGHT = 48;
const LENS_BORDER_RADIUS = 24;

interface LiquidGlassTabBarProps extends BottomTabBarProps {}

export function LiquidGlassTabBar({
  state,
  descriptors,
  navigation,
}: LiquidGlassTabBarProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // Only show the 5 main tabs
  const MAIN_TABS = ['calendar', 'explore', 'index', 'friends', 'profile'];

  const visibleRoutes = useMemo(() => {
    return state.routes.filter((route) => MAIN_TABS.includes(route.name));
  }, [state.routes]);

  const TAB_COUNT = visibleRoutes.length;
  const TAB_BAR_WIDTH = SCREEN_WIDTH - TAB_BAR_HORIZONTAL_PADDING * 2;
  const TAB_WIDTH = TAB_BAR_WIDTH / TAB_COUNT;
  const LENS_WIDTH = TAB_WIDTH - 8;

  // Find the visible index of the current active tab
  const visibleActiveIndex = useMemo(() => {
    const activeRoute = state.routes[state.index];
    const idx = visibleRoutes.findIndex((r) => r.key === activeRoute.key);
    return idx >= 0 ? idx : 0;
  }, [state.index, state.routes, visibleRoutes]);

  // Animation values
  const lensPosition = useSharedValue(visibleActiveIndex * TAB_WIDTH + 4);
  const isDragging = useSharedValue(false);
  const dragStartX = useSharedValue(0);
  const currentHoverIndex = useSharedValue(visibleActiveIndex);

  // Ref to track if we're mid-drag (for JS side)
  const isDraggingRef = useRef(false);

  // Update lens position when active tab changes (but not during drag)
  useEffect(() => {
    if (!isDraggingRef.current && visibleActiveIndex >= 0) {
      lensPosition.value = withSpring(
        visibleActiveIndex * TAB_WIDTH + 4,
        GROK_SPRING
      );
      currentHoverIndex.value = visibleActiveIndex;
    }
  }, [visibleActiveIndex, TAB_WIDTH]);

  // Calculate which tab the lens is over
  const getTabIndexFromPosition = (x: number): number => {
    'worklet';
    const index = Math.floor((x + LENS_WIDTH / 2) / TAB_WIDTH);
    return Math.max(0, Math.min(TAB_COUNT - 1, index));
  };

  // Navigate to tab (called from JS)
  const navigateToTab = useCallback(
    (visibleIndex: number) => {
      if (visibleIndex < 0 || visibleIndex >= visibleRoutes.length) return;

      const route = visibleRoutes[visibleIndex];
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    },
    [navigation, visibleRoutes]
  );

  // Haptic feedback
  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Called when drag starts
  const onDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  // Called when drag ends - navigate to the final position
  const onDragEnd = useCallback((targetIndex: number) => {
    isDraggingRef.current = false;
    navigateToTab(targetIndex);
  }, [navigateToTab]);

  // Called when hovering over a new tab during drag
  const onHoverNewTab = useCallback(() => {
    triggerHaptic();
  }, [triggerHaptic]);

  // Pan gesture for dragging the lens
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      isDragging.value = true;
      runOnJS(onDragStart)();
      dragStartX.value = lensPosition.value;
      currentHoverIndex.value = getTabIndexFromPosition(lensPosition.value);
    })
    .onUpdate((event) => {
      'worklet';
      const newX = dragStartX.value + event.translationX;
      const clampedX = Math.max(4, Math.min(newX, TAB_BAR_WIDTH - LENS_WIDTH - 4));
      lensPosition.value = clampedX;

      // Check if hovering over a new tab (for haptic feedback only)
      const hoveredIndex = getTabIndexFromPosition(clampedX);
      if (hoveredIndex !== currentHoverIndex.value) {
        currentHoverIndex.value = hoveredIndex;
        runOnJS(onHoverNewTab)();
      }
    })
    .onEnd(() => {
      'worklet';
      isDragging.value = false;
      // Snap to nearest tab
      const targetIndex = getTabIndexFromPosition(lensPosition.value);
      lensPosition.value = withSpring(targetIndex * TAB_WIDTH + 4, GROK_SPRING);
      // Navigate on JS thread
      runOnJS(onDragEnd)(targetIndex);
    })
    .minDistance(5); // Require minimum movement to start drag

  // Tap gesture for direct tab selection
  const handleTabPress = useCallback(
    (visibleIndex: number) => {
      if (isDraggingRef.current) return;
      triggerHaptic();
      lensPosition.value = withSpring(visibleIndex * TAB_WIDTH + 4, GROK_SPRING);
      navigateToTab(visibleIndex);
    },
    [TAB_WIDTH, navigateToTab, triggerHaptic, lensPosition]
  );

  // Animated styles for the lens
  const lensAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lensPosition.value }],
  }));

  // Render the glass lens
  const renderLens = () => (
    <Animated.View style={[styles.lens, { width: LENS_WIDTH }, lensAnimatedStyle]}>
      <BlurView intensity={40} tint="light" style={styles.lensBlur} />
      <View style={styles.lensOverlay} />
    </Animated.View>
  );

  // Render a single tab
  const renderTab = (route: typeof visibleRoutes[0], visibleIndex: number) => {
    const { options } = descriptors[route.key];
    const isActive = visibleIndex === visibleActiveIndex;

    const icon = options.tabBarIcon?.({
      focused: isActive,
      color: isActive ? '#FFFFFF' : colors.icon,
      size: 24,
    });

    const label =
      options.tabBarLabel !== undefined
        ? options.tabBarLabel
        : options.title !== undefined
        ? options.title
        : route.name;

    return (
      <Pressable
        key={route.key}
        onPress={() => handleTabPress(visibleIndex)}
        style={styles.tab}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={typeof label === 'string' ? label : undefined}
      >
        <View style={styles.tabContent}>
          {icon}
          {typeof label === 'string' && (
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? '#FFFFFF' : colors.icon },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: insets.bottom, backgroundColor: 'transparent' },
      ]}
    >
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.tabBar,
            { backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#2C2C2E' },
          ]}
        >
          {renderLens()}
          <View style={styles.tabsContainer}>
            {visibleRoutes.map((route, index) => renderTab(route, index))}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: TAB_BAR_HORIZONTAL_PADDING,
    paddingTop: 8,
  },
  tabBar: {
    height: TAB_BAR_INNER_HEIGHT,
    borderRadius: TAB_BAR_INNER_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: 'Urbanist-Medium',
    marginTop: 2,
  },
  lens: {
    position: 'absolute',
    top: (TAB_BAR_INNER_HEIGHT - LENS_HEIGHT) / 2,
    height: LENS_HEIGHT,
    borderRadius: LENS_BORDER_RADIUS,
    overflow: 'hidden',
    zIndex: 0,
  },
  lensBlur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: LENS_BORDER_RADIUS,
  },
  lensOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: LENS_BORDER_RADIUS,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
