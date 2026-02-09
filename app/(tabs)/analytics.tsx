/**
 * Business Analytics Tab
 *
 * Detailed analytics for business accounts.
 * Shows time-series data, performance trends, and insights.
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
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, BrandColors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { getBusinessAnalytics } from '@/services/business-service';
import type { BusinessDailyAnalytics } from '@/types/database';

type TimePeriod = 7 | 14 | 30;

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = ThemeColors[colorScheme];
  const insets = useSafeAreaInsets();
  const { businessProfile } = useAuth();

  const [analytics, setAnalytics] = useState<BusinessDailyAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(30);

  const loadData = useCallback(async () => {
    if (!businessProfile) {
      setLoading(false);
      return;
    }

    try {
      const data = await getBusinessAnalytics(businessProfile.id, timePeriod);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [businessProfile, timePeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Calculate summary stats
  const totalImpressions = analytics.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = analytics.reduce((s, a) => s + a.clicks, 0);
  const totalCalendarAdds = analytics.reduce((s, a) => s + a.calendar_adds, 0);
  const avgDailyImpressions = analytics.length > 0
    ? Math.round(totalImpressions / analytics.length)
    : 0;
  const ctr = totalImpressions > 0
    ? Math.round((totalClicks / totalImpressions) * 1000) / 10
    : 0;

  // Find best day
  const bestDay = analytics.reduce(
    (best, day) => (day.impressions > (best?.impressions || 0) ? day : best),
    null as BusinessDailyAnalytics | null
  );

  // Simple bar chart using view widths
  const maxImpressions = Math.max(...analytics.map((a) => a.impressions), 1);

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Analytics</Text>

        {/* Time Period Selector */}
        <View style={styles.periodRow}>
          {([7, 14, 30] as TimePeriod[]).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                {
                  backgroundColor: timePeriod === period ? BrandColors.loopBlue : colors.cardBackground,
                  borderColor: timePeriod === period ? BrandColors.loopBlue : colors.border,
                },
              ]}
              onPress={() => setTimePeriod(period)}
            >
              <Text
                style={[
                  styles.periodText,
                  { color: timePeriod === period ? '#FFFFFF' : colors.text },
                ]}
              >
                {period}D
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, ...Shadows.sm }]}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{totalImpressions}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Views</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, ...Shadows.sm }]}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{totalClicks}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Clicks</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, ...Shadows.sm }]}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{ctr}%</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>CTR</Text>
          </View>
        </View>

        {/* Insights */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Insights</Text>
        <View style={[styles.insightCard, { backgroundColor: colors.cardBackground, ...Shadows.sm }]}>
          <View style={styles.insightRow}>
            <Ionicons name="analytics" size={18} color={BrandColors.loopBlue} />
            <Text style={[styles.insightText, { color: colors.text }]}>
              Avg. {avgDailyImpressions} views/day
            </Text>
          </View>
          <View style={styles.insightRow}>
            <Ionicons name="calendar" size={18} color={BrandColors.loopGreen} />
            <Text style={[styles.insightText, { color: colors.text }]}>
              {totalCalendarAdds} users added you to their calendar
            </Text>
          </View>
          {bestDay && (
            <View style={styles.insightRow}>
              <Ionicons name="star" size={18} color={BrandColors.loopOrange} />
              <Text style={[styles.insightText, { color: colors.text }]}>
                Best day: {new Date(bestDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} ({bestDay.impressions} views)
              </Text>
            </View>
          )}
        </View>

        {/* Impressions Chart */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Impressions</Text>
        {analytics.length > 0 ? (
          <View style={[styles.chartContainer, { backgroundColor: colors.cardBackground, ...Shadows.sm }]}>
            {analytics.slice(-14).map((day, idx) => (
              <View key={day.id || idx} style={styles.chartRow}>
                <Text style={[styles.chartDate, { color: colors.textSecondary }]}>
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <View style={styles.chartBarContainer}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        backgroundColor: BrandColors.loopBlue,
                        width: `${Math.max((day.impressions / maxImpressions) * 100, 2)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.chartValue, { color: colors.text }]}>{day.impressions}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="bar-chart-outline" size={32} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No data yet for this period
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
  headerTitle: {
    ...Typography.headlineMedium,
    marginBottom: Spacing.md,
  },
  periodRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  periodButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  periodText: {
    ...Typography.labelMedium,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  summaryLabel: {
    ...Typography.labelSmall,
    marginTop: 4,
  },
  sectionTitle: {
    ...Typography.titleMedium,
    marginBottom: Spacing.sm,
  },
  insightCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  insightText: {
    ...Typography.bodyMedium,
    flex: 1,
  },
  chartContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 6,
    marginBottom: Spacing.lg,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  chartDate: {
    width: 50,
    ...Typography.labelSmall,
  },
  chartBarContainer: {
    flex: 1,
    height: 16,
    backgroundColor: 'rgba(128,128,128,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chartBar: {
    height: '100%',
    borderRadius: 4,
  },
  chartValue: {
    width: 30,
    textAlign: 'right',
    ...Typography.labelSmall,
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
