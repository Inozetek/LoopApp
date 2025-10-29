// @ts-nocheck - Phase 2 freemium feature
/**
 * Upgrade Modal - Benefit-Focused Upgrade Prompts (Phase 2)
 *
 * Shows when users hit tier limits with compelling upgrade messaging
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BrandColors, Spacing, BorderRadius, Shadows, Typography } from '@/constants/brand';
import { SubscriptionTier, TIER_PRICING } from '@/types/subscription';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  primaryButton: string;
  secondaryButton: string;
  targetTier: SubscriptionTier;
  featureHighlight?: string[];
  onUpgrade: () => void;
}

export function UpgradeModal({
  visible,
  onClose,
  title,
  message,
  primaryButton,
  secondaryButton,
  targetTier,
  featureHighlight,
  onUpgrade,
}: UpgradeModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpgrade();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const tierColors = {
    plus: BrandColors.loopGreen,
    premium: '#FF9500',
    free: colors.text,
  };

  const tierColor = tierColors[targetTier];
  const tierPrice = TIER_PRICING[targetTier];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Message */}
            <Text style={[styles.message, { color: colors.text }]}>{message}</Text>

            {/* Feature Highlights */}
            {featureHighlight && featureHighlight.length > 0 && (
              <View style={styles.featuresContainer}>
                <Text style={[styles.featuresTitle, { color: colors.text }]}>
                  Included with upgrade:
                </Text>
                {featureHighlight.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={20} color={tierColor} />
                    <Text style={[styles.featureText, { color: colors.text }]}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Pricing */}
            {tierPrice > 0 && (
              <View style={styles.pricingContainer}>
                <Text style={[styles.priceLabel, { color: colors.icon }]}>
                  Starting at
                </Text>
                <Text style={[styles.price, { color: tierColor }]}>
                  ${tierPrice.toFixed(2)}/month
                </Text>
                <Text style={[styles.priceNote, { color: colors.icon }]}>
                  Cancel anytime • 7-day free trial
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: tierColor }]}
              onPress={handleUpgrade}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>{primaryButton}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.icon }]}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {secondaryButton}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    flex: 1,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  message: {
    fontSize: Typography.sizes.md,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  featuresContainer: {
    marginBottom: Spacing.lg,
  },
  featuresTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  featureText: {
    fontSize: Typography.sizes.md,
    flex: 1,
  },
  pricingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 191, 255, 0.1)',
    marginBottom: Spacing.md,
  },
  priceLabel: {
    fontSize: Typography.sizes.sm,
    marginBottom: Spacing.xs,
  },
  price: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.xs,
  },
  priceNote: {
    fontSize: Typography.sizes.sm,
    opacity: 0.7,
  },
  actions: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  primaryButton: {
    height: 52,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semibold,
  },
  secondaryButton: {
    height: 52,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semibold,
  },
});
