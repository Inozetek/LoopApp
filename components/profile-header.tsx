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
import Entypo from '@expo/vector-icons/Entypo';
import * as Haptics from 'expo-haptics';
import { Spacing, Typography } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BlurHeaderWrapper } from '@/components/blur-header-wrapper';

interface ProfileHeaderProps {
  username: string;
  onBackPress?: () => void;
  onMenuPress?: () => void;
  onUsernamePress?: () => void;
}

export function ProfileHeader({
  username,
  onBackPress,
  onMenuPress,
  onUsernamePress,
}: ProfileHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBackPress?.();
  };

  const handleMenuPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onMenuPress?.();
  };

  const handleUsernamePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUsernamePress?.();
  };

  return (
    <BlurHeaderWrapper style={{ paddingTop: insets.top + Spacing.sm }}>
    <View style={styles.container}>
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

      {/* Right Side - Hamburger Menu */}
      <View style={styles.rightSection}>
        {onMenuPress && (
          <TouchableOpacity
            onPress={handleMenuPress}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Entypo name="cog" size={24} color={colors.text} />
          </TouchableOpacity>
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
