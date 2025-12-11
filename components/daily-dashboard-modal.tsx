/**
 * Daily Dashboard Modal
 * "What's happening around you today" - Stats and Loop map view
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LoopMapView } from '@/components/loop-map-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors, Shadows } from '@/constants/brand';
import type { DashboardData, DashboardView, DashboardNotification } from '@/types/dashboard';
import { fetchDashboardData, markDashboardViewed, dismissNotification } from '@/services/dashboard-aggregator';
import { useAuth } from '@/contexts/auth-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DailyDashboardModalProps {
  visible: boolean;
  onClose: () => void;
  isFirstLoadToday?: boolean;
}

export function DailyDashboardModal({ visible, onClose, isFirstLoadToday = false }: DailyDashboardModalProps) {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const [currentView, setCurrentView] = useState<DashboardView>('stats');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch dashboard data when modal opens
  useEffect(() => {
    if (visible && user) {
      loadDashboardData();
    }
  }, [visible, user]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const dashboardData = await fetchDashboardData(user.id);
      setData(dashboardData);

      // Mark as viewed if first load today
      if (isFirstLoadToday) {
        await markDashboardViewed(user.id);
      }
    } catch (error) {
      console.error('❌ Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleViewToggle = (view: DashboardView) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentView(view);
  };

  const handleDismissNotification = async (notificationId: string) => {
    try {
      await dismissNotification(notificationId);
      // Reload data to refresh UI
      await loadDashboardData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('❌ Error dismissing notification:', error);
    }
  };

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
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            hitSlop={8}
          >
            <IconSymbol name="xmark" size={24} color={colors.text} />
          </Pressable>

          <Text style={[styles.headerTitle, Typography.headlineMedium, { color: colors.text }]}>
            {isFirstLoadToday ? "What's happening today" : 'Your Dashboard'}
          </Text>

          <View style={styles.closeButton} />
        </View>

        {/* VIEW TOGGLE */}
        <View style={styles.viewToggleContainer}>
          <Pressable
            onPress={() => handleViewToggle('stats')}
            style={[
              styles.viewToggleButton,
              currentView === 'stats' && styles.viewToggleButtonActive,
              { backgroundColor: currentView === 'stats' ? BrandColors.loopBlue : 'transparent' },
            ]}
          >
            <Text
              style={[
                styles.viewToggleText,
                { color: currentView === 'stats' ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              Stats
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleViewToggle('map')}
            style={[
              styles.viewToggleButton,
              currentView === 'map' && styles.viewToggleButtonActive,
              { backgroundColor: currentView === 'map' ? BrandColors.loopBlue : 'transparent' },
            ]}
          >
            <Text
              style={[
                styles.viewToggleText,
                { color: currentView === 'map' ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              Loop Map
            </Text>
          </Pressable>
        </View>

        {/* CONTENT */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BrandColors.loopBlue} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading your day...
            </Text>
          </View>
        ) : (
          <>
            {currentView === 'stats' && data && (
              <StatsView
                data={data}
                colors={colors}
                onDismissNotification={handleDismissNotification}
              />
            )}

            {currentView === 'map' && data && (
              <MapView
                tasks={data.today_tasks}
                homeLocation={data.home_location}
                colors={colors}
              />
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

// ============================================================================
// STATS VIEW COMPONENT
// ============================================================================

interface StatsViewProps {
  data: DashboardData;
  colors: any;
  onDismissNotification: (id: string) => void;
}

function StatsView({ data, colors, onDismissNotification }: StatsViewProps) {
  const { stats, notifications } = data;

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* GREETING */}
      <Text style={[styles.greeting, Typography.headlineLarge, { color: colors.text }]}>
        What's happening around you today
      </Text>

      {/* STATS CARDS */}
      <View style={styles.statsGrid}>
        {/* Loops Planned */}
        <StatCard
          icon="calendar"
          title="Loops Planned"
          value={stats.loops_planned_count}
          subtitle={
            stats.loops_summary
              ? `${stats.loops_summary.total_stops} stops today`
              : 'No loops yet'
          }
          colors={colors}
          gradient={['#00BFFF', '#0080FF']}
        />

        {/* Friends Active */}
        <StatCard
          icon="person.2.fill"
          title="Friends on Loops"
          value={stats.friends_active_count}
          subtitle={
            stats.friends_active_count > 0
              ? `${stats.friends_active_count} embarking today`
              : 'None yet'
          }
          colors={colors}
          gradient={['#00FF9F', '#00CC7F']}
        />

        {/* New Recommendations */}
        <StatCard
          icon="sparkles"
          title="New Recommendations"
          value={stats.new_recommendations_count}
          subtitle="Intelligent suggestions"
          colors={colors}
          gradient={['#FF6B9D', '#C44569']}
        />

        {/* Pending Invites */}
        {stats.pending_invites_count > 0 && (
          <StatCard
            icon="envelope.fill"
            title="Pending Invites"
            value={stats.pending_invites_count}
            subtitle="Group activities"
            colors={colors}
            gradient={['#FFA94D', '#FF8B13']}
          />
        )}
      </View>

      {/* NOTIFICATIONS */}
      {notifications.length > 0 && (
        <View style={styles.notificationsSection}>
          <Text style={[styles.sectionTitle, Typography.titleLarge, { color: colors.text }]}>
            Activity
          </Text>

          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              colors={colors}
              onDismiss={() => onDismissNotification(notification.id)}
            />
          ))}
        </View>
      )}

      {/* FRIEND ACTIVITY */}
      {stats.friends_activity && stats.friends_activity.length > 0 && (
        <View style={styles.friendActivitySection}>
          <Text style={[styles.sectionTitle, Typography.titleLarge, { color: colors.text }]}>
            What Your Friends Are Doing
          </Text>

          {stats.friends_activity.slice(0, 5).map((activity) => (
            <FriendActivityCard
              key={activity.id}
              activity={activity}
              colors={colors}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ============================================================================
// MAP VIEW COMPONENT
// ============================================================================

interface MapViewProps {
  tasks: any[];
  homeLocation?: { latitude: number; longitude: number };
  colors: any;
}

function MapView({ tasks, homeLocation, colors }: MapViewProps) {
  if (tasks.length === 0) {
    return (
      <View style={styles.emptyMapContainer}>
        <IconSymbol name="map" size={64} color={colors.textSecondary} />
        <Text style={[styles.emptyMapText, { color: colors.textSecondary }]}>
          No loops planned for today
        </Text>
        <Text style={[styles.emptyMapSubtext, { color: colors.textTertiary }]}>
          Add tasks to your calendar to see your Loop
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <LoopMapView
        tasks={tasks}
        homeLocation={homeLocation}
      />
    </View>
  );
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  icon: any; // SF Symbol name for iOS
  title: string;
  value: number;
  subtitle: string;
  colors: any;
  gradient: [string, string];
}

function StatCard({ icon, title, value, subtitle, colors, gradient }: StatCardProps) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card }, Shadows.md]}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statCardGradient}
      >
        <IconSymbol name={icon} size={24} color="#FFFFFF" />
      </LinearGradient>

      <Text style={[styles.statCardTitle, { color: colors.textSecondary }]}>
        {title}
      </Text>

      <Text style={[styles.statCardValue, Typography.displaySmall, { color: colors.text }]}>
        {value}
      </Text>

      <Text style={[styles.statCardSubtitle, { color: colors.textTertiary }]}>
        {subtitle}
      </Text>
    </View>
  );
}

// ============================================================================
// NOTIFICATION CARD COMPONENT
// ============================================================================

interface NotificationCardProps {
  notification: DashboardNotification;
  colors: any;
  onDismiss: () => void;
}

function NotificationCard({ notification, colors, onDismiss }: NotificationCardProps) {
  const priorityColor =
    notification.priority === 'urgent' ? '#FF6B9D' :
    notification.priority === 'attention' ? '#FFA94D' :
    BrandColors.loopBlue;

  return (
    <View style={[styles.notificationCard, { backgroundColor: colors.card }, Shadows.sm]}>
      <View style={[styles.notificationPriorityBar, { backgroundColor: priorityColor }]} />

      <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, { color: colors.text }]}>
          {notification.title}
        </Text>

        {notification.message && (
          <Text style={[styles.notificationMessage, { color: colors.textSecondary }]}>
            {notification.message}
          </Text>
        )}

        {notification.action_button_text && (
          <Pressable style={[styles.notificationAction, { backgroundColor: priorityColor }]}>
            <Text style={styles.notificationActionText}>
              {notification.action_button_text}
            </Text>
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={onDismiss}
        style={styles.notificationDismiss}
        hitSlop={8}
      >
        <IconSymbol name="xmark" size={16} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

// ============================================================================
// FRIEND ACTIVITY CARD COMPONENT
// ============================================================================

interface FriendActivityCardProps {
  activity: any;
  colors: any;
}

function FriendActivityCard({ activity, colors }: FriendActivityCardProps) {
  const activityIcon =
    activity.activity_type === 'loop_started' ? 'play.circle.fill' :
    activity.activity_type === 'recommendation_accepted' ? 'checkmark.circle.fill' :
    'calendar';

  return (
    <View style={[styles.friendActivityCard, { backgroundColor: colors.card }]}>
      <IconSymbol name={activityIcon} size={20} color={BrandColors.loopBlue} />

      <View style={styles.friendActivityContent}>
        <Text style={[styles.friendActivityText, { color: colors.text }]}>
          <Text style={styles.friendActivityName}>{activity.friend_name}</Text>
          {' '}
          {activity.event_title && `is at ${activity.event_title}`}
        </Text>

        {activity.event_category && (
          <Text style={[styles.friendActivityCategory, { color: colors.textTertiary }]}>
            {activity.event_category}
          </Text>
        )}
      </View>
    </View>
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
    fontWeight: '700',
  },

  // View Toggle
  viewToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: BorderRadius.full,
    padding: 4,
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleButtonActive: {
    // Background set inline
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
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

  // Stats View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  greeting: {
    marginBottom: Spacing.lg,
    fontWeight: '700',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  statCardGradient: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  statCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statCardValue: {
    fontWeight: '800',
  },
  statCardSubtitle: {
    fontSize: 12,
  },

  // Notifications
  notificationsSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    fontWeight: '700',
  },
  notificationCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  notificationPriorityBar: {
    width: 4,
  },
  notificationContent: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  notificationAction: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  notificationActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationDismiss: {
    padding: Spacing.sm,
  },

  // Friend Activity
  friendActivitySection: {
    marginBottom: Spacing.xl,
  },
  friendActivityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  friendActivityContent: {
    flex: 1,
  },
  friendActivityText: {
    fontSize: 14,
    lineHeight: 20,
  },
  friendActivityName: {
    fontWeight: '600',
  },
  friendActivityCategory: {
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },

  // Map View
  mapContainer: {
    flex: 1,
  },
  emptyMapContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  emptyMapText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyMapSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
