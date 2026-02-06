/**
 * Notifications Tray Modal
 *
 * Full-screen notification center showing all user notifications
 * Grouped by time: Today, Yesterday, Earlier
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
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

interface NotificationsTrayModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationsTrayModal({ visible, onClose }: NotificationsTrayModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      console.error('❌ Error loading notifications:', error);
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
      await dismissNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('❌ Error dismissing notification:', error);
    }
  };

  const handleAction = async (notification: DashboardNotification) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await markNotificationActioned(notification.id);

      // Handle deep link if present
      if (notification.action_deep_link) {
        const link = notification.action_deep_link;
        if (link.startsWith('/') || link.startsWith('(')) {
          // Internal route - use expo-router
          onClose();
          router.push(link as any);
        } else if (link.startsWith('http://') || link.startsWith('https://')) {
          // External URL
          onClose();
          Linking.openURL(link);
        }
      }

      // Remove from list
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    } catch (error) {
      console.error('❌ Error actioning notification:', error);
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
      // Dismiss all notifications
      await Promise.all(notifications.map(n => dismissNotification(n.id)));
      setNotifications([]);
    } catch (error) {
      console.error('❌ Error clearing notifications:', error);
    }
  };

  // Group notifications by time
  const groupedNotifications = groupNotificationsByTime(notifications);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
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

        {/* CONTENT */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BrandColors.loopBlue} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading notifications...
            </Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              All caught up!
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              You have no new notifications
            </Text>
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
    </Modal>
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
    paddingTop: Spacing.xl + 20, // Safe area
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
