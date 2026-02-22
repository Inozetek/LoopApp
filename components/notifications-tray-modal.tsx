/**
 * Notifications Tray Modal
 *
 * Right-side AnimatedDrawer showing all user notifications
 * Grouped by time: Today, Yesterday, Earlier
 *
 * UX REDESIGN (v2.0):
 * - Replaced horizontal scrolling categories with vertical filter chips
 * - Grok-style right-side drawer with glass blur + swipe-right to close
 * - 92% width for reading comfort
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors, Shadows } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import {
  fetchDashboardNotifications,
  dismissNotification,
  markNotificationActioned,
  markAllNotificationsRead,
} from '@/services/dashboard-aggregator';
import type { DashboardNotification } from '@/types/dashboard';
import { AnimatedDrawer } from '@/components/animated-drawer';

// Notification filter categories
type NotificationFilter = 'all' | 'recommendations' | 'social' | 'reminders';

const NOTIFICATION_FILTERS: { id: NotificationFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'recommendations', label: 'For You', icon: 'sparkles-outline' },
  { id: 'social', label: 'Social', icon: 'people-outline' },
  { id: 'reminders', label: 'Reminders', icon: 'alarm-outline' },
];

interface NotificationsTrayModalProps {
  visible: boolean;
  onClose: () => void;
  onFeedbackRequest?: (data: {
    eventId: string;
    activityId: string | null;
    activityName: string;
    activityCategory: string;
    completedAt: string;
    place?: { id: string; name: string; address?: string };
  }) => void;
}

export function NotificationsTrayModal({ visible, onClose, onFeedbackRequest }: NotificationsTrayModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');

  // Filter notifications based on active filter
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;

    return notifications.filter(n => {
      switch (activeFilter) {
        case 'recommendations':
          return ['new_recommendations', 'featured_venue', 'featured_movie', 'lunch_suggestion', 'high_match', 'radar_alert'].includes(n.notification_type);
        case 'social':
          return ['friend_activity', 'pending_invite', 'family_in_town', 'activity_share', 'activity_invite', 'friend_request', 'comment_reply'].includes(n.notification_type);
        case 'reminders':
          return ['loops_planned', 'event_reminder', 'feedback_reminder', 'loop_score_milestone'].includes(n.notification_type);
        default:
          return true;
      }
    });
  }, [notifications, activeFilter]);

  // Fetch notifications when modal opens
  useEffect(() => {
    if (visible && user) {
      loadNotifications();
    }
  }, [visible, user]);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await fetchDashboardNotifications(user.id);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [user]);

  const handleDismiss = async (notificationId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Feedback reminder notifications are synthetic (not in DB), just remove locally
      if (!notificationId.startsWith('feedback-')) {
        await dismissNotification(notificationId);
      }
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const handleAction = async (notification: DashboardNotification) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Handle feedback reminder notifications (synthetic, not in DB)
      if (notification.notification_type === 'feedback_reminder') {
        if (onFeedbackRequest && notification.data) {
          onFeedbackRequest({
            eventId: notification.data.eventId,
            activityId: notification.data.activityId,
            activityName: notification.data.activityName,
            activityCategory: notification.data.activityCategory,
            completedAt: notification.data.completedAt,
            place: notification.data.place,
          });
          // Remove from local list immediately
          setNotifications(prev => prev.filter(n => n.id !== notification.id));
          onClose();
        }
        return;
      }

      await markNotificationActioned(notification.id);

      // Handle deep link if present
      if (notification.action_deep_link) {
        const link = notification.action_deep_link;

        // Handle pending invite deep links with highlightPlanId param
        if (notification.notification_type === 'pending_invite' && notification.related_plan_id) {
          onClose();
          // Navigate to feed with params to scroll to the card
          router.push({
            pathname: '/(tabs)',
            params: {
              highlightPlanId: notification.related_plan_id,
              scrollToCard: 'true',
            },
          });
        } else if (link.startsWith('/') || link.startsWith('(')) {
          // Internal route - use expo-router
          onClose();
          router.push(link as any);
        } else if (link.startsWith('http://') || link.startsWith('https://')) {
          // External URL
          onClose();
          Linking.openURL(link);
        }
      } else if (notification.notification_type === 'pending_invite' && notification.related_plan_id) {
        // Fallback for pending_invite without explicit deep link
        onClose();
        router.push({
          pathname: '/(tabs)',
          params: {
            highlightPlanId: notification.related_plan_id,
            scrollToCard: 'true',
          },
        });
      }

      // Remove from list
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    } catch (error) {
      console.error('Error actioning notification:', error);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleClearAll = async () => {
    if (!user) return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Dismiss all notifications (skip DB call for synthetic feedback reminders)
      const dbNotifications = notifications.filter(n => !n.id.startsWith('feedback-'));
      await Promise.all(dbNotifications.map(n => dismissNotification(n.id)));
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  // Group notifications by time (use filtered notifications)
  const groupedNotifications = groupNotificationsByTime(filteredNotifications);

  // Handle filter change
  const handleFilterChange = useCallback((filter: NotificationFilter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilter(filter);
  }, []);

  return (
    <AnimatedDrawer
      visible={visible}
      onClose={onClose}
      side="right"
      widthPercentage={0.92}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* HEADER */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleClose} style={styles.closeButton} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>

          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Notifications
          </Text>

          {notifications.length > 0 && (
            <Pressable onPress={handleClearAll} style={styles.clearButton} hitSlop={8}>
              <Text style={[styles.clearButtonText, { color: BrandColors.loopBlue }]}>
                Clear All
              </Text>
            </Pressable>
          )}
        </View>

        {/* FILTER CHIPS */}
        {notifications.length > 0 && (
          <View style={styles.filterChipsContainer}>
            {NOTIFICATION_FILTERS.map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <Pressable
                  key={filter.id}
                  style={[
                    styles.filterChip,
                    { backgroundColor: isActive ? BrandColors.loopBlue : colors.card },
                    isActive && styles.filterChipActive,
                  ]}
                  onPress={() => handleFilterChange(filter.id)}
                >
                  <Ionicons
                    name={filter.icon as any}
                    size={14}
                    color={isActive ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: isActive ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* CONTENT */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BrandColors.loopBlue} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading notifications...
            </Text>
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name={notifications.length === 0 ? "notifications-off-outline" : "filter-outline"}
              size={64}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {notifications.length === 0 ? 'All caught up!' : 'No matching notifications'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {notifications.length === 0
                ? 'You have no new notifications'
                : `No notifications in "${NOTIFICATION_FILTERS.find(f => f.id === activeFilter)?.label}" category`}
            </Text>
            {notifications.length > 0 && (
              <Pressable
                style={[styles.resetFilterButton, { backgroundColor: BrandColors.loopBlue }]}
                onPress={() => setActiveFilter('all')}
              >
                <Text style={styles.resetFilterButtonText}>Show All</Text>
              </Pressable>
            )}
          </View>
        ) : (
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
            {groupedNotifications.today.length > 0 && (
              <NotificationSection
                title="Today"
                notifications={groupedNotifications.today}
                colors={colors}
                onDismiss={handleDismiss}
                onAction={handleAction}
              />
            )}

            {groupedNotifications.yesterday.length > 0 && (
              <NotificationSection
                title="Yesterday"
                notifications={groupedNotifications.yesterday}
                colors={colors}
                onDismiss={handleDismiss}
                onAction={handleAction}
              />
            )}

            {groupedNotifications.earlier.length > 0 && (
              <NotificationSection
                title="Earlier"
                notifications={groupedNotifications.earlier}
                colors={colors}
                onDismiss={handleDismiss}
                onAction={handleAction}
              />
            )}
          </ScrollView>
        )}
      </View>
    </AnimatedDrawer>
  );
}

// ============================================================================
// NOTIFICATION SECTION
// ============================================================================

interface NotificationSectionProps {
  title: string;
  notifications: DashboardNotification[];
  colors: any;
  onDismiss: (id: string) => void;
  onAction: (notification: DashboardNotification) => void;
}

function NotificationSection({
  title,
  notifications,
  colors,
  onDismiss,
  onAction,
}: NotificationSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {title}
      </Text>

      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          colors={colors}
          onDismiss={() => onDismiss(notification.id)}
          onAction={() => onAction(notification)}
        />
      ))}
    </View>
  );
}

// ============================================================================
// NOTIFICATION CARD
// ============================================================================

interface NotificationCardProps {
  notification: DashboardNotification;
  colors: any;
  onDismiss: () => void;
  onAction: () => void;
}

function NotificationCard({ notification, colors, onDismiss, onAction }: NotificationCardProps) {
  const priorityColor =
    notification.priority === 'urgent' ? BrandColors.error :
    notification.priority === 'attention' ? BrandColors.loopOrange :
    BrandColors.loopBlue;

  const icon = getNotificationIcon(notification.notification_type);

  return (
    <Pressable
      style={[
        styles.notificationCard,
        { backgroundColor: colors.card },
        !notification.is_read && styles.unreadCard,
        Shadows.sm,
      ]}
      onPress={onAction}
    >
      {/* Priority indicator */}
      <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />

      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: priorityColor + '20' }]}>
        <Ionicons name={icon} size={20} color={priorityColor} />
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        <Text
          style={[
            styles.notificationTitle,
            { color: colors.text },
            !notification.is_read && styles.unreadText,
          ]}
          numberOfLines={1}
        >
          {notification.title}
        </Text>

        {notification.message && (
          <Text
            style={[styles.notificationMessage, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {notification.message}
          </Text>
        )}

        <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>
          {formatNotificationTime(notification.created_at)}
        </Text>

        {notification.action_button_text && (
          <Pressable
            style={[styles.actionButton, { backgroundColor: priorityColor }]}
            onPress={onAction}
          >
            <Text style={styles.actionButtonText}>
              {notification.action_button_text}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Dismiss button */}
      <Pressable onPress={onDismiss} style={styles.dismissButton} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.textTertiary} />
      </Pressable>
    </Pressable>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function groupNotificationsByTime(notifications: DashboardNotification[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = {
    today: [] as DashboardNotification[],
    yesterday: [] as DashboardNotification[],
    earlier: [] as DashboardNotification[],
  };

  for (const notification of notifications) {
    const createdAt = new Date(notification.created_at);

    if (createdAt >= today) {
      groups.today.push(notification);
    } else if (createdAt >= yesterday) {
      groups.yesterday.push(notification);
    } else {
      groups.earlier.push(notification);
    }
  }

  return groups;
}

function getNotificationIcon(type: string): any {
  switch (type) {
    case 'loops_planned':
      return 'calendar-outline';
    case 'friend_activity':
      return 'people-outline';
    case 'new_recommendations':
      return 'sparkles-outline';
    case 'featured_venue':
      return 'star-outline';
    case 'featured_movie':
      return 'film-outline';
    case 'pending_invite':
      return 'mail-outline';
    case 'family_in_town':
      return 'home-outline';
    case 'lunch_suggestion':
      return 'restaurant-outline';
    case 'event_reminder':
      return 'alarm-outline';
    case 'activity_share':
      return 'paper-plane-outline';
    case 'activity_invite':
      return 'gift-outline';
    case 'feedback_reminder':
      return 'chatbubble-outline';
    case 'friend_request':
      return 'person-add-outline';
    case 'radar_alert':
      return 'radio-outline';
    case 'high_match':
      return 'flame-outline';
    case 'loop_score_milestone':
      return 'trophy-outline';
    case 'comment_reply':
      return 'chatbubbles-outline';
    default:
      return 'notifications-outline';
  }
}

function formatNotificationTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  clearButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // FILTER CHIPS
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  filterChipActive: {
    borderColor: 'transparent',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 16,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  resetFilterButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  resetFilterButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },

  // Section
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },

  // Notification card
  notificationCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: BrandColors.loopBlue,
  },
  priorityBar: {
    width: 3,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
    marginTop: Spacing.md,
  },
  contentContainer: {
    flex: 1,
    padding: Spacing.md,
    gap: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  unreadText: {
    fontWeight: '700',
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    marginTop: 4,
  },
  actionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dismissButton: {
    padding: Spacing.md,
    alignSelf: 'flex-start',
  },
});
