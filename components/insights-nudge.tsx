/**
 * InsightsNudge - Subtle inline card encouraging free users to upgrade
 *
 * Appears after card 8 for free users. Shows once per session.
 * Frosted glass style, dismissible, ~80px height.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { IconSymbol } from '@/components/ui/icon-symbol';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DISMISS_KEY = 'insights_nudge_dismissed_session';

interface InsightsNudgeProps {
  /** Trial variant: shows days remaining */
  trialDaysLeft?: number;
  /** Called when user dismisses the nudge */
  onDismiss?: () => void;
}

export function InsightsNudge({ trialDaysLeft, onDismiss }: InsightsNudgeProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isTrialVariant = trialDaysLeft !== undefined && trialDaysLeft > 0;

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/paywall' as any);
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: colorScheme === 'dark'
          ? 'rgba(30, 30, 35, 0.85)'
          : 'rgba(255, 255, 255, 0.9)',
        borderColor: colorScheme === 'dark'
          ? 'rgba(255, 255, 255, 0.1)'
          : 'rgba(0, 0, 0, 0.06)',
      },
    ]}>
      {/* Gradient accent line */}
      <LinearGradient
        colors={[BrandColors.loopGreen, BrandColors.loopBlue]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentLine}
      />

      <View style={styles.content}>
        {/* Left: sparkle icon + text */}
        <View style={styles.textSection}>
          <IconSymbol name="sparkles" size={16} color={BrandColors.loopBlue} />
          <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
            {isTrialVariant
              ? `Your trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}`
              : 'Unlock AI insights on all recommendations'}
          </Text>
        </View>

        {/* Right: CTA button + dismiss */}
        <View style={styles.actions}>
          <Pressable style={styles.ctaButton} onPress={handleUpgrade}>
            <LinearGradient
              colors={[BrandColors.loopBlue, BrandColors.loopBlueDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>
                {isTrialVariant ? 'Keep Plus' : 'Try Plus'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={styles.dismissButton}
            onPress={handleDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 8,
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accentLine: {
    height: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  textSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  message: {
    ...Typography.bodySmall,
    fontFamily: 'Urbanist-Medium',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ctaButton: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  ctaGradient: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
  },
  ctaText: {
    ...Typography.labelSmall,
    color: '#FFFFFF',
    fontFamily: 'Urbanist-SemiBold',
  },
  dismissButton: {
    padding: 4,
  },
});
