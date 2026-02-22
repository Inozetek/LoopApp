/**
 * Paywall / Pricing Screen
 *
 * Full-screen comparison of Free vs Loop Plus tiers.
 * Tapping "Start 7-Day Free Trial" creates a Stripe Checkout session via
 * Supabase Edge Function and opens the checkout URL in the system browser.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { TIER_PRICING, TIER_NAMES } from '@/types/subscription';
import { useAuth } from '@/contexts/auth-context';
import { LoopLogoVariant } from '@/components/loop-logo-variant';
import {
  createUserCheckoutSession,
  restoreUserSubscription,
  createCustomerPortalSession,
} from '@/services/stripe-service';

type BillingCycle = 'monthly' | 'annual';

const FEATURES = [
  { label: 'Personalized picks per session', free: '8', plus: 'Unlimited', icon: 'sparkles' as const },
  { label: 'Fresh Google Places discoveries', free: false, plus: true, icon: 'compass' as const },
  { label: 'AI match explanations', free: false, plus: true, icon: 'chatbubble' as const },
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
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const isAlreadyPlus = user?.subscription_tier === 'plus';
  const monthlyPrice = TIER_PRICING.plus;
  const annualPrice = TIER_PRICING.plus_annual;
  const annualMonthly = (annualPrice / 12).toFixed(2);
  const savingsPercent = Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);

  const handleSubscribe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!user?.id) {
      Alert.alert('Sign In Required', 'Please sign in to subscribe to Loop Plus.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await createUserCheckoutSession(user.id, billingCycle);

      if (result.error) {
        Alert.alert('Checkout Error', result.error);
        return;
      }

      if (result.url) {
        // Open Stripe Checkout in the system browser
        await WebBrowser.openBrowserAsync(result.url);
      }
    } catch (error) {
      console.error('[Paywall] Checkout error:', error);
      Alert.alert(
        'Something went wrong',
        'Unable to start checkout. Please try again later.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!user?.id) {
      Alert.alert('Sign In Required', 'Please sign in to restore your purchase.');
      return;
    }

    setIsRestoring(true);

    try {
      const result = await restoreUserSubscription(user.id);

      if (result.error) {
        Alert.alert('Restore Failed', result.error);
        return;
      }

      if (result.tier === 'plus') {
        Alert.alert(
          'Subscription Restored',
          'Your Loop Plus subscription has been restored successfully!',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        Alert.alert(
          'No Subscription Found',
          'We could not find an active Loop Plus subscription for your account.',
        );
      }
    } catch (error) {
      console.error('[Paywall] Restore error:', error);
      Alert.alert(
        'Something went wrong',
        'Unable to restore purchases. Please try again later.',
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!user?.id) return;

    setIsLoading(true);

    try {
      const result = await createCustomerPortalSession(user.id);

      if (result.error) {
        Alert.alert('Error', result.error);
        return;
      }

      if (result.url) {
        await WebBrowser.openBrowserAsync(result.url);
      }
    } catch (error) {
      console.error('[Paywall] Portal error:', error);
      Alert.alert(
        'Something went wrong',
        'Unable to open subscription management. Please try again later.',
      );
    } finally {
      setIsLoading(false);
    }
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
          <LoopLogoVariant size={36} flat />
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
        <TouchableOpacity
          onPress={handleRestore}
          style={styles.restoreButton}
          disabled={isRestoring}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text style={[styles.restoreText, { color: colors.textSecondary }]}>
              Restore Purchases
            </Text>
          )}
        </TouchableOpacity>

        {/* Manage subscription (only for existing subscribers) */}
        {isAlreadyPlus && (
          <TouchableOpacity
            onPress={handleManageSubscription}
            style={styles.restoreButton}
            disabled={isLoading}
          >
            <Text style={[styles.restoreText, { color: BrandColors.loopBlue }]}>
              Manage Subscription
            </Text>
          </TouchableOpacity>
        )}

        {/* Legal links */}
        <Text style={[styles.legalText, { color: colors.textSecondary }]}>
          Payment will be processed securely via Stripe. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
        </Text>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={isAlreadyPlus ? handleManageSubscription : handleSubscribe}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <LinearGradient
            colors={isAlreadyPlus
              ? ['#8E8E93', '#8E8E93']
              : [BrandColors.loopBlue, BrandColors.loopBlueDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : isAlreadyPlus ? (
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            ) : (
              <LoopLogoVariant size={20} flat />
            )}
            <Text style={styles.ctaText}>
              {isLoading
                ? 'Loading...'
                : isAlreadyPlus
                  ? 'Manage Subscription'
                  : 'Start 7-Day Free Trial'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        {!isAlreadyPlus && !isLoading && (
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
    ...Typography.headlineLarge,
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
