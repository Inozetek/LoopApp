/**
 * Loop Header Component
 *
 * Snapchat-style header with centered Loop logo
 * Appears at the top of all main screens
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors, Spacing, Shadows } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface LoopHeaderProps {
  showBackButton?: boolean;
  showSettingsButton?: boolean;
  onSettingsPress?: () => void;
  rightAction?: React.ReactNode;
}

export function LoopHeader({
  showBackButton = false,
  showSettingsButton = true,
  onSettingsPress,
  rightAction,
}: LoopHeaderProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const handleLogoPress = () => {
    // Tapping logo returns to For You feed (like Snapchat)
    router.push('/(tabs)');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.sm }]}>
      {/* Left Side */}
      <View style={styles.leftSection}>
        {showBackButton && (
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Center - Loop Logo */}
      <TouchableOpacity
        style={styles.logoContainer}
        onPress={handleLogoPress}
        activeOpacity={0.7}
      >
        <Image
          source={require('@/assets/images/loop-logo6.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Right Side */}
      <View style={styles.rightSection}>
        {rightAction ? (
          rightAction
        ) : showSettingsButton ? (
          <TouchableOpacity
            onPress={onSettingsPress}
            style={styles.iconButton}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : null}
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 191, 255, 0.1)',
    ...Shadows.sm,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  logoContainer: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    height: 32,
    width: 80,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  iconButton: {
    padding: Spacing.sm,
  },
});
