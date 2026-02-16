/**
 * Daily Dashboard Modal
 * "What's happening around you today" - Stats and Loop map view
 *
 * Custom animated bottom sheet (matching see-details-modal pattern):
 * - Spring slide-up + fade backdrop
 * - DragHandle overlay at top for swipe-down dismiss
 * - Floating chevron-down FAB at bottom-right
 * - No ugly close-circle button
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LoopMapView } from '@/components/loop-map-view';
import { DiscoveryModeToggle, type DiscoveryMode } from '@/components/discovery-mode-toggle';
import { CategorySelector } from '@/components/category-selector';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors, Shadows } from '@/constants/brand';
import type { DashboardData, DashboardView, DashboardNotification } from '@/types/dashboard';
import { fetchDashboardData, markDashboardViewed, dismissNotification } from '@/services/dashboard-aggregator';
import { useAuth } from '@/contexts/auth-context';
import type { FeedFilters } from '@/components/feed-filters';
import { DragHandle } from '@/components/drag-handle';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DailyDashboardModalProps {
  visible: boolean;
  onClose: () => void;
  isFirstLoadToday?: boolean;

  // Discovery controls
  discoveryMode?: DiscoveryMode;
  onDiscoveryModeChange?: (mode: DiscoveryMode) => void;
  selectedCategories?: string[];
  onCategoriesChange?: (categories: string[]) => void;

  // Filter controls
  filters?: FeedFilters;
  onClearAllFilters?: () => void;
}

export function DailyDashboardModal({
  visible,
  onClose,
  isFirstLoadToday = false,
  discoveryMode = 'for_you',
  onDiscoveryModeChange,
  selectedCategories = [],
  onCategoriesChange,
  filters,
  onClearAllFilters,
}: DailyDashboardModalProps) {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const [currentView, setCurrentView] = useState<DashboardView>('stats');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Animation values
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fetch dashboard data when modal opens
  useEffect(() => {
    if (visible && user) {
      loadDashboardData();
    }
  }, [visible, user]);

  // Open/close animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

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
      console.error('Error loading dashboard:', error);
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
      console.error('Error dismissing notification:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
    >
      {/* Fade backdrop - tap to close */}
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sliding panel */}
      <Animated.View
        style={[
          styles.modalContainer,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          {/* DragHandle overlay at top */}
          <View style={styles.dragHandleOverlay}>
            <DragHandle onClose={handleClose} />
          </View>

          {/* HEADER - centered title only */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, Typography.headlineMedium, { color: colors.text }]}>
              {isFirstLoadToday ? "What's happening today" : 'Your Dashboard'}
            </Text>
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
                Map
              </Text>
            </Pressable>

            {/* Controls tab removed — filters now consolidated in AdvancedSearchModal */}
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

              {/* ControlsView removed — filters now consolidated in AdvancedSearchModal */}
            </>
          )}

          {/* Floating dismiss FAB */}
          <Pressable
            style={[
              styles.dismissFab,
              {
                backgroundColor: colors.card,
                borderColor: 'rgba(0,0,0,0.08)',
              },
            ]}
            onPress={handleClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </Animated.View>
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
  const { stats, notifications, today_tasks } = data;

  // Get the next upcoming task
  const nextTask = today_tasks?.find((task) => {
    const taskTime = new Date(task.start_time);
    return taskTime > new Date();
  }) || today_tasks?.[0];

  // Format time until next task
  const getTimeUntilTask = (taskTime: string) => {
    const now = new Date();
    const task = new Date(taskTime);
    const diffMs = task.getTime() - now.getTime();

    if (diffMs < 0) return 'Now';

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `in ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `in ${diffHours}h`;

    return task.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* WELCOME BACK + NEXT TASK */}
      <View style={[styles.welcomeCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.welcomeTitle, { color: colors.text }]}>
          Welcome back
        </Text>

        {nextTask ? (
          <View style={styles.nextTaskContainer}>
            <Text style={[styles.nextTaskLabel, { color: colors.textSecondary }]}>
              Up next:
            </Text>
            <View style={[styles.nextTaskCard, { backgroundColor: colors.cardBackground, borderColor: BrandColors.strongMatchGlow }]}>
              <View style={styles.nextTaskInfo}>
                <Text style={[styles.nextTaskName, { color: colors.text }]} numberOfLines={1}>
                  {nextTask.title}
                </Text>
                {nextTask.address && (
                  <Text style={[styles.nextTaskLocation, { color: colors.textSecondary }]} numberOfLines={1}>
                    {nextTask.address}
                  </Text>
                )}
                <Text style={[styles.nextTaskTime, { color: BrandColors.loopBlue }]}>
                  {getTimeUntilTask(nextTask.start_time)}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
            </View>
          </View>
        ) : (
          <Text style={[styles.noTasksText, { color: colors.textSecondary }]}>
            Nothing in your Loop today. Explore recommendations below!
          </Text>
        )}
      </View>

      {/* LOOPS PLANNED THIS WEEK */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="calendar" size={20} color={BrandColors.loopBlue} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Loops planned this week
          </Text>
        </View>
        <Text style={[styles.sectionValue, { color: colors.text }]}>
          {stats.loops_planned_count || 0}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          {stats.loops_summary?.total_stops
            ? `${stats.loops_summary.total_stops} total stops`
            : 'No loops planned yet'}
        </Text>
      </View>

      {/* TASKS IN TODAY'S LOOP */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="list.bullet" size={20} color={BrandColors.loopBlue} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Today&apos;s Loop
          </Text>
        </View>
        {today_tasks && today_tasks.length > 0 ? (
          <View style={styles.tasksList}>
            {today_tasks.slice(0, 5).map((task, index) => (
              <View key={task.id || index} style={[styles.taskItem, { borderBottomColor: colors.border }]}>
                <View style={[styles.taskDot, { backgroundColor: BrandColors.loopBlue }]} />
                <View style={styles.taskItemContent}>
                  <Text style={[styles.taskItemName, { color: colors.text }]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Text style={[styles.taskItemTime, { color: colors.textSecondary }]}>
                    {new Date(task.start_time).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                </View>
              </View>
            ))}
            {today_tasks.length > 5 && (
              <Text style={[styles.moreTasksText, { color: colors.textSecondary }]}>
                +{today_tasks.length - 5} more
              </Text>
            )}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Nothing planned today
          </Text>
        )}
      </View>

      {/* NEW RECOMMENDATIONS */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="sparkles" size={20} color={BrandColors.loopBlue} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            New recommendations
          </Text>
        </View>
        <Text style={[styles.sectionValue, { color: colors.text }]}>
          {stats.new_recommendations_count || 0}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          AI-personalized suggestions for you
        </Text>
      </View>

      {/* GROUP RECOMMENDATIONS / FRIEND REQUESTS */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="person.2.fill" size={20} color={BrandColors.loopBlue} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Group recommendations
          </Text>
        </View>
        {stats.pending_invites_count > 0 ? (
          <>
            <Text style={[styles.sectionValue, { color: colors.text }]}>
              {stats.pending_invites_count}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Friend invites waiting
            </Text>
          </>
        ) : stats.friends_activity && stats.friends_activity.length > 0 ? (
          <View style={styles.friendsList}>
            {stats.friends_activity.slice(0, 3).map((activity, index) => (
              <View key={activity.id || index} style={styles.friendItem}>
                <View style={[styles.friendAvatar, { backgroundColor: colors.cardBackground }]}>
                  <Text style={styles.friendAvatarText}>
                    {activity.friend_name?.charAt(0) || '?'}
                  </Text>
                </View>
                <Text style={[styles.friendItemText, { color: colors.text }]} numberOfLines={1}>
                  {activity.friend_name} {activity.event_title ? `at ${activity.event_title}` : 'is active'}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No group activity yet
          </Text>
        )}
      </View>

      {/* NOTIFICATIONS (if any) */}
      {notifications.length > 0 && (
        <View style={styles.notificationsSection}>
          <Text style={[styles.sectionTitle, Typography.titleLarge, { color: colors.text, marginBottom: Spacing.md }]}>
            Notifications
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
          Add stops to see your Loop
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
// CONTROLS VIEW COMPONENT
// ============================================================================

interface ControlsViewProps {
  discoveryMode: DiscoveryMode;
  onDiscoveryModeChange?: (mode: DiscoveryMode) => void;
  selectedCategories: string[];
  onCategoriesChange?: (categories: string[]) => void;
  filters?: FeedFilters;
  onClearAllFilters?: () => void;
  colors: any;
}

function ControlsView({
  discoveryMode,
  onDiscoveryModeChange,
  selectedCategories,
  onCategoriesChange,
  filters,
  onClearAllFilters,
  colors,
}: ControlsViewProps) {
  const hasActiveFilters =
    (filters?.timeOfDay && filters.timeOfDay !== 'any') ||
    (filters?.maxDistance && filters.maxDistance < 100) ||
    (filters?.priceRange && filters.priceRange !== 'any') ||
    selectedCategories.length > 0;

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADING */}
      <Text style={[styles.greeting, Typography.headlineLarge, { color: colors.text }]}>
        Feed Controls
      </Text>
      <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginBottom: Spacing.xl }]}>
        Customize your recommendation feed with discovery mode and filters
      </Text>

      {/* DISCOVERY MODE TOGGLE */}
      {onDiscoveryModeChange && (
        <DiscoveryModeToggle
          mode={discoveryMode}
          onModeChange={onDiscoveryModeChange}
        />
      )}

      {/* CATEGORY SELECTOR */}
      {onCategoriesChange && (
        <CategorySelector
          selectedCategories={selectedCategories}
          onCategoriesChange={onCategoriesChange}
          mode="multi"
        />
      )}

      {/* ACTIVE FILTERS SUMMARY */}
      <View style={styles.activeFiltersSection}>
        <Text style={[Typography.titleMedium, { color: colors.text, marginBottom: Spacing.md }]}>
          Active Filters
        </Text>

        {!hasActiveFilters ? (
          <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
            No filters applied
          </Text>
        ) : (
          <>
            <View style={styles.filterChipsContainer}>
              {filters?.timeOfDay && filters.timeOfDay !== 'any' && (
                <View style={[styles.filterChip, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <Text style={[Typography.labelSmall, { color: colors.text }]}>
                    Time: {filters.timeOfDay}
                  </Text>
                </View>
              )}

              {filters?.maxDistance && filters.maxDistance < 100 && (
                <View style={[styles.filterChip, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <Text style={[Typography.labelSmall, { color: colors.text }]}>
                    Distance: {filters.maxDistance} mi
                  </Text>
                </View>
              )}

              {filters?.priceRange && filters.priceRange !== 'any' && (
                <View style={[styles.filterChip, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <Text style={[Typography.labelSmall, { color: colors.text }]}>
                    Price: {'$'.repeat(typeof filters.priceRange === 'number' ? filters.priceRange : 1)}
                  </Text>
                </View>
              )}

              {selectedCategories.length > 0 && (
                <View style={[styles.filterChip, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <Text style={[Typography.labelSmall, { color: colors.text }]}>
                    {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'}
                  </Text>
                </View>
              )}
            </View>

            {onClearAllFilters && (
              <Pressable
                style={[styles.clearAllButton, { backgroundColor: BrandColors.error }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onClearAllFilters();
                }}
              >
                <Text style={[Typography.labelLarge, { color: '#FFFFFF' }]}>
                  Clear All Filters
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </ScrollView>
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
    notification.priority === 'urgent' ? BrandColors.like :
    notification.priority === 'attention' ? BrandColors.loopOrange :
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
  // Modal overlay + container (custom animated bottom sheet)
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  modal: {
    height: SCREEN_HEIGHT,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  dragHandleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingTop: Spacing.xl + 12, // Room for drag handle
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontWeight: '700',
  },

  // Floating dismiss FAB
  dismissFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
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
    paddingBottom: Spacing.xl * 2 + 44, // Extra space for FAB
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

  // Active Filters Section
  activeFiltersSection: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: BorderRadius.lg,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  clearAllButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },

  // Welcome Card
  welcomeCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  nextTaskContainer: {
    marginTop: Spacing.sm,
  },
  nextTaskLabel: {
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  nextTaskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  nextTaskInfo: {
    flex: 1,
    gap: 4,
  },
  nextTaskName: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextTaskLocation: {
    fontSize: 13,
  },
  nextTaskTime: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  noTasksText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Section Containers
  sectionContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionValue: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
  },

  // Tasks List
  tasksList: {
    marginTop: Spacing.sm,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  taskItemContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskItemName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: Spacing.sm,
  },
  taskItemTime: {
    fontSize: 13,
  },
  moreTasksText: {
    fontSize: 13,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },

  // Friends List
  friendsList: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  friendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  friendItemText: {
    fontSize: 14,
    flex: 1,
  },
});
