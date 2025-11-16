/**
 * API Usage Banner
 * Shows Google Places API usage at the top of the screen during development
 * Only visible when API key is configured
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { getAPIUsageStats } from '@/utils/api-cost-tracker';
import { IconSymbol } from '@/components/ui/icon-symbol';

export function APIUsageBanner() {
  const [stats, setStats] = useState<{
    requestCount: number;
    totalCostCents: number;
    percentUsed: number;
    remainingCredit: number;
  } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Only show banner if API key is configured
  const apiKeyConfigured = !!process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  useEffect(() => {
    if (!apiKeyConfigured) return;

    loadStats();
    const interval = setInterval(loadStats, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [apiKeyConfigured]);

  const loadStats = async () => {
    const data = await getAPIUsageStats();
    setStats(data);
  };

  if (!apiKeyConfigured || !stats) return null;

  // Don't show if usage is 0
  if (stats.requestCount === 0) return null;

  // Determine status color
  const getStatusColor = () => {
    if (stats.percentUsed >= 80) return '#EF4444'; // Red
    if (stats.percentUsed >= 50) return '#F59E0B'; // Orange
    return '#10B981'; // Green
  };

  const getStatusIcon = () => {
    if (stats.percentUsed >= 80) return 'exclamationmark.triangle.fill';
    if (stats.percentUsed >= 50) return 'exclamationmark.circle.fill';
    return 'checkmark.circle.fill';
  };

  const statusColor = getStatusColor();

  if (isCollapsed) {
    return (
      <Pressable
        style={[styles.collapsedBanner, { backgroundColor: statusColor }]}
        onPress={() => setIsCollapsed(false)}
      >
        <IconSymbol name={getStatusIcon()} size={14} color="#fff" />
        <Text style={styles.collapsedText}>
          API: {stats.percentUsed.toFixed(0)}%
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.banner, { borderLeftColor: statusColor }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <IconSymbol name={getStatusIcon()} size={16} color={statusColor} />
          <Text style={styles.title}>Google Places API Usage</Text>
        </View>
        <Pressable onPress={() => setIsCollapsed(true)}>
          <IconSymbol name="chevron.up" size={16} color="#6B7280" />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Requests</Text>
          <Text style={styles.statValue}>{stats.requestCount}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Cost</Text>
          <Text style={styles.statValue}>${(stats.totalCostCents / 100).toFixed(2)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Used</Text>
          <Text style={[styles.statValue, { color: statusColor }]}>
            {stats.percentUsed.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Left</Text>
          <Text style={styles.statValue}>${(stats.remainingCredit / 100).toFixed(0)}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${Math.min(stats.percentUsed, 100)}%`,
              backgroundColor: statusColor,
            }
          ]}
        />
      </View>

      {stats.percentUsed >= 80 && (
        <Text style={styles.warningText}>
          ⚠️ Approaching free tier limit! API calls will be blocked at 95%.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  warningText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 6,
    fontWeight: '500',
  },
  collapsedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 8,
  },
  collapsedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
