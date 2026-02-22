/**
 * Profile Header Component
 *
 * Instagram-style profile header with username.
 * Features:
 * - Hamburger menu button on left (opens MainMenuModal)
 * - Username/name as title
 * - Settings gear on right
 * - Optional back button on left (replaces hamburger when provided)
 * - Clean, minimal design
 */

import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SharedValue } from 'react-native-reanimated';
import { Spacing, Typography } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BlurHeaderWrapper } from '@/components/blur-header-wrapper';
import { MetallicRingButton } from '@/components/ui/metallic-ring-button';

interface ProfileHeaderProps {
  username: string;
  onBackPress?: () => void;
  /** Settings gear press handler (right side) */
  onSettingsPress?: () => void;
  /** Hamburger menu press handler (left side) */
  onHamburgerPress?: () => void;
  onUsernamePress?: () => void;
  /** Legacy: onMenuPress still works as alias for onSettingsPress */
  onMenuPress?: () => void;
  /** Swipe-to-open gesture callbacks on hamburger button */
  onMenuDrag?: (translationX: number) => void;
  onMenuDragEnd?: (translationX: number, velocityX: number) => void;
  /** Menu animation progress (0-1) — keeps hamburger button enlarged while menu is open */
  menuProgress?: SharedValue<number>;
}

export function ProfileHeader({
  username,
  onBackPress,
  onSettingsPress,
  onHamburgerPress,
  onUsernamePress,
  onMenuPress,
  onMenuDrag,
  onMenuDragEnd,
  menuProgress,
}: ProfileHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // Resolve settings press: prefer onSettingsPress, fall back to legacy onMenuPress
  const resolvedSettingsPress = onSettingsPress || onMenuPress;

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBackPress?.();
  };

  const handleSettingsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resolvedSettingsPress?.();
  };

  const handleHamburgerPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onHamburgerPress?.();
  };

  const handleUsernamePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUsernamePress?.();
  };

  // --- Drag-to-open gesture on hamburger button (matches LoopHeader pattern) ---
  const dragStartX = useRef(0);
  const isDragging = useRef(false);

  const menuPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture horizontal drags to the right
        return gestureState.dx > 8 && Math.abs(gestureState.dy) < 15;
      },
      onPanResponderGrant: (_, gestureState) => {
        isDragging.current = true;
        dragStartX.current = gestureState.x0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (isDragging.current && onMenuDrag && gestureState.dx > 0) {
          onMenuDrag(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isDragging.current && onMenuDragEnd) {
          onMenuDragEnd(gestureState.dx, gestureState.vx * 1000);
        }
        isDragging.current = false;
      },
      onPanResponderTerminate: (_, gestureState) => {
        if (isDragging.current && onMenuDragEnd) {
          onMenuDragEnd(gestureState.dx, 0);
        }
        isDragging.current = false;
      },
    })
  ).current;

  return (
    <BlurHeaderWrapper style={{ paddingTop: insets.top + Spacing.sm }}>
    <View style={styles.container}>
      {/* Left Side — Hamburger menu button or back button */}
      <View style={styles.leftSection} {...(onHamburgerPress ? menuPanResponder.panHandlers : {})}>
        {onBackPress ? (
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={26} color={colors.text} />
          </TouchableOpacity>
        ) : onHamburgerPress ? (
          <MetallicRingButton
            onPress={handleHamburgerPress}
            size={36}
            innerSize={33}
            menuProgress={menuProgress}
          >
            <Ionicons name="menu" size={18} color={isDark ? '#FFFFFF' : '#000000'} />
          </MetallicRingButton>
        ) : null}
      </View>

      {/* Center - Username with down arrow (Instagram-style) */}
      <TouchableOpacity
        style={styles.usernameContainer}
        onPress={handleUsernamePress}
        activeOpacity={onUsernamePress ? 0.7 : 1}
        disabled={!onUsernamePress}
      >
        <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
          {username}
        </Text>
        {onUsernamePress && (
          <Ionicons name="chevron-down" size={16} color={colors.text} style={styles.chevron} />
        )}
      </TouchableOpacity>

      {/* Right Side - Settings */}
      <View style={styles.rightSection}>
        {resolvedSettingsPress && (
          <MetallicRingButton onPress={handleSettingsPress} size={36} innerSize={33}>
            <Ionicons name="settings-outline" size={16} color={isDark ? '#FFFFFF' : '#000000'} />
          </MetallicRingButton>
        )}
      </View>
    </View>
    </BlurHeaderWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  leftSection: {
    width: 40,
    alignItems: 'flex-start',
  },
  usernameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  username: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  chevron: {
    marginLeft: 4,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    width: 40,
    alignItems: 'flex-end',
  },
  iconButton: {
    padding: Spacing.xs,
  },
});
