/**
 * Radar Notification History — Full browsable history with type filters
 *
 * Features:
 * - FlatList with all radar notifications
 * - Filter chips by radar type (All, Artist, Film, Category, Venue)
 * - Time grouping (Today, Yesterday, Earlier)
 * - Status indicators (purple=pending, green=viewed, gray=dismissed)
 * - Tier-based date limits (free: 7 days, plus: unlimited)
 * - Tap notification → open ticket URL
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { ThemeColors, BrandColors, Spacing, BorderRadius } from '@/constants/brand';
import { getNotificationHistory } from '@/services/radar-service';
import { HOOK_TYPE_META, RADAR_LIMITS } from '@/types/radar';
import type { HookNotification, HookType } from '@/types/radar';
import type { SubscriptionTier } from '@/types/subscription';

// ============================================================================
// CONSTANTS
// ============================================================================

const FILTER_OPTIONS: { value: HookType | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '📡' },
  { value: 'artist', label: 'Artist', icon: '🎵' },
  { value: 'film_talent', label: 'Film', icon: '🎬' },
  { value: 'category', label: 'Category', icon: '🏷️' },
  { value: 'venue', label: 'Venue', icon: '📍' },
];

/** Status colors for notification state */
const STATUS_COLORS = {
  pending: BrandColors.loopViolet,
  sent: BrandColors.loopViolet,
  viewed: '#22C55E',
  dismissed: '#9CA3AF',
  expired: '#9CA3AF',
};

// ============================================================================
// TIME GROUPING
// ============================================================================

export function getTimeGroup(dateStr: string): 'Today' | 'Yesterday' | 'Earlier' {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  return 'Earlier';
}

export function formatNotificationTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// PROPS
// ============================================================================

interface RadarNotificationHistoryProps {
  visible: boolean;
  onClose: () => void;
  tier: SubscriptionTier;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RadarNotificationHistory({
  visible,
  onClose,
  tier,
}: RadarNotificationHistoryProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? ThemeColors.dark : ThemeColors.light;
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<HookNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<HookType | 'all'>('all');

  const userId = user?.id || 'demo-user-123';
  const limits = RADAR_LIMITS[tier];

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const results = await getNotificationHistory(
      userId,
      activeFilter === 'all' ? undefined : { hookType: activeFilter },
      tier
    );
    setNotifications(results);
    setLoading(false);
  }, [userId, activeFilter, tier]);

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible, loadNotifications]);

  const handleNotificationTap = (notification: HookNotification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (notification.eventData?.ticketUrl) {
      Linking.openURL(notification.eventData.ticketUrl);
    }
  };

  const handleFilterChange = (filter: HookType | 'all') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilter(filter);
  };

  // Group notifications by time
  const groupedSections = React.useMemo(() => {
    const groups: { title: string; data: HookNotification[] }[] = [];
    const groupMap: Record<string, HookNotification[]> = {};

    for (const notif of notifications) {
      const group = getTimeGroup(notif.createdAt);
      if (!groupMap[group]) groupMap[group] = [];
      groupMap[group].push(notif);
    }

    for (const title of ['Today', 'Yesterday', 'Earlier']) {
      if (groupMap[title]?.length) {
        groups.push({ title, data: groupMap[title] });
      }
    }

    return groups;
  }, [notifications]);

  // Flatten for FlatList with section headers
  const flatData = React.useMemo(() => {
    const items: (HookNotification | { type: 'header'; title: string })[] = [];
    for (const section of groupedSections) {
      items.push({ type: 'header', title: section.title });
      items.push(...section.data);
    }
    return items;
  }, [groupedSections]);

  const renderItem = ({ item }: { item: HookNotification | { type: 'header'; title: string } }) => {
    if ('type' in item && item.type === 'header') {
      return (
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
          {item.title}
        </Text>
      );
    }

    const notification = item as HookNotification;
    const statusColor = STATUS_COLORS[notification.status] || STATUS_COLORS.pending;

    return (
      <Pressable
        style={[styles.notifItem, { backgroundColor: colors.cardBackground }]}
        onPress={() => handleNotificationTap(notification)}
        testID={`notification-item-${notification.id}`}
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, { color: colors.text }]} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={[styles.notifBody, { color: colors.textSecondary }]} numberOfLines={2}>
            {notification.body}
          </Text>
          <Text style={[styles.notifTime, { color: colors.textSecondary }]}>
            {formatNotificationTime(notification.createdAt)}
          </Text>
        </View>
        {notification.eventData?.ticketUrl && (
          <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
        )}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.textSecondary + '20' }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Radar History</Text>
          <Pressable onPress={onClose} testID="close-history">
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Tier limit info for free users */}
        {limits.historyDays !== Infinity && (
          <View style={[styles.tierBanner, { backgroundColor: BrandColors.loopViolet + '15' }]}>
            <Ionicons name="information-circle-outline" size={16} color={BrandColors.loopViolet} />
            <Text style={[styles.tierBannerText, { color: BrandColors.loopViolet }]}>
              Showing last {limits.historyDays} days. Upgrade for full history.
            </Text>
          </View>
        )}

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map(option => (
            <Pressable
              key={option.value}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilter === option.value
                    ? BrandColors.loopViolet + '20'
                    : colors.cardBackground,
                  borderColor: activeFilter === option.value
                    ? BrandColors.loopViolet
                    : colors.textSecondary + '30',
                },
              ]}
              onPress={() => handleFilterChange(option.value)}
              testID={`filter-chip-${option.value}`}
            >
              <Text style={styles.filterIcon}>{option.icon}</Text>
              <Text
                style={[
                  styles.filterLabel,
                  {
                    color: activeFilter === option.value
                      ? BrandColors.loopViolet
                      : colors.textSecondary,
                  },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Notification list */}
        {loading ? (
          <ActivityIndicator style={styles.loader} color={BrandColors.loopViolet} />
        ) : flatData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="radio-outline" size={48} color={colors.textSecondary + '60'} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No radar alerts yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary + '80' }]}>
              Alerts from your radars will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={flatData}
            renderItem={renderItem}
            keyExtractor={(item, index) => {
              if ('type' in item && item.type === 'header') return `header-${item.title}`;
              return (item as HookNotification).id;
            }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 56,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Urbanist-SemiBold',
  },
  tierBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  tierBannerText: {
    fontSize: 13,
    fontFamily: 'Urbanist-Medium',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterIcon: {
    fontSize: 14,
  },
  filterLabel: {
    fontSize: 13,
    fontFamily: 'Urbanist-Medium',
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: 'Urbanist-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: 8,
    borderRadius: BorderRadius.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 15,
    fontFamily: 'Urbanist-SemiBold',
  },
  notifBody: {
    fontSize: 13,
    fontFamily: 'Urbanist-Regular',
    marginTop: 2,
  },
  notifTime: {
    fontSize: 12,
    fontFamily: 'Urbanist-Regular',
    marginTop: 4,
  },
  loader: {
    marginTop: 60,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Urbanist-SemiBold',
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
  },
});
