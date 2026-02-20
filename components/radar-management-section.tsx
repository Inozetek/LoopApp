/**
 * Radar Management Section
 *
 * Embeddable component for profile/settings screens that lets users:
 * - View all their radars (active and inactive)
 * - Toggle individual radars on/off
 * - Delete radars
 * - See tier usage (X of Y radars used)
 * - Add new radars via the existing AddRadarSheet
 *
 * Visual style follows the existing section components (my-group-plans-section, etc.)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { ThemeColors, BrandColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import {
  listAllRadars,
  toggleRadar,
  hardDeleteRadar,
} from '@/services/radar-service';
import {
  HOOK_TYPE_META,
  RADAR_LIMITS,
} from '@/types/radar';
import type { UserHook, HookType } from '@/types/radar';
import type { SubscriptionTier } from '@/types/subscription';
import AddRadarSheet from '@/components/add-radar-sheet';

// ============================================================================
// PURE HELPERS (tested in radar-management.test.ts)
// ============================================================================

/**
 * Human-readable "time ago" string from an ISO date.
 * Returns "Never triggered" if no date is provided.
 */
export function getTimeAgo(dateStr?: string): string {
  if (!dateStr) return 'Never triggered';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/**
 * Format an ISO date string as "Mon DD".
 */
export function formatAlertDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Lowercase relative time for notification timestamps.
 */
export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

/**
 * Get the display name for a radar item.
 * Preference: entityName > category > type label.
 */
export function getRadarDisplayName(radar: Pick<UserHook, 'hookType' | 'entityName' | 'category'>): string {
  const meta = HOOK_TYPE_META[radar.hookType];
  return radar.entityName || radar.category || meta.label;
}

/**
 * Build the limit display text.
 */
export function getLimitText(activeCount: number, tier: SubscriptionTier): string {
  const limits = RADAR_LIMITS[tier];
  const maxStr = limits.total === Infinity ? 'unlimited' : String(limits.total);
  return `${activeCount} of ${maxStr} radars active`;
}

/**
 * Whether to show an upgrade hint.
 */
export function shouldShowUpgradeHint(tier: SubscriptionTier): boolean {
  return tier === 'free';
}

// ============================================================================
// PROPS
// ============================================================================

interface RadarManagementSectionProps {
  tier: SubscriptionTier;
  onUpgrade?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const RadarManagementSection = React.memo(function RadarManagementSection({
  tier,
  onUpgrade,
}: RadarManagementSectionProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? ThemeColors.dark : ThemeColors.light;
  const { user } = useAuth();

  const userId = user?.id || 'demo-user-123';

  const [radars, setRadars] = useState<UserHook[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);

  // --------------------------------------------------------------------------
  // Data loading
  // --------------------------------------------------------------------------

  const loadRadars = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAllRadars(userId);
      setRadars(data);
    } catch (err) {
      console.error('[RadarManagement] Error loading radars:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadRadars();
  }, [loadRadars]);

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  const handleToggle = useCallback(async (radar: UserHook) => {
    setTogglingId(radar.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newState = !radar.isActive;
    const success = await toggleRadar(userId, radar.id, newState);
    if (success) {
      setRadars(prev =>
        prev.map(r => (r.id === radar.id ? { ...r, isActive: newState } : r))
      );
    } else {
      Alert.alert('Error', 'Failed to update radar. Please try again.');
    }
    setTogglingId(null);
  }, [userId]);

  const handleDelete = useCallback((radar: UserHook) => {
    Alert.alert(
      'Delete Radar',
      `Remove your ${getRadarDisplayName(radar)} radar? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(radar.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            const success = await hardDeleteRadar(userId, radar.id);
            if (success) {
              setRadars(prev => prev.filter(r => r.id !== radar.id));
            } else {
              Alert.alert('Error', 'Failed to delete radar. Please try again.');
            }
            setDeletingId(null);
          },
        },
      ]
    );
  }, [userId]);

  const handleRadarCreated = useCallback(() => {
    loadRadars();
  }, [loadRadars]);

  // --------------------------------------------------------------------------
  // Derived state
  // --------------------------------------------------------------------------

  const activeCount = radars.filter(r => r.isActive).length;
  const limitText = getLimitText(activeCount, tier);
  const showUpgrade = shouldShowUpgradeHint(tier);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <View style={styles.headerLeft}>
          <Ionicons name="radio-outline" size={20} color={BrandColors.loopPurple} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>My Radars</Text>
        </View>
        <Pressable
          style={[styles.addButton, { backgroundColor: BrandColors.loopPurple }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowAddSheet(true);
          }}
          accessibilityLabel="Add new radar"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      {/* Tier limit bar */}
      <View style={[styles.limitBar, { backgroundColor: colors.cardBackground }]}>
        <Ionicons name="speedometer-outline" size={14} color={colors.textSecondary} />
        <Text style={[styles.limitText, { color: colors.textSecondary }]}>
          {limitText}
        </Text>
        {showUpgrade && (
          <Pressable onPress={onUpgrade} hitSlop={8}>
            <Text style={[styles.upgradeLink, { color: BrandColors.loopPurple }]}>
              Upgrade
            </Text>
          </Pressable>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={BrandColors.loopPurple} />
        </View>
      ) : radars.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.cardBackground }]}>
          <Ionicons name="radio-outline" size={40} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No radars yet
          </Text>
          <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
            Set up your first radar to get alerted about artists, events, venues, and more.
          </Text>
          <Pressable
            style={[styles.emptyAddButton, { backgroundColor: BrandColors.loopPurple }]}
            onPress={() => setShowAddSheet(true)}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.emptyAddButtonText}>Create Your First Radar</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.radarList}>
          {radars.map(radar => (
            <RadarListItem
              key={radar.id}
              radar={radar}
              colors={colors}
              isToggling={togglingId === radar.id}
              isDeleting={deletingId === radar.id}
              onToggle={() => handleToggle(radar)}
              onDelete={() => handleDelete(radar)}
            />
          ))}
        </View>
      )}

      {/* Add Radar Sheet */}
      <AddRadarSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onRadarCreated={handleRadarCreated}
        tier={tier}
        onUpgrade={onUpgrade}
      />
    </View>
  );
});

// ============================================================================
// RADAR LIST ITEM
// ============================================================================

interface RadarListItemProps {
  radar: UserHook;
  colors: typeof ThemeColors.light;
  isToggling: boolean;
  isDeleting: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

const RadarListItem = React.memo(function RadarListItem({
  radar,
  colors,
  isToggling,
  isDeleting,
  onToggle,
  onDelete,
}: RadarListItemProps) {
  const meta = HOOK_TYPE_META[radar.hookType];
  const displayName = getRadarDisplayName(radar);
  const lastTriggered = getTimeAgo(radar.lastTriggeredAt);
  const triggerInfo = radar.triggerCount > 0
    ? `${radar.triggerCount} match${radar.triggerCount === 1 ? '' : 'es'}`
    : 'No matches yet';

  return (
    <View
      style={[
        styles.listItem,
        {
          backgroundColor: colors.cardBackground,
          opacity: radar.isActive ? 1 : 0.6,
        },
      ]}
    >
      {/* Type icon */}
      <View style={styles.iconContainer}>
        <Text style={styles.typeIcon}>{meta.icon}</Text>
      </View>

      {/* Info */}
      <View style={styles.itemInfo}>
        <Text
          style={[styles.itemName, { color: colors.text }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
          {meta.label} {'\u00B7'} {triggerInfo}
        </Text>
        <Text style={[styles.itemLastTriggered, { color: colors.textSecondary }]}>
          Last: {lastTriggered}
        </Text>
      </View>

      {/* Toggle and delete */}
      <View style={styles.itemActions}>
        <Switch
          value={radar.isActive}
          onValueChange={onToggle}
          disabled={isToggling}
          trackColor={{
            false: colors.border,
            true: BrandColors.loopPurple,
          }}
          thumbColor="#FFFFFF"
          accessibilityLabel={`Toggle ${displayName} radar`}
        />
        <Pressable
          onPress={onDelete}
          disabled={isDeleting}
          hitSlop={8}
          style={styles.deleteButton}
          accessibilityLabel={`Delete ${displayName} radar`}
          accessibilityRole="button"
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={BrandColors.error} />
          ) : (
            <Ionicons name="trash-outline" size={18} color={BrandColors.error} />
          )}
        </Pressable>
      </View>
    </View>
  );
});

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.titleMedium,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Tier limit bar
  limitBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  limitText: {
    ...Typography.bodySmall,
    flex: 1,
  },
  upgradeLink: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Loading
  loadingContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },

  // Empty state
  emptyState: {
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.titleMedium,
    marginTop: Spacing.xs,
  },
  emptyDescription: {
    ...Typography.bodyMedium,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  emptyAddButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Radar list
  radarList: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },

  // List item
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIcon: {
    fontSize: 20,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    ...Typography.titleSmall,
  },
  itemMeta: {
    ...Typography.bodySmall,
  },
  itemLastTriggered: {
    fontSize: 11,
    lineHeight: 14,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  deleteButton: {
    padding: 4,
  },
});

export default RadarManagementSection;
