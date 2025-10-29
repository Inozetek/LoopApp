/**
 * Error State Component
 *
 * Displays friendly error messages with retry actions
 * Used when API calls fail or data loading encounters errors
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BrandColors, Typography, Spacing, BorderRadius } from '@/constants/brand';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryText?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function ErrorState({
  title = 'Something Went Wrong',
  message = 'We encountered an error loading this content. Please try again.',
  onRetry,
  retryText = 'Try Again',
  icon = 'alert-circle-outline',
}: ErrorStateProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleRetry = () => {
    if (onRetry) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRetry();
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: colors.tint + '15' }]}>
        <Ionicons name={icon} size={64} color={colors.icon} />
      </View>

      <Text style={[styles.title, Typography.headlineMedium, { color: colors.text }]}>
        {title}
      </Text>

      <Text style={[styles.message, Typography.bodyLarge, { color: colors.icon }]}>
        {message}
      </Text>

      {onRetry && (
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: BrandColors.loopBlue }]}
          onPress={handleRetry}
        >
          <Ionicons name="refresh-outline" size={20} color="#ffffff" />
          <Text style={[styles.retryText, Typography.labelLarge]}>
            {retryText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  retryText: {
    color: '#ffffff',
  },
});
