/**
 * Upgrade Feed Card
 *
 * Inline card shown between AI-curated and discovery sections in the blended feed.
 * Encourages free users to upgrade to Loop Plus for more personalized picks.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { TIER_PRICING } from '@/types/subscription';

interface UpgradeFeedCardProps {
  dailyAiLimit: number;
  onDismiss: () => void;
}

export function UpgradeFeedCard({ dailyAiLimit, onDismiss }: UpgradeFeedCardProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const router = useRouter();

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/paywall' as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Gradient accent bar */}
      <LinearGradient
        colors={[BrandColors.loopGreen, BrandColors.loopBlue]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentBar}
      />

      <View style={styles.content}>
        {/* Dismiss button */}
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.textRow}>
          <Ionicons name="sparkles" size={20} color={BrandColors.loopBlue} />
          <Text style={[styles.title, { color: colors.text }]}>
            Your {dailyAiLimit} personalized picks for today
          </Text>
        </View>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Keep scrolling to explore more places below
        </Text>

        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={handleUpgrade}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[BrandColors.loopBlue, BrandColors.loopBlueDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.upgradeGradient}
          >
            <Ionicons name="star" size={16} color="#FFFFFF" />
            <Text style={styles.upgradeText}>
              Upgrade to Plus — ${TIER_PRICING.plus}/mo
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  accentBar: {
    height: 3,
  },
  content: {
    padding: Spacing.md,
    paddingTop: Spacing.sm,
  },
  dismissButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    padding: Spacing.xs,
    zIndex: 1,
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingRight: Spacing.xl,
  },
  title: {
    ...Typography.bodyLarge,
    fontFamily: 'Urbanist-SemiBold',
    flex: 1,
  },
  subtitle: {
    ...Typography.bodySmall,
    marginTop: Spacing.xs,
    marginLeft: 28, // Align with text after icon
  },
  upgradeButton: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  upgradeText: {
    ...Typography.labelMedium,
    color: '#FFFFFF',
    fontFamily: 'Urbanist-SemiBold',
  },
});
