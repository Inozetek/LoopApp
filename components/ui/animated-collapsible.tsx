/**
 * Animated Collapsible Component
 *
 * Spring-based collapsible section with chevron rotation.
 * Used for menu sections and expandable content areas.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useDerivedValue,
  interpolate,
} from 'react-native-reanimated';
import { COLLAPSIBLE_SPRING } from '@/constants/animations';
import { Typography, Spacing, BorderRadius } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface AnimatedCollapsibleProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function AnimatedCollapsible({
  title,
  children,
  defaultExpanded = false,
  icon,
}: AnimatedCollapsibleProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [contentHeight, setContentHeight] = useState(0);

  // Animation values
  const progress = useSharedValue(defaultExpanded ? 1 : 0);

  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    progress.value = withSpring(newExpanded ? 1 : 0, COLLAPSIBLE_SPRING);
  };

  // Chevron rotation animation
  const chevronRotation = useDerivedValue(() => {
    return interpolate(progress.value, [0, 1], [0, 180]);
  });

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  // Content height animation
  const contentStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, contentHeight]),
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0, 1]),
    overflow: 'hidden',
  }));

  return (
    <View style={styles.container}>
      {/* Header - Tap to toggle */}
      <TouchableOpacity
        onPress={toggleExpanded}
        style={[styles.header, { borderBottomColor: colors.icon + '20' }]}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          {icon && (
            <Ionicons
              name={icon}
              size={20}
              color={colors.textSecondary}
              style={styles.headerIcon}
            />
          )}
          <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
            {title}
          </Text>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </Animated.View>
      </TouchableOpacity>

      {/* Animated Content */}
      <Animated.View style={contentStyle}>
        <View
          style={styles.content}
          onLayout={(e) => {
            const { height } = e.nativeEvent.layout;
            if (height > 0 && height !== contentHeight) {
              setContentHeight(height);
            }
          }}
        >
          {children}
        </View>
      </Animated.View>

      {/* Hidden content for measuring */}
      {contentHeight === 0 && (
        <View
          style={styles.measureContainer}
          onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
        >
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: Spacing.sm,
  },
  headerTitle: {
    ...Typography.labelLarge,
    fontFamily: 'Urbanist-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  measureContainer: {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
  },
});
