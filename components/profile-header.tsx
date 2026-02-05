/**
 * Profile Header Component
 *
 * Instagram-style profile header with username.
 * Features:
 * - Username/name as title
 * - Settings gear on right
 * - Optional back button on left
 * - Clean, minimal design
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Spacing, Typography } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface ProfileHeaderProps {
  username: string;
  onBackPress?: () => void;
  onSettingsPress?: () => void;
  onMenuPress?: () => void;
}

export function ProfileHeader({
  username,
  onBackPress,
  onSettingsPress,
  onMenuPress,
}: ProfileHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBackPress?.();
  };

  const handleSettingsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSettingsPress?.();
  };

  const handleMenuPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onMenuPress?.();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.sm }]}>
      {/* Left Side */}
      <View style={styles.leftSection}>
        {onBackPress && (
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={26} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Center - Username */}
      <View style={styles.usernameContainer}>
        <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
          {username}
        </Text>
      </View>

      {/* Right Side - Settings/Menu */}
      <View style={styles.rightSection}>
        {onSettingsPress && (
          <TouchableOpacity
            onPress={handleSettingsPress}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        {onMenuPress && (
          <TouchableOpacity
            onPress={handleMenuPress}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="menu" size={26} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  leftSection: {
    width: 40,
    alignItems: 'flex-start',
  },
  usernameContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  username: {
    ...Typography.titleLarge,
    fontWeight: '700',
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
