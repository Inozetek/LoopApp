/**
 * Paywall / Pricing Screen
 *
 * Full-screen comparison of Free vs Loop Plus tiers.
 * Purchase actions are stubbed (Alert) until real RevenueCat/Stripe integration.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { TIER_PRICING, TIER_NAMES } from '@/types/subscription';
import { useAuth } from '@/contexts/auth-context';

type BillingCycle = 'monthly' | 'annual';

const FEATURES = [
  { label: 'Personalized picks per session', free: '8', plus: 'Unlimited', icon: 'sparkles' as const },
  { label: 'Fresh Google Places discoveries', free: false, plus: true, icon: 'compass' as const },
  { label: 'AI match explanations', free: false, plus: true, icon: 'chatbubble-ellipses' as const },
  { label: 'Group planning', free: false, plus: true, icon: 'people' as const },
  { label: 'Calendar sync', free: false, plus: true, icon: 'calendar' as const },
  { label: 'Advanced filters', free: false, plus: true, icon: 'options' as const },
  { label: 'Ad-free experience', free: false, plus: true, icon: 'eye-off' as const },
  { label: 'Unlimited refreshes', free: false, plus: true, icon: 'refresh' as const },
];

export default function PaywallScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');

  const isAlreadyPlus = user?.subscription_tier === 'plus';
  const monthlyPrice = TIER_PRICING.plus;
  const annualPrice = TIER_PRICING.plus_annual;
  const annualMonthly = (annualPrice / 12).toFixed(2);
  const savingsPercent = Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);

  const handleSubscribe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const price = billingCycle === 'monthly' ? `$${monthlyPrice}/mo` : `$${annualPrice}/yr`;
    Alert.alert(
      'Coming Soon',
      `Loop Plus (${price}) will be available when the app launches. You'll be among the first to know!`,
      [{ text: 'OK' }],
    );
  };

  const handleRestore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Restore Purchases',
      'Purchase restoration will be available when the app launches.',
      [{ text: 'OK' }],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={[BrandColors.loopBlue, BrandColors.loopGreen]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <Ionicons name="star" size={36} color="#FFFFFF" />
          <Text style={styles.heroTitle}>{TIER_NAMES.plus}</Text>
          <Text style={styles.heroSubtitle}>
            Unlock the full Loop experience
          </Text>
        </LinearGradient>

        {/* Billing toggle */}
        <View style={[styles.billingToggle, { backgroundColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.billingOption,
              billingCycle === 'monthly' && { backgroundColor: BrandColors.loopBlue },
            ]}
            onPress={() => { setBillingCycle('monthly'); Haptics.selectionAsync(); }}
          >
            <Text style={[
              styles.billingOptionText,
              { color: billingCycle === 'monthly' ? '#FFFFFF' : colors.text },
            ]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.billingOption,
              billingCycle === 'annual' && { backgroundColor: BrandColors.loopBlue },
            ]}
            onPress={() => { setBillingCycle('annual'); Haptics.selectionAsync(); }}
          >
            <Text style={[
              styles.billingOptionText,
              { color: billingCycle === 'annual' ? '#FFFFFF' : colors.text },
            ]}>
              Annual
            </Text>
            {billingCycle !== 'annual' && (
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsBadgeText}>Save {savingsPercent}%</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Pricing display */}
        <View style={styles.pricingSection}>
          {billingCycle === 'monthly' ? (
            <>
              <Text style={[styles.priceMain, { color: colors.text }]}>
                ${monthlyPrice}
              </Text>
              <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>
                per month
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.priceMain, { color: colors.text }]}>
                ${annualPrice}
              </Text>
              <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>
                per year ({`$${annualMonthly}/mo`})
              </Text>
            </>
          )}
        </View>

        {/* Feature comparison */}
        <View style={styles.featureSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            What you get with Plus
          </Text>

          {FEATURES.map((feature) => (
            <View
              key={feature.label}
              style={[styles.featureRow, { borderBottomColor: colors.border }]}
            >
              <View style={styles.featureLeft}>
                <Ionicons
                  name={feature.icon}
                  size={20}
                  color={BrandColors.loopBlue}
                  style={styles.featureIcon}
                />
                <Text style={[styles.featureLabel, { color: colors.text }]}>
                  {feature.label}
                </Text>
              </View>
              <View style={styles.featureRight}>
                {typeof feature.plus === 'string' ? (
                  <Text style={[styles.featureValue, { color: BrandColors.loopGreen }]}>
                    {feature.plus}
                  </Text>
                ) : (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={BrandColors.loopGreen}
                  />
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Restore purchases */}
        <TouchableOpacity onPress={handleRestore} style={styles.restoreButton}>
          <Text style={[styles.restoreText, { color: colors.textSecondary }]}>
            Restore Purchases
          </Text>
        </TouchableOpacity>

        {/* Legal links */}
        <Text style={[styles.legalText, { color: colors.textSecondary }]}>
          Payment will be charged to your App Store account. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
        </Text>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleSubscribe}
          activeOpacity={0.8}
          disabled={isAlreadyPlus}
        >
          <LinearGradient
            colors={isAlreadyPlus
              ? ['#8E8E93', '#8E8E93']
              : [BrandColors.loopBlue, BrandColors.loopBlueDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Ionicons name={isAlreadyPlus ? 'checkmark-circle' : 'star'} size={20} color="#FFFFFF" />
            <Text style={styles.ctaText}>
              {isAlreadyPlus ? 'Already Subscribed' : 'Start 7-Day Free Trial'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        {!isAlreadyPlus && (
          <Text style={[styles.ctaSubtext, { color: colors.textSecondary }]}>
            Cancel anytime. No charge until trial ends.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },

  // Hero
  heroBanner: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    ...Typography.headingLarge,
    color: '#FFFFFF',
    marginTop: Spacing.sm,
  },
  heroSubtitle: {
    ...Typography.bodyMedium,
    color: 'rgba(255,255,255,0.85)',
    marginTop: Spacing.xs,
  },

  // Billing toggle
  billingToggle: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  billingOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.xs,
  },
  billingOptionText: {
    ...Typography.labelMedium,
    fontFamily: 'Urbanist-SemiBold',
  },
  savingsBadge: {
    backgroundColor: BrandColors.loopGreen,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  savingsBadgeText: {
    ...Typography.labelSmall,
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Urbanist-Bold',
  },

  // Pricing
  pricingSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  priceMain: {
    fontSize: 48,
    fontFamily: 'Urbanist-Bold',
    lineHeight: 56,
  },
  pricePeriod: {
    ...Typography.bodyMedium,
    marginTop: Spacing.xs,
  },

  // Features
  featureSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.labelMedium,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  featureLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  featureIcon: {
    marginRight: Spacing.sm,
    width: 24,
  },
  featureLabel: {
    ...Typography.bodyMedium,
    flex: 1,
  },
  featureRight: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  featureValue: {
    ...Typography.labelMedium,
    fontFamily: 'Urbanist-SemiBold',
  },

  // Restore
  restoreButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  restoreText: {
    ...Typography.bodySmall,
    textDecorationLine: 'underline',
  },

  // Legal
  legalText: {
    ...Typography.bodySmall,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },

  // CTA
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  ctaButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  ctaText: {
    ...Typography.labelLarge,
    color: '#FFFFFF',
    fontFamily: 'Urbanist-Bold',
  },
  ctaSubtext: {
    ...Typography.bodySmall,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
