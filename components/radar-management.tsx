/**
 * Radar Management Screen ("My Radar")
 *
 * Full management view shown in the profile drawer:
 * - List of active radars with type icons and last-triggered info
 * - Recent alerts history
 * - Add new radar button
 * - Delete/toggle individual radars
 * - Tier limit display
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { ThemeColors, BrandColors, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import {
  listRadars,
  deleteRadar,
  getRecentNotifications,
} from '@/services/radar-service';
import { RADAR_LIMITS, HOOK_TYPE_META } from '@/types/radar';
import type { UserHook, HookNotification, HookType } from '@/types/radar';
import type { SubscriptionTier } from '@/types/subscription';

// ============================================================================
// PROPS
// ============================================================================

interface RadarManagementProps {
  tier: SubscriptionTier;
  onAddRadar: () => void;
  onClose?: () => void;
  onViewAllAlerts?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RadarManagement({ tier, onAddRadar, onClose, onViewAllAlerts }: RadarManagementProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? ThemeColors.dark : ThemeColors.light;
  const { user } = useAuth();

  const [radars, setRadars] = useState<UserHook[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<HookNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = user?.id || 'demo-user-123';
  const limits = RADAR_LIMITS[tier];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [radarList, alerts] = await Promise.all([
        listRadars(userId),
        getRecentNotifications(userId, 10),
      ]);
      setRadars(radarList);
      setRecentAlerts(alerts);
    } catch (err) {
      console.error('[RadarManagement] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = (radar: UserHook) => {
    Alert.alert(
      'Remove Radar',
      `Stop tracking ${radar.entityName || radar.category || 'this radar'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const success = await deleteRadar(userId, radar.id);
            if (success) {
              setRadars(prev => prev.filter(r => r.id !== radar.id));
            }
          },
        },
      ]
    );
  };

  const getTimeAgo = (dateStr?: string): string => {
    if (!dateStr) return 'Never triggered';
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>My Radar</Text>
        <Pressable
          style={[styles.addButton, { backgroundColor: BrandColors.loopPurple }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAddRadar();
          }}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Limit indicator */}
      <View style={[styles.limitBar, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.06)' }]}>
        <Ionicons name="radio-outline" size={14} color={BrandColors.loopPurple} />
        <Text style={[styles.limitText, { color: colors.textSecondary }]}>
          {radars.length} of {limits.total === Infinity ? 'unlimited' : limits.total} radars active
        </Text>
        {tier === 'free' && (
          <Text style={[styles.upgradeHint, { color: BrandColors.loopPurple }]}>
            Upgrade for unlimited
          </Text>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={BrandColors.loopPurple} style={styles.loader} />
      ) : (
        <>
          {/* Active Radars */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Active Radars
            </Text>

            {radars.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.cardBackground }]}>
                <Ionicons name="radio-outline" size={40} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  Nothing on your radar yet
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Add artists, categories, or venues to never miss out.
                </Text>
                <Pressable
                  style={[styles.emptyButton, { backgroundColor: BrandColors.loopPurple }]}
                  onPress={onAddRadar}
                >
                  <Text style={styles.emptyButtonText}>Add Your First Radar</Text>
                </Pressable>
              </View>
            ) : (
              radars.map(radar => (
                <RadarListItem
                  key={radar.id}
                  radar={radar}
                  colors={colors}
                  isDark={isDark}
                  onDelete={() => handleDelete(radar)}
                  timeAgo={getTimeAgo(radar.lastTriggeredAt)}
                />
              ))
            )}
          </View>

          {/* Recent Alerts */}
          {recentAlerts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Recent Alerts
                </Text>
                {onViewAllAlerts && (
                  <Pressable onPress={onViewAllAlerts} testID="view-all-alerts">
                    <Text style={[styles.viewAllText, { color: BrandColors.loopViolet }]}>
                      View All
                    </Text>
                  </Pressable>
                )}
              </View>
              {recentAlerts.slice(0, 3).map(alert => (
                <AlertListItem
                  key={alert.id}
                  alert={alert}
                  colors={colors}
                  isDark={isDark}
                />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function RadarListItem({
  radar,
  colors,
  isDark,
  onDelete,
  timeAgo,
}: {
  radar: UserHook;
  colors: typeof ThemeColors.light;
  isDark: boolean;
  onDelete: () => void;
  timeAgo: string;
}) {
  const meta = HOOK_TYPE_META[radar.hookType];

  return (
    <View style={[styles.listItem, { backgroundColor: colors.cardBackground }]}>
      <View style={styles.listItemIcon}>
        <Text style={styles.listItemEmoji}>{meta.icon}</Text>
      </View>
      <View style={styles.listItemContent}>
        <Text style={[styles.listItemName, { color: colors.text }]} numberOfLines={1}>
          {radar.entityName || radar.category || meta.label}
        </Text>
        <Text style={[styles.listItemMeta, { color: colors.textSecondary }]}>
          {meta.label} {radar.lastTriggeredAt ? `\u00B7 Last alert: ${timeAgo}` : '\u00B7 Checking...'}
        </Text>
      </View>
      <Pressable onPress={onDelete} hitSlop={12} style={styles.deleteButton}>
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function AlertListItem({
  alert,
  colors,
  isDark,
}: {
  alert: HookNotification;
  colors: typeof ThemeColors.light;
  isDark: boolean;
}) {
  const event = alert.eventData;

  return (
    <View style={[styles.alertItem, { backgroundColor: colors.cardBackground }]}>
      <View style={styles.alertDot} />
      <View style={styles.alertContent}>
        <Text style={[styles.alertTitle, { color: colors.text }]} numberOfLines={1}>
          {alert.title}
        </Text>
        <Text style={[styles.alertBody, { color: colors.textSecondary }]} numberOfLines={1}>
          {event?.venue ? `${event.venue} \u00B7 ` : ''}
          {event?.date ? formatAlertDate(event.date) : ''}
        </Text>
        <Text style={[styles.alertTime, { color: colors.textSecondary }]}>
          Triggered {formatTimeAgo(alert.createdAt)}
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatAlertDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  limitText: {
    fontSize: 14,
    flex: 1,
  },
  upgradeHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    marginTop: 60,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: 'Urbanist-SemiBold',
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  listItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  listItemEmoji: {
    fontSize: 18,
  },
  listItemContent: {
    flex: 1,
  },
  listItemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  listItemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    padding: Spacing.xs,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.loopPurple,
    marginTop: 6,
    marginRight: Spacing.sm,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  alertBody: {
    fontSize: 12,
    marginTop: 2,
  },
  alertTime: {
    fontSize: 10,
    marginTop: 4,
  },
});

export default RadarManagement;
