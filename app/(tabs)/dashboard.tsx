/**
 * Business Dashboard Tab
 *
 * Overview of business performance metrics.
 * Shows impressions, clicks, calendar adds, and CTR.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, BrandColors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { getBusinessOverview, getBusinessAnalytics, type BusinessOverview } from '@/services/business-service';
import type { BusinessDailyAnalytics } from '@/types/database';

export default function DashboardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = ThemeColors[colorScheme];
  const insets = useSafeAreaInsets();
  const { businessProfile } = useAuth();

  const [overview, setOverview] = useState<BusinessOverview | null>(null);
  const [analytics, setAnalytics] = useState<BusinessDailyAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!businessProfile) {
      setLoading(false);
      return;
    }

    try {
      const [overviewData, analyticsData] = await Promise.all([
        getBusinessOverview(businessProfile.id),
        getBusinessAnalytics(businessProfile.id, 30),
      ]);
      setOverview(overviewData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [businessProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const trendIcon = overview?.recentTrend === 'up' ? 'trending-up' : overview?.recentTrend === 'down' ? 'trending-down' : 'remove';
  const trendColor = overview?.recentTrend === 'up' ? BrandColors.loopGreen : overview?.recentTrend === 'down' ? BrandColors.error : colors.textSecondary;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.loopBlue} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.md }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={BrandColors.loopBlue} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Dashboard</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {businessProfile?.business_name || 'Your Business'}
          </Text>
        </View>

        {/* Tier Badge */}
        <View style={[styles.tierBadge, { backgroundColor: BrandColors.loopBlue + '15' }]}>
          <Ionicons name="shield-checkmark" size={16} color={BrandColors.loopBlue} />
          <Text style={[styles.tierText, { color: BrandColors.loopBlue }]}>
            {(businessProfile?.business_tier || 'organic').charAt(0).toUpperCase() + (businessProfile?.business_tier || 'organic').slice(1)} Plan
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.cardBackground, ...Shadows.sm }]}>
            <Ionicons name="eye-outline" size={24} color={BrandColors.loopBlue} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {overview?.totalImpressions.toLocaleString() || '0'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Impressions</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.cardBackground, ...Shadows.sm }]}>
            <Ionicons name="hand-left-outline" size={24} color={BrandColors.loopGreen} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {overview?.totalClicks.toLocaleString() || '0'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Clicks</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.cardBackground, ...Shadows.sm }]}>
            <Ionicons name="calendar-outline" size={24} color={BrandColors.loopOrange} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {overview?.totalCalendarAdds.toLocaleString() || '0'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Calendar Adds</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.cardBackground, ...Shadows.sm }]}>
            <Ionicons name={trendIcon as any} size={24} color={trendColor} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {overview?.clickThroughRate || 0}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>CTR</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: BrandColors.loopBlue }]}
            onPress={() => router.push('/(tabs)/listing')}
          >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionText}>Edit Listing</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: BrandColors.loopGreen }]}
            onPress={() => router.push('/(tabs)/analytics')}
          >
            <Ionicons name="bar-chart-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionText}>View Analytics</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Last 7 Days</Text>
        {analytics.slice(-7).length > 0 ? (
          <View style={[styles.recentCard, { backgroundColor: colors.cardBackground, ...Shadows.sm }]}>
            {analytics.slice(-7).map((day, idx) => (
              <View key={day.id || idx} style={[styles.dayRow, idx < 6 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                <Text style={[styles.dayDate, { color: colors.text }]}>
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
                <View style={styles.dayStats}>
                  <Text style={[styles.dayStatText, { color: colors.textSecondary }]}>
                    {day.impressions} views
                  </Text>
                  <Text style={[styles.dayStatText, { color: BrandColors.loopGreen }]}>
                    {day.clicks} clicks
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="analytics-outline" size={32} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No analytics data yet. Data will appear once users start seeing your listing.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.headlineMedium,
  },
  headerSubtitle: {
    ...Typography.bodyMedium,
    marginTop: 4,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 6,
    marginBottom: Spacing.lg,
  },
  tierText: {
    ...Typography.labelMedium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    ...Typography.labelSmall,
  },
  sectionTitle: {
    ...Typography.titleMedium,
    marginBottom: Spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  recentCard: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  dayDate: {
    ...Typography.bodyMedium,
    fontWeight: '500',
  },
  dayStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dayStatText: {
    ...Typography.bodySmall,
  },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.bodySmall,
    textAlign: 'center',
  },
});
