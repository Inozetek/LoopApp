/**
 * Upgrade Prompt Modal
 *
 * Reusable modal shown when free-tier users hit a feature limit.
 * Designed to feel premium and enticing, not blocking.
 *
 * Props:
 * - visible: whether the modal is shown
 * - onClose: dismiss callback
 * - feature: GatedFeature key describing what is locked
 * - onUpgrade: callback when user taps "Upgrade" (navigates to paywall)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ThemeColors,
  BrandColors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/constants/brand';
import { TIER_PRICING } from '@/types/subscription';
import { getFeatureLimitMessage, type GatedFeature } from '@/utils/tier-gate';

// ============================================================================
// FEATURE DISPLAY CONFIG
// ============================================================================

interface FeatureDisplay {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}

const FEATURE_DISPLAY: Record<GatedFeature, FeatureDisplay> = {
  radar_limit: {
    icon: 'radio-outline',
    title: 'Unlock Unlimited Radars',
  },
  radar_venue: {
    icon: 'location-outline',
    title: 'Unlock Venue Radars',
  },
  radar_proximity: {
    icon: 'people-outline',
    title: 'Unlock Friend Radars',
  },
  daily_recommendations: {
    icon: 'sparkles',
    title: 'Unlock Unlimited Picks',
  },
  group_planning: {
    icon: 'people',
    title: 'Unlock Group Planning',
  },
  calendar_sync: {
    icon: 'calendar-outline',
    title: 'Unlock Calendar Sync',
  },
  ai_explanations: {
    icon: 'chatbubble-ellipses-outline',
    title: 'Unlock AI Insights',
  },
  advanced_filters: {
    icon: 'options-outline',
    title: 'Unlock Advanced Filters',
  },
};

// ============================================================================
// PROPS
// ============================================================================

export interface UpgradePromptModalProps {
  visible: boolean;
  onClose: () => void;
  feature: GatedFeature;
  onUpgrade: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UpgradePromptModal({
  visible,
  onClose,
  feature,
  onUpgrade,
}: UpgradePromptModalProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const display = FEATURE_DISPLAY[feature] ?? FEATURE_DISPLAY.daily_recommendations;
  const message = getFeatureLimitMessage(feature);

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpgrade();
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }, Shadows.lg]}>
          {/* Icon Badge */}
          <LinearGradient
            colors={[BrandColors.loopBlue, BrandColors.loopGreen]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBadge}
          >
            <Ionicons name={display.icon} size={28} color="#FFFFFF" />
          </LinearGradient>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {display.title}
          </Text>

          {/* Feature message */}
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>

          {/* Pricing */}
          <Text style={[styles.pricing, { color: colors.textSecondary }]}>
            ${TIER_PRICING.plus}/mo or ${TIER_PRICING.plus_annual}/yr
          </Text>

          {/* CTA Button */}
          <Pressable
            style={styles.upgradeButton}
            onPress={handleUpgrade}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Loop Plus"
          >
            <LinearGradient
              colors={[BrandColors.loopBlue, BrandColors.loopBlueDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.upgradeGradient}
            >
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              <Text style={styles.upgradeText}>Upgrade to Loop Plus</Text>
            </LinearGradient>
          </Pressable>

          {/* Dismiss */}
          <Pressable
            style={styles.dismissButton}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Maybe Later"
          >
            <Text style={[styles.dismissText, { color: colors.textSecondary }]}>
              Maybe Later
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.titleLarge,
    fontFamily: 'Urbanist-Bold',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    ...Typography.bodyMedium,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  pricing: {
    ...Typography.labelMedium,
    marginBottom: Spacing.lg,
  },
  upgradeButton: {
    width: '100%',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md - 2,
    gap: Spacing.sm,
  },
  upgradeText: {
    ...Typography.labelLarge,
    color: '#FFFFFF',
    fontFamily: 'Urbanist-Bold',
  },
  dismissButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  dismissText: {
    ...Typography.bodyMedium,
  },
});

export default UpgradePromptModal;
