/**
 * Light Mode Tab Bar
 *
 * Clean, modern pill-shaped tab bar with:
 * - Floating pill shape with rounded corners
 * - White/light background (dark in dark mode)
 * - Draggable lens indicator (tap OR drag to switch tabs)
 * - Simple clean bubble behind selected tab (no rainbow effects)
 * - Smooth spring animations
 * - Breathing effect: tab bar grows during movement, snaps back when lens locks
 */

import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
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
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tab bar dimensions - compact pill shaped (eBay-inspired)
// eBay's design: compact bar, subtle border, light shadow, tight spacing
const TAB_BAR_HORIZONTAL_PADDING = 28; // More padding = narrower bar (matches eBay)
const TAB_BAR_INNER_HEIGHT = 62; // Slightly shorter bar
const LENS_HEIGHT = 58; // Almost flush with navbar top/bottom
const LENS_BORDER_RADIUS = 33; // Very rounded sides
const TAB_BAR_BOTTOM_OFFSET = -10; // Further below bottom edge
const TABS_HORIZONTAL_PADDING = 16; // Padding for icons at ends

// Spring config for smooth animations (no bounce)
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.8,
};

// Snap config for scale - no bounce, just smooth
const SCALE_CONFIG = {
  damping: 25,
  stiffness: 400,
  mass: 0.5,
};

export function EbayStyleTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  // Only show the 5 main tabs
  const MAIN_TABS = ['calendar', 'explore', 'index', 'friends', 'profile'];

  const visibleRoutes = useMemo(() => {
    return state.routes.filter((route) => MAIN_TABS.includes(route.name));
  }, [state.routes]);

  const TAB_COUNT = visibleRoutes.length;
  const TAB_BAR_WIDTH = SCREEN_WIDTH - TAB_BAR_HORIZONTAL_PADDING * 2;
  // Account for internal padding when calculating tab widths
  const USABLE_WIDTH = TAB_BAR_WIDTH - TABS_HORIZONTAL_PADDING * 2;
  const TAB_WIDTH = USABLE_WIDTH / TAB_COUNT;
  const LENS_WIDTH = TAB_WIDTH + 20; // Much wider lens - nearly touches adjacent icons

  // Track the last visible tab index so hidden tabs (settings, locations, etc.)
  // don't cause the lens to jump away from the parent tab
  const lastVisibleIndexRef = useRef(0);

  // Find the visible index of the current active tab
  const visibleActiveIndex = useMemo(() => {
    const activeRoute = state.routes[state.index];
    const idx = visibleRoutes.findIndex((r) => r.key === activeRoute.key);
    if (idx >= 0) {
      lastVisibleIndexRef.current = idx;
      return idx;
    }
    // Active route is a hidden tab — keep lens on the last visible tab
    return lastVisibleIndexRef.current;
  }, [state.index, state.routes, visibleRoutes]);

  // Animation values - offset to center wider lens over tab
  const LENS_OFFSET = (TAB_WIDTH - LENS_WIDTH) / 2; // Centers the wider lens
  const lensPosition = useSharedValue(TABS_HORIZONTAL_PADDING + visibleActiveIndex * TAB_WIDTH + LENS_OFFSET);
  const isDragging = useSharedValue(false);
  const dragStartX = useSharedValue(0);
  const currentHoverIndex = useSharedValue(visibleActiveIndex);
  const lensScaleX = useSharedValue(1); // Lens horizontal scale
  const lensScaleY = useSharedValue(1); // Lens vertical scale (extends past navbar)
  const tabBarScaleX = useSharedValue(1); // Tab bar horizontal scale (minimal)
  const tabBarScaleY = useSharedValue(1); // Tab bar vertical scale (breathing)
  const navbarBrightness = useSharedValue(0); // 0 = normal, 1 = bright white

  // Ref to track if we're mid-drag (for JS side)
  const isDraggingRef = useRef(false);

  // Update lens position when active tab changes (but not during drag)
  useEffect(() => {
    if (!isDraggingRef.current && visibleActiveIndex >= 0) {
      lensPosition.value = withSpring(
        TABS_HORIZONTAL_PADDING + visibleActiveIndex * TAB_WIDTH + LENS_OFFSET,
        SPRING_CONFIG
      );
      currentHoverIndex.value = visibleActiveIndex;
    }
  }, [visibleActiveIndex, TAB_WIDTH, LENS_OFFSET]);

  // Calculate which tab the lens is over
  const getTabIndexFromPosition = (x: number): number => {
    'worklet';
    // Subtract the padding offset to get relative position
    const relativeX = x - TABS_HORIZONTAL_PADDING;
    const index = Math.floor((relativeX + LENS_WIDTH / 2) / TAB_WIDTH);
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
      // Lens grows vertically to extend past navbar, minimal horizontal
      lensScaleX.value = withSpring(1.06, SCALE_CONFIG);
      lensScaleY.value = withSpring(1.35, SCALE_CONFIG); // Extends well past top/bottom
      // Tab bar breathes more vertically than horizontally
      tabBarScaleX.value = withSpring(1.02, SCALE_CONFIG); // Minimal horizontal
      tabBarScaleY.value = withSpring(1.15, SCALE_CONFIG); // More vertical growth
      // Navbar gets brighter
      navbarBrightness.value = withSpring(1, SCALE_CONFIG);
      runOnJS(onDragStart)();
      dragStartX.value = lensPosition.value;
      currentHoverIndex.value = getTabIndexFromPosition(lensPosition.value);
    })
    .onUpdate((event) => {
      'worklet';
      const newX = dragStartX.value + event.translationX;
      // Allow lens to extend slightly past edges for wider lens
      const minX = TABS_HORIZONTAL_PADDING + LENS_OFFSET;
      const maxX = TABS_HORIZONTAL_PADDING + (TAB_COUNT - 1) * TAB_WIDTH + LENS_OFFSET;
      const clampedX = Math.max(minX, Math.min(newX, maxX));
      lensPosition.value = clampedX;

      // Keep lens and navbar in "active" state while dragging
      if (isDragging.value) {
        lensScaleX.value = 1.06;
        lensScaleY.value = 1.35;
        tabBarScaleX.value = 1.02;
        tabBarScaleY.value = 1.15;
        navbarBrightness.value = 1;
      }

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
      // Return everything to normal (no bounce)
      lensScaleX.value = withSpring(1, SCALE_CONFIG);
      lensScaleY.value = withSpring(1, SCALE_CONFIG);
      tabBarScaleX.value = withSpring(1, SCALE_CONFIG);
      tabBarScaleY.value = withSpring(1, SCALE_CONFIG);
      navbarBrightness.value = withSpring(0, SCALE_CONFIG);
      // Snap to nearest tab
      const targetIndex = getTabIndexFromPosition(lensPosition.value);
      lensPosition.value = withSpring(TABS_HORIZONTAL_PADDING + targetIndex * TAB_WIDTH + LENS_OFFSET, SPRING_CONFIG);
      // Navigate on JS thread
      runOnJS(onDragEnd)(targetIndex);
    })
    .minDistance(5); // Require minimum movement to start drag

  // Tap gesture for direct tab selection - triggers on touch (not lift)
  const handleTabPressIn = useCallback(
    (visibleIndex: number) => {
      if (isDraggingRef.current) return;
      triggerHaptic();

      // Lens jumps to finger immediately on touch
      lensPosition.value = withSpring(TABS_HORIZONTAL_PADDING + visibleIndex * TAB_WIDTH + LENS_OFFSET, SPRING_CONFIG);

      // Lens scale - more vertical to extend past navbar (no bounce)
      lensScaleX.value = withSpring(1.05, SCALE_CONFIG);
      lensScaleY.value = withSpring(1.3, SCALE_CONFIG);
      // Tab bar - more vertical than horizontal
      tabBarScaleX.value = withSpring(1.02, SCALE_CONFIG);
      tabBarScaleY.value = withSpring(1.12, SCALE_CONFIG);
      // Navbar gets brighter
      navbarBrightness.value = withSpring(1, SCALE_CONFIG);

      navigateToTab(visibleIndex);

      // Return to normal after brief delay - lens locks in place (no bounce)
      setTimeout(() => {
        lensScaleX.value = withSpring(1, SCALE_CONFIG);
        lensScaleY.value = withSpring(1, SCALE_CONFIG);
        tabBarScaleX.value = withSpring(1, SCALE_CONFIG);
        tabBarScaleY.value = withSpring(1, SCALE_CONFIG);
        navbarBrightness.value = withSpring(0, SCALE_CONFIG);
      }, 150);
    },
    [TAB_WIDTH, LENS_OFFSET, navigateToTab, triggerHaptic, lensPosition, lensScaleX, lensScaleY, tabBarScaleX, tabBarScaleY, navbarBrightness]
  );

  // Animated style for the lens (position + separate X/Y scale)
  const lensAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: lensPosition.value },
      { scaleX: lensScaleX.value },
      { scaleY: lensScaleY.value }, // Extends past navbar top/bottom
    ],
  }));

  // Colors for animation (eBay-matched dark mode - darker navbar)
  const tabBarBgNormal = colorScheme === 'dark' ? '#161618' : '#F7F7F7';
  const tabBarBgBright = colorScheme === 'dark' ? '#232326' : '#FFFFFF';

  // Animated style for tab bar BACKGROUND only (separate X/Y breathing + brightness)
  const tabBarBackgroundStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: tabBarScaleX.value }, // Minimal horizontal growth
      { scaleY: tabBarScaleY.value }, // More vertical growth
    ],
    backgroundColor: interpolateColor(
      navbarBrightness.value,
      [0, 1],
      [tabBarBgNormal, tabBarBgBright]
    ),
  }));

  // Border gradient opacity - fades during growth to avoid pixelation
  const borderGradientStyle = useAnimatedStyle(() => ({
    opacity: 1 - navbarBrightness.value, // Fade out during growth
    transform: [
      { scaleX: tabBarScaleX.value },
      { scaleY: tabBarScaleY.value },
    ],
  }));

  // Colors based on theme - eBay uses slightly off-white background
  const tabBarBg = tabBarBgNormal; // Used for initial render
  const lensBg = colorScheme === 'dark' ? '#2D2D30' : '#E5E5EA'; // Subtle bubble like eBay
  const iconColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';
  // White inactive icons in dark mode like eBay
  const inactiveIconColor = colorScheme === 'dark' ? '#FFFFFF' : '#1C1C1E';
  // Labels - white in dark mode like eBay
  const labelColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';
  const inactiveLabelColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';

  // Render a single tab
  const renderTab = (route: typeof visibleRoutes[0], visibleIndex: number) => {
    const { options } = descriptors[route.key];
    const isActive = visibleIndex === visibleActiveIndex;

    const icon = options.tabBarIcon?.({
      focused: isActive,
      color: isActive ? iconColor : inactiveIconColor,
      size: 30, // Icon size now passed to tab layout
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
        onPressIn={() => handleTabPressIn(visibleIndex)}
        style={styles.tab}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={typeof label === 'string' ? label : undefined}
      >
        <View style={styles.tabContent}>
          <View style={styles.iconContainer}>
            {icon}
          </View>
          {typeof label === 'string' && (
            <Text
              style={[
                styles.tabLabel,
                {
                  color: isActive ? labelColor : inactiveLabelColor,
                  fontWeight: isActive ? '600' : '500',
                },
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
      {/* Outer wrapper for gesture detection */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.tabBarWrapper}>
          {/* Gradient border layer - eBay style: tiny transparent corners, silver everywhere else */}
          {colorScheme === 'dark' && (
            <Animated.View style={[styles.tabBarBorderGradient, borderGradientStyle]}>
              <LinearGradient
                colors={['transparent', '#58595B', '#58595B', '#58595B', 'transparent']}
                locations={[0, 0.03, 0.5, 0.97, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientBorder}
              />
            </Animated.View>
          )}

          {/* Animated background (scales/breathes) - BEHIND everything */}
          <Animated.View
            style={[
              styles.tabBarBackground,
              {
                backgroundColor: tabBarBg,
                borderWidth: colorScheme === 'light' ? 1 : 0,
                borderColor: '#FFFFFF',
              },
              tabBarBackgroundStyle,
            ]}
          />

          {/* Lens indicator (animated position + scale) - BEHIND icons */}
          <Animated.View
            style={[
              styles.lens,
              { width: LENS_WIDTH, backgroundColor: lensBg },
              lensAnimatedStyle,
            ]}
          />

          {/* Icons/Labels - STATIC, never scaled, always crisp - ON TOP */}
          <View style={styles.tabsContainer}>
            {visibleRoutes.map((route, index) => renderTab(route, index))}
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: TAB_BAR_BOTTOM_OFFSET, // Sit lower on screen (eBay-style)
    left: 0,
    right: 0,
    paddingHorizontal: TAB_BAR_HORIZONTAL_PADDING,
    paddingTop: 0, // No extra padding
    overflow: 'visible', // Allow breathing animation to extend beyond bounds
  },
  tabBarWrapper: {
    height: TAB_BAR_INNER_HEIGHT,
    position: 'relative',
    justifyContent: 'center',
    overflow: 'visible', // Allow background to expand beyond bounds when breathing
  },
  tabBarBorderGradient: {
    position: 'absolute',
    top: -0.5,
    left: -0.5,
    right: -0.5,
    bottom: -0.5,
    borderRadius: 31.5, // Slightly larger to show as border
    zIndex: 0, // Behind everything
    overflow: 'hidden',
  },
  gradientBorder: {
    flex: 1,
    borderRadius: 32,
  },
  tabBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 31, // Pill shape (TAB_BAR_INNER_HEIGHT / 2)
    // borderWidth set dynamically (1 for light mode, 0 for dark mode with gradient)
    zIndex: 1, // Behind lens and icons
    // Very subtle shadow like eBay
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    zIndex: 3, // Above lens so icons stay on top
    overflow: 'visible',
    paddingHorizontal: 16, // Padding at ends for more border visibility
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    // Compact spacing - icons closer together due to narrower bar
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center', // Center vertically
    height: '100%',
  },
  iconContainer: {
    height: 30, // Fixed height for icons so labels align
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  tabLabel: {
    fontSize: 9, // Smaller label size like eBay
    marginTop: 0,
  },
  lens: {
    position: 'absolute',
    top: 2, // (62 - 58) / 2 = 2, almost flush
    left: 0,
    height: LENS_HEIGHT,
    borderRadius: LENS_BORDER_RADIUS,
    zIndex: 2, // Between background and icons
    overflow: 'visible',
  },
});
