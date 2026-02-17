/**
 * Business Dashboard Screen
 *
 * Dashboard for business account owners to:
 * - View their business listing details
 * - See analytics (impressions, clicks, etc.)
 * - Manage subscription tier
 * - Edit business information
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LoopHeader } from '@/components/loop-header';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BorderRadius, BrandColors, Typography } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import { FEATURE_FLAGS } from '@/constants/feature-flags';
import { CreateHotDropSheet } from '@/components/create-hot-drop-sheet';
import type { BusinessTier } from '@/services/hot-drop-service';

interface BusinessAnalytics {
  impressions: number;
  clicks: number;
  calendar_adds: number;
  conversions: number;
}

export default function BusinessDashboardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const { user, businessProfile } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<BusinessAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [showHotDropSheet, setShowHotDropSheet] = useState(false);

  // Fetch business analytics
  const fetchAnalytics = async () => {
    if (!businessProfile?.id) return;

    try {
      // Get last 30 days of analytics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('business_analytics')
        .select('impressions, clicks, calendar_adds, conversions')
        .eq('business_id', businessProfile.id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;

      // Sum up the analytics
      const totals = (data || []).reduce((acc, day) => ({
        impressions: acc.impressions + (day.impressions || 0),
        clicks: acc.clicks + (day.clicks || 0),
        calendar_adds: acc.calendar_adds + (day.calendar_adds || 0),
        conversions: acc.conversions + (day.conversions || 0),
      }), { impressions: 0, clicks: 0, calendar_adds: 0, conversions: 0 });

      setAnalytics(totals);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Set default analytics if fetch fails
      setAnalytics({ impressions: 0, clicks: 0, calendar_adds: 0, conversions: 0 });
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [businessProfile?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  // Redirect if not a business account
  if (user?.account_type !== 'business') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoopHeader
          showBackButton={true}
          onBackPress={() => router.back()}
        />
        <View style={styles.emptyState}>
          <Ionicons name="storefront-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
            No Business Account
          </Text>
          <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
            Create a business account to access the dashboard.
          </Text>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: BrandColors.loopGreen }]}
            onPress={() => router.push('/auth/onboarding?accountType=business' as any)}
          >
            <Text style={styles.createButtonText}>Create Business Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderStatCard = (
    icon: string,
    label: string,
    value: number,
    color: string
  ) => (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>
        {value.toLocaleString()}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );

  const subscriptionTier = businessProfile?.subscription_tier || 'organic';
  const tierColors: Record<string, string> = {
    organic: colors.textSecondary,
    boosted: BrandColors.loopBlue,
    premium: BrandColors.loopGreen,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LoopHeader
        showBackButton={true}
        onBackPress={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={BrandColors.loopBlue}
          />
        }
      >
        {/* Business Header */}
        <View style={[styles.businessHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.businessAvatar, { backgroundColor: BrandColors.loopGreen }]}>
            <Ionicons name="storefront" size={40} color="#fff" />
          </View>
          <View style={styles.businessInfo}>
            <Text style={[styles.businessName, { color: colors.text }]}>
              {businessProfile?.business_name || 'Your Business'}
            </Text>
            <Text style={[styles.businessCategory, { color: colors.textSecondary }]}>
              {businessProfile?.business_category || 'Category'}
            </Text>
            <View style={styles.tierBadgeContainer}>
              <View style={[styles.tierBadge, { backgroundColor: tierColors[subscriptionTier] + '20' }]}>
                <Ionicons
                  name={subscriptionTier === 'premium' ? 'star' : subscriptionTier === 'boosted' ? 'trending-up' : 'leaf'}
                  size={14}
                  color={tierColors[subscriptionTier]}
                />
                <Text style={[styles.tierBadgeText, { color: tierColors[subscriptionTier] }]}>
                  {subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Analytics Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Last 30 Days
          </Text>

          {loadingAnalytics ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BrandColors.loopBlue} />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              {renderStatCard('eye-outline', 'Impressions', analytics?.impressions || 0, BrandColors.loopBlue)}
              {renderStatCard('hand-left-outline', 'Clicks', analytics?.clicks || 0, BrandColors.loopOrange)}
              {renderStatCard('calendar-outline', 'Calendar Adds', analytics?.calendar_adds || 0, BrandColors.loopPurple)}
              {renderStatCard('checkmark-circle-outline', 'Conversions', analytics?.conversions || 0, BrandColors.success)}
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Edit Listing', 'Business listing editor coming soon!');
            }}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: BrandColors.loopBlue + '20' }]}>
              <Ionicons name="create-outline" size={24} color={BrandColors.loopBlue} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Edit Listing</Text>
              <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
                Update photos, hours, and description
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (FEATURE_FLAGS.ENABLE_HOT_DROPS) {
                setShowHotDropSheet(true);
              } else {
                Alert.alert('Add Promotion', 'Promotions feature coming soon!');
              }
            }}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: BrandColors.loopOrange + '20' }]}>
              <Ionicons name="megaphone-outline" size={24} color={BrandColors.loopOrange} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                {FEATURE_FLAGS.ENABLE_HOT_DROPS ? 'Create Hot Drop' : 'Add Promotion'}
              </Text>
              <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
                {FEATURE_FLAGS.ENABLE_HOT_DROPS
                  ? 'Launch a time-limited deal for Loop users'
                  : 'Create special offers for Loop users'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('View Reviews', 'Reviews viewer coming soon!');
            }}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: BrandColors.like + '20' }]}>
              <Ionicons name="star-outline" size={24} color={BrandColors.like} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>View Reviews</Text>
              <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
                See what Loop users are saying
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Subscription Upgrade */}
        {subscriptionTier !== 'premium' && (
          <View style={styles.section}>
            <View style={[styles.upgradeCard, { backgroundColor: BrandColors.loopGreen + '15', borderColor: BrandColors.loopGreen }]}>
              <View style={styles.upgradeHeader}>
                <Ionicons name="rocket-outline" size={28} color={BrandColors.loopGreen} />
                <Text style={[styles.upgradeTitle, { color: colors.text }]}>
                  {subscriptionTier === 'organic' ? 'Boost Your Visibility' : 'Go Premium'}
                </Text>
              </View>
              <Text style={[styles.upgradeDescription, { color: colors.textSecondary }]}>
                {subscriptionTier === 'organic'
                  ? 'Get 15% more visibility with Boosted tier - only $49/month'
                  : 'Unlock 30% boost, analytics, and featured placement - $149/month'}
              </Text>
              <TouchableOpacity
                style={[styles.upgradeButton, { backgroundColor: BrandColors.loopGreen }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  Alert.alert('Upgrade', 'Stripe checkout coming soon!');
                }}
              >
                <Text style={styles.upgradeButtonText}>
                  Upgrade Now
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Footer spacing */}
        <View style={{ height: Spacing.xl * 2 }} />
      </ScrollView>

      {/* Create Hot Drop Sheet */}
      {FEATURE_FLAGS.ENABLE_HOT_DROPS && (
        <CreateHotDropSheet
          visible={showHotDropSheet}
          onClose={() => setShowHotDropSheet(false)}
          onCreated={() => {
            Alert.alert('Success', 'Your Hot Drop is now live!');
          }}
          businessId={businessProfile?.id || ''}
          businessName={businessProfile?.business_name || user?.name || ''}
          businessTier={(businessProfile?.subscription_tier as BusinessTier) || 'organic'}
          businessAddress={businessProfile?.address}
          businessLatitude={businessProfile?.latitude}
          businessLongitude={businessProfile?.longitude}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100, // Account for tab bar + safe area
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  businessAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  businessCategory: {
    fontSize: 15,
    marginBottom: 8,
  },
  tierBadgeContainer: {
    flexDirection: 'row',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statCard: {
    width: '47%',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: Spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
  },
  upgradeCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  upgradeDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  upgradeButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyStateDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  createButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
