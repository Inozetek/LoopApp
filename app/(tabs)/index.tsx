import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, TouchableOpacity, ActivityIndicator, Modal, SafeAreaView, Alert, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
  Extrapolate,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ActivityCardIntelligent } from '@/components/activity-card-intelligent';
import { ActivityCardSkeleton } from '@/components/skeleton-loader';
import { EmptyState } from '@/components/empty-state';
import { ToastNotification } from '@/components/toast-notification';
import { LoopHeader } from '@/components/loop-header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SchedulePlanModal } from '@/components/schedule-plan-modal';
import { SeeDetailsModal } from '@/components/see-details-modal';
import { DailyDashboardModal } from '@/components/daily-dashboard-modal';
import { NotificationsTrayModal } from '@/components/notifications-tray-modal';
import { BlockActivityModal } from '@/components/block-activity-modal';
import { ActivityFeedbackModal } from '@/components/activity-feedback-modal';
import { ConflictWarningModal } from '@/components/conflict-warning-modal';
import { FeedFiltersBar, type FeedFilters } from '@/components/feed-filters';
import { type FilterSheetFilters } from '@/components/filter-sheet';
import { MainMenuModal } from '@/components/main-menu-modal';
import { useMenuAnimation } from '@/contexts/menu-animation-context';
import { AnimatedBlurView, SUPPORTS_ANIMATED_BLUR, ANDROID_BLUR_METHOD } from '@/components/ui/animated-blur-view';
import { MENU_CONTENT_BLUR, MENU_OPEN_SPRING, GROK_SPRING, MENU_DIMENSIONS } from '@/constants/animations';
import { RecommendationHistoryModal } from '@/components/recommendation-history-modal';
import { AdvancedSearchModal, type SearchFilters } from '@/components/advanced-search-modal';
import { checkDailyLimit, type DailyLimitCheck } from '@/services/subscription-service';
import SwipeableLayout from '@/components/swipeable-layout';
import { Recommendation } from '@/types/activity';
import { generateRecommendations, type RecommendationParams } from '@/services/recommendations';
import { useAuth } from '@/contexts/auth-context';
import { useTabNotifications } from '@/contexts/tab-notifications-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BrandColors, BorderRadius, Typography } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import { getCurrentLocation } from '@/services/location-service';
import { handleError } from '@/utils/error-handler';
import { shouldShowDashboardNow, markDashboardDismissedToday } from '@/utils/dashboard-tracker';
import { getPendingFeedbackNotificationCount, fetchDashboardNotifications } from '@/services/dashboard-aggregator';
import { computeTabBadges } from '@/utils/notification-routing';
import { loadRecommendationsFromDB, saveRecommendationsToDB, clearPendingRecommendations, markAsAccepted, blockActivity } from '@/services/recommendation-persistence';
import { shouldPromptForFeedback, submitFeedback, getRecommendationIdForActivity, getPendingFeedbackActivities, getPastEventsNeedingFeedback } from '@/services/feedback-service';
import { getBatchCommentCounts } from '@/services/comments-service';
import { checkTimeConflict, canMakeItOnTime } from '@/services/calendar-service';
import { ShareBottomSheet } from '@/components/share-bottom-sheet';
import { InsightsNudge } from '@/components/insights-nudge';
import { RadarAlertCard } from '@/components/radar-alert-card';
import { INSIGHTS_LIMIT } from '@/types/subscription';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getPendingRadarAlerts,
  notificationToRadarMatch,
  markNotificationViewed,
  markNotificationDismissed,
  MAX_RADAR_CARDS_PER_SESSION,
} from '@/services/radar-service';
import type { HookNotification, RadarMatch } from '@/types/radar';
import type { HotDrop } from '@/types/hot-drop';
import { FEATURE_FLAGS } from '@/constants/feature-flags';
import { AddRadarSheet, type RadarPrefillData } from '@/components/add-radar-sheet';
import { HotDropCard } from '@/components/hot-drop-card';
import { getHotDropsForFeed, claimHotDrop, HOT_DROP_FEED_POSITION } from '@/services/hot-drop-service';
import { UpgradePromptModal } from '@/components/upgrade-prompt-modal';
import type { GatedFeature } from '@/utils/tier-gate';

// Type for lat/lng coordinates
type PlaceLocation = { lat: number; lng: number };

/** Extract lat/lng from a scored place with multiple fallbacks */
function getPlaceCoords(place: any): { lat: number; lng: number } {
  // Primary: geometry.location (Google Places standard)
  if (place.geometry?.location?.lat != null && place.geometry?.location?.lng != null) {
    return { lat: place.geometry.location.lat, lng: place.geometry.location.lng };
  }
  // Fallback: direct lat/lng from cache columns
  if (place.lat != null && place.lng != null) {
    return { lat: place.lat, lng: place.lng };
  }
  // Fallback: underscore-prefixed from cache manager
  if (place._latitude != null && place._longitude != null) {
    return { lat: place._latitude, lng: place._longitude };
  }
  // Last resort: 0,0 (map won't render but won't crash)
  return { lat: 0, lng: 0 };
}

// ============================================================================
// MOCK DATA FOR PHASE 2: Group & Friend Activity Features (Demo)
// ============================================================================

// Mock friends for friend activity display
const MOCK_FRIENDS = [
  { id: 'friend-1', name: 'Sarah Chen', avatarUrl: 'https://i.pravatar.cc/150?u=sarah' },
  { id: 'friend-2', name: 'Mike Johnson', avatarUrl: 'https://i.pravatar.cc/150?u=mike' },
  { id: 'friend-3', name: 'Emily Davis', avatarUrl: 'https://i.pravatar.cc/150?u=emily' },
  { id: 'friend-4', name: 'Alex Rivera', avatarUrl: 'https://i.pravatar.cc/150?u=alex' },
  { id: 'friend-5', name: 'Jordan Lee', avatarUrl: 'https://i.pravatar.cc/150?u=jordan' },
];

// Generate mock social data for a recommendation based on index
const getMockSocialData = (index: number, recId: string) => {
  // Every 3rd card (index 2, 5, 8...) shows friend activity
  if (index % 3 === 2) {
    const friendCount = (index % 4) + 1; // 1-4 friends
    return {
      friendActivity: {
        friendsWhoVisited: MOCK_FRIENDS.slice(0, friendCount),
        friendsWithInLoop: [],
      },
      groupPlan: undefined,
    };
  }

  // Every 4th card (index 3, 7, 11...) shows "friends have this looped"
  if (index % 4 === 3) {
    return {
      friendActivity: {
        friendsWhoVisited: [],
        friendsWithInLoop: MOCK_FRIENDS.slice(1, 3),
      },
      groupPlan: undefined,
    };
  }

  // Every 5th card (index 4, 9, 14...) is a group plan
  if (index % 5 === 4) {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + (index % 12) + 1); // 1-12 hours from now

    return {
      friendActivity: undefined,
      groupPlan: {
        planId: `plan-${recId}`,
        suggestedTime: index % 2 === 0 ? 'Fri 7pm' : 'Sat 2pm',
        deadline,
        userStatus: 'pending' as const,
        participants: [
          { id: 'friend-1', name: 'Sarah Chen', avatarUrl: 'https://i.pravatar.cc/150?u=sarah', status: 'accepted' as const, isCurrentUser: false },
          { id: 'current-user', name: 'You', avatarUrl: undefined, status: 'pending' as const, isCurrentUser: true },
          { id: 'friend-2', name: 'Mike Johnson', avatarUrl: 'https://i.pravatar.cc/150?u=mike', status: index % 3 === 0 ? 'accepted' as const : 'pending' as const, isCurrentUser: false },
        ],
      },
    };
  }

  // Every 10th card (index 9, 19...) is an accepted group plan (shows glow border)
  if (index % 10 === 9) {
    return {
      friendActivity: undefined,
      groupPlan: {
        planId: `plan-accepted-${recId}`,
        suggestedTime: 'Tomorrow 6pm',
        deadline: undefined,
        userStatus: 'accepted' as const,
        participants: [
          { id: 'current-user', name: 'You', avatarUrl: undefined, status: 'accepted' as const, isCurrentUser: true },
          { id: 'friend-1', name: 'Sarah Chen', avatarUrl: 'https://i.pravatar.cc/150?u=sarah', status: 'accepted' as const, isCurrentUser: false },
          { id: 'friend-3', name: 'Emily Davis', avatarUrl: 'https://i.pravatar.cc/150?u=emily', status: 'pending' as const, isCurrentUser: false },
        ],
      },
    };
  }

  // Regular cards - no social data
  return {
    friendActivity: undefined,
    groupPlan: undefined,
  };
};

// Type for user preferences (from Supabase Json type)
type UserPreferences = {
  budget?: number;
  max_distance_miles?: number;
  preferred_times?: string[];
  notification_enabled?: boolean;
  last_search_radius?: number;
  [key: string]: any; // Allow other properties
};

// UI Configuration: Set to false to use spinner instead of shimmer for pull-to-refresh
const USE_SHIMMER_FOR_REFRESH = true;

// Memoized FeedList component to prevent re-renders from parent state changes
interface FeedListProps {
  data: Recommendation[];
  renderItem: any;
  flatListRef: any;
  handleScroll: any;
  onScrollBeginDrag: () => void;
  onScrollEndDrag: () => void;
  onViewableItemsChanged: any;
  viewabilityConfig: any;
  feedStyle: any;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void; // Load more when scrolling near bottom
  loadingMore: boolean; // Show loading indicator at bottom
  feedExhausted: boolean; // No more recommendations available
  searchRadius: number; // Current search radius for informative messages
  extraData: any; // Force re-render when this changes
  useShimmer: boolean; // Use shimmer instead of spinner
  filters: FeedFilters; // Current filter state (Phase 1.5)
  onExpandDistance: () => void; // Expand distance filter by 10mi (Phase 1.5)
  onRemoveDistanceFilter: () => void; // Remove distance filter (Phase 1.5)
}

const FeedList = memo(
  ({
    data,
    renderItem,
    flatListRef,
    handleScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onViewableItemsChanged,
    viewabilityConfig,
    feedStyle,
    refreshing,
    onRefresh,
    onEndReached,
    loadingMore,
    feedExhausted,
    searchRadius,
    extraData,
    useShimmer,
    filters,
    onExpandDistance,
    onRemoveDistanceFilter,
  }: FeedListProps) => {
    const colorScheme = useColorScheme();
    const colors = ThemeColors[colorScheme ?? 'light'];

    return (
      <Animated.FlatList
        ref={flatListRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        extraData={extraData}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews={false}
        maxToRenderPerBatch={15}
        windowSize={21}
        initialNumToRender={35}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5} // Trigger only near actual bottom for intentional loading moments
        ListHeaderComponent={(refreshing && useShimmer) ? (
          <>
            <ActivityCardSkeleton />
            <ActivityCardSkeleton />
            <ActivityCardSkeleton />
          </>
        ) : null}
        ListFooterComponent={
          feedExhausted ? (
            filters.maxDistance && filters.maxDistance < 100 ? (
              <View style={styles.exhaustionCard}>
                <Ionicons name="location-outline" size={48} color={colors.textSecondary} />
                <Text style={[Typography.headlineSmall, { color: colors.text, marginTop: Spacing.md }]}>
                  You&apos;ve seen all activities within {filters.maxDistance} miles
                </Text>
                <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                  Try expanding your search or adjusting filters to discover more
                </Text>

                <View style={styles.exhaustionActions}>
                  <TouchableOpacity
                    style={[styles.exhaustionButton, { backgroundColor: BrandColors.loopBlue }]}
                    onPress={onRemoveDistanceFilter}
                  >
                    <Text style={[Typography.labelLarge, { color: '#FFFFFF' }]}>
                      Remove distance filter
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.exhaustionButton, { backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border }]}
                    onPress={onExpandDistance}
                  >
                    <Text style={[Typography.labelLarge, { color: colors.text }]}>
                      Expand to +10 miles
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.exhaustionCard}>
                <Ionicons name="refresh-outline" size={48} color={colors.textSecondary} />
                <Text style={[Typography.headlineSmall, { color: colors.text, marginTop: Spacing.md }]}>
                  You&apos;ve reached the end
                </Text>
                <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                  Pull down to refresh for new recommendations
                </Text>
              </View>
            )
          ) : (
            loadingMore ? (
              <View style={{ paddingTop: Spacing.lg }}>
                <ActivityCardSkeleton />
                <ActivityCardSkeleton />
                <ActivityCardSkeleton />
              </View>
            ) : null
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={useShimmer ? 'rgba(0,0,0,0)' : BrandColors.loopBlue}
            colors={useShimmer ? ['rgba(0,0,0,0)'] : [BrandColors.loopBlue]}
            progressViewOffset={120}
            title=""
            progressBackgroundColor="rgba(0,0,0,0)"
          />
        }
        style={feedStyle}
      />
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if these props change
    return prevProps.data === nextProps.data &&
           prevProps.refreshing === nextProps.refreshing &&
           prevProps.loadingMore === nextProps.loadingMore &&
           prevProps.feedExhausted === nextProps.feedExhausted &&
           prevProps.searchRadius === nextProps.searchRadius &&
           prevProps.handleScroll === nextProps.handleScroll &&
           prevProps.extraData === nextProps.extraData &&
           prevProps.useShimmer === nextProps.useShimmer &&
           prevProps.filters === nextProps.filters;
  }
);
FeedList.displayName = 'FeedList';

export default function RecommendationFeedScreen() {
  const { user } = useAuth();
  const { setHasNewRecommendations, applyBadges } = useTabNotifications();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  // Menu animation: blur + scale main content when drawer opens
  const { menuProgress } = useMenuAnimation();

  const menuContentStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(menuProgress.value, [0, 1], [1, MENU_CONTENT_BLUR.contentScale], Extrapolate.CLAMP) },
      { translateX: interpolate(menuProgress.value, [0, 1], [0, MENU_CONTENT_BLUR.contentTranslateX], Extrapolate.CLAMP) },
    ],
    borderRadius: interpolate(menuProgress.value, [0, 1], [0, MENU_CONTENT_BLUR.contentBorderRadius], Extrapolate.CLAMP),
    overflow: menuProgress.value > 0.01 ? 'hidden' as const : 'visible' as const,
  }));

  const menuBlurAnimatedProps = useAnimatedProps(() => ({
    intensity: SUPPORTS_ANIMATED_BLUR
      ? interpolate(menuProgress.value, [0, 1], [0, MENU_CONTENT_BLUR.backgroundBlurIntensity], Extrapolate.CLAMP)
      : MENU_CONTENT_BLUR.backgroundBlurIntensity,
  }));

  const menuBlurOverlayStyle = useAnimatedStyle(() => ({
    opacity: SUPPORTS_ANIMATED_BLUR
      ? (menuProgress.value > 0.01 ? 1 : 0)
      : interpolate(menuProgress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
  }));

  // Deep link params for scrolling to specific cards (from notifications)
  const { highlightPlanId, scrollToCard } = useLocalSearchParams<{
    highlightPlanId?: string;
    scrollToCard?: string;
  }>();

  // Clear the recommendation badge when user visits this screen
  useEffect(() => {
    setHasNewRecommendations(false);
  }, [setHasNewRecommendations]);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // Loading more recommendations for infinite scroll
  const [feedExhausted, setFeedExhausted] = useState(false); // Track if no more recommendations available
  const [seedingCity, setSeedingCity] = useState(false); // Track if city cache is being seeded (first-time setup)
  const [cityName, setCityName] = useState<string | null>(null); // City being seeded
  const [searchRadius, setSearchRadius] = useState(10); // Track expanding search radius (miles)
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render on refresh
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsScrollToComments, setDetailsScrollToComments] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackActivity, setFeedbackActivity] = useState<{
    activityId: string;
    activityName: string;
    completedAt: string;
    recommendationId?: string;
    place?: {
      id: string;
      name: string;
      address?: string;
    };
  } | null>(null);
  const [removingCardId, setRemovingCardId] = useState<string | null>(null); // Track card being removed with animation
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);
  const [feedbackBannerDismissed, setFeedbackBannerDismissed] = useState(false);
  // Inline feedback card: first pending activity (one at a time)
  const [nextFeedbackActivity, setNextFeedbackActivity] = useState<{
    eventId: string;
    activityId: string | null;
    activityName: string;
    activityCategory: string;
    completedAt: string;
  } | null>(null);

  // Conflict warning modal state
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictType, setConflictType] = useState<'double-booking' | 'travel-time' | null>(null);
  const [conflictingTask, setConflictingTask] = useState<any>(null);
  const [travelDetails, setTravelDetails] = useState<any>(null);
  const [pendingSchedule, setPendingSchedule] = useState<{ time: Date; notes?: string } | null>(null);

  // Advanced search modal state
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [activeFilters, setActiveFilters] = useState<SearchFilters | null>(null);
  const [userLocation, setUserLocation] = useState<PlaceLocation | null>(null);

  // Dashboard state
  const [showDashboard, setShowDashboard] = useState(false);
  const [isFirstLoadToday, setIsFirstLoadToday] = useState(false);

  // Notifications tray state
  const [showNotificationsTray, setShowNotificationsTray] = useState(false);

  // Main menu modal state
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [menuGestureControlled, setMenuGestureControlled] = useState(false);

  // Edge gesture + button swipe for opening menu
  const DRAWER_WIDTH = Dimensions.get('window').width * MENU_DIMENSIONS.widthPercentage;
  const EDGE_ZONE_MENU = 30; // px from left edge to trigger menu gesture

  /** Shared handler: drive menuProgress from drag translation */
  const handleMenuDrag = useCallback((translationX: number) => {
    'worklet';
    const progress = Math.min(translationX / DRAWER_WIDTH, 1);
    menuProgress.value = Math.max(0, progress);
  }, [DRAWER_WIDTH, menuProgress]);

  /** Open the menu modal when gesture crosses threshold (called from JS) */
  const openMenuFromGesture = useCallback(() => {
    if (!showMainMenu) {
      setMenuGestureControlled(true);
      setShowMainMenu(true);
    }
  }, [showMainMenu]);

  /** Shared handler: end of drag — snap open or closed */
  const handleMenuDragEnd = useCallback((translationX: number, velocityX: number) => {
    if (translationX > 60 || velocityX > 600) {
      // Snap open
      menuProgress.value = withSpring(1, MENU_OPEN_SPRING);
      if (!showMainMenu) {
        setMenuGestureControlled(true);
        setShowMainMenu(true);
      }
    } else {
      // Snap closed
      menuProgress.value = withSpring(0, { ...GROK_SPRING, duration: 250 });
      setShowMainMenu(false);
      setMenuGestureControlled(false);
    }
  }, [showMainMenu, menuProgress, DRAWER_WIDTH]);

  /** JS-thread callbacks for LoopHeader onMenuDrag / onMenuDragEnd */
  const handleHeaderMenuDrag = useCallback((translationX: number) => {
    const progress = Math.min(translationX / DRAWER_WIDTH, 1);
    menuProgress.value = Math.max(0, progress);
    if (progress > 0.05 && !showMainMenu) {
      setMenuGestureControlled(true);
      setShowMainMenu(true);
    }
  }, [DRAWER_WIDTH, menuProgress, showMainMenu]);

  const handleHeaderMenuDragEnd = useCallback((translationX: number, velocityX: number) => {
    handleMenuDragEnd(translationX, velocityX);
  }, [handleMenuDragEnd]);

  /** Left-edge pan gesture for opening menu */
  const menuEdgeGesture = Gesture.Pan()
    .activeOffsetX([10, 999])
    .failOffsetY([-15, 15])
    .onBegin((event) => {
      // Only activate when touch starts in the left edge zone
      if (event.absoluteX > EDGE_ZONE_MENU) {
        // Cancel by setting a flag — we can't dynamically cancel, but onUpdate will check
      }
    })
    .onUpdate((event) => {
      if (event.absoluteX - event.translationX > EDGE_ZONE_MENU) return; // started outside edge
      const progress = Math.min(event.translationX / DRAWER_WIDTH, 1);
      menuProgress.value = Math.max(0, progress);
      if (progress > 0.05) {
        runOnJS(openMenuFromGesture)();
      }
    })
    .onEnd((event) => {
      if (event.absoluteX - event.translationX > EDGE_ZONE_MENU) return;
      runOnJS(handleMenuDragEnd)(event.translationX, event.velocityX);
    })
    .runOnJS(false);

  // Reset gestureControlled when menu closes
  const handleCloseMenu = useCallback(() => {
    setShowMainMenu(false);
    setMenuGestureControlled(false);
  }, []);

  // Filters state
  const [filters, setFilters] = useState<FeedFilters>({
    timeOfDay: 'any',
    maxDistance: 100, // Any distance
    priceRange: 'any',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Filter sheet state (managed by AdvancedSearchModal)
  const [filterSheetFilters, setFilterSheetFilters] = useState<FilterSheetFilters>({
    mode: 'for_you', // Default to For You mode
    categories: [],
    maxDistance: 100,
    priceRange: 'any',
    minRating: 0,
    timeOfDay: 'any',
  });

  // History modal state
  const [showHistory, setShowHistory] = useState(false);

  // Share sheet state
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [shareRecommendation, setShareRecommendation] = useState<Recommendation | null>(null);


  // Fetch real comment counts for recommendations (background, non-blocking)
  const commentCountsFetched = useRef(new Set<string>());
  useEffect(() => {
    if (recommendations.length === 0) return;

    const fetchCommentCounts = async () => {
      try {
        // Only fetch for items we haven't fetched yet
        const newPlaceIds = recommendations
          .map(r => r.activity?.googlePlaceId)
          .filter((id): id is string => !!id && !commentCountsFetched.current.has(id));
        if (newPlaceIds.length === 0) return;

        // Mark as fetched immediately to prevent duplicate requests
        newPlaceIds.forEach(id => commentCountsFetched.current.add(id));

        const countMap = await getBatchCommentCounts(newPlaceIds);

        setRecommendations(prev => prev.map(r => {
          const placeId = r.activity?.googlePlaceId;
          if (placeId && countMap.has(placeId)) {
            return { ...r, commentsCount: countMap.get(placeId)! };
          }
          return r;
        }));
      } catch (error) {
        // Non-critical — 0 will show as fallback
      }
    };

    fetchCommentCounts();
  }, [recommendations.length]);

  // Check if any filter sheet filters are active (for icon rotation animation)
  const isFilterSheetActive = useMemo(() => {
    return (
      filterSheetFilters.categories.length > 0 ||
      filterSheetFilters.maxDistance < 100 ||
      filterSheetFilters.priceRange !== 'any' ||
      filterSheetFilters.minRating > 0 ||
      filterSheetFilters.timeOfDay !== 'any'
    );
  }, [filterSheetFilters]);

  const [isFirstCardVisible, setIsFirstCardVisible] = useState(true);
  const [collapsingFilters, setCollapsingFilters] = useState(false);

  // Category filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Daily limit state for subscription-based limits
  const [dailyLimitInfo, setDailyLimitInfo] = useState<DailyLimitCheck | null>(null);

  // Upgrade card dismissal (per-session)
  const [upgradeDismissed, setUpgradeDismissed] = useState(false);

  // Upgrade prompt modal state (for tier gating)
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [upgradeModalFeature, setUpgradeModalFeature] = useState<GatedFeature>('daily_recommendations');

  // Radar alerts state
  const [radarAlerts, setRadarAlerts] = useState<HookNotification[]>([]);
  const radarAlertsFetched = useRef(false);

  // Add to Radar sheet state (from card action menu)
  const [showRadarSheet, setShowRadarSheet] = useState(false);
  const [radarPrefill, setRadarPrefill] = useState<RadarPrefillData | undefined>(undefined);

  // Hot drops state
  const [hotDrops, setHotDrops] = useState<HotDrop[]>([]);
  const hotDropsFetched = useRef(false);

  // Animated value for filters height
  const filtersHeight = useSharedValue(0);
  const gestureTranslationY = useSharedValue(0);

  const scrollY = useSharedValue(0);

  // Welcome message animation
  const welcomeOpacity = useSharedValue(0);
  const welcomeHeight = useSharedValue(0); // Start with 0 height
  const feedOpacity = useSharedValue(1); // Feed always visible
  const flatListRef = useRef<FlatList>(null);
  const previousScrollOffset = useRef<number>(0);
  const lockedScrollPosition = useRef<number>(0); // Lock scroll during filter collapse
  const hasShownWelcome = useRef<boolean>(false); // Track if welcome message already shown this session
  const enableRefreshTimeout = useRef<NodeJS.Timeout | null>(null);
  const isActivelyDragging = useRef<boolean>(false); // Track if user's finger is on screen (not momentum)
  const isLoadingMoreRef = useRef<boolean>(false); // Track infinite scroll loading state synchronously
  const lastLoadMoreTime = useRef<number>(0); // Timestamp of last load more call (cooldown)
  const searchRadiusRef = useRef<number>(10); // Track current search radius synchronously for infinite scroll
  const feedExhaustedRef = useRef<boolean>(false); // Track if feed is exhausted synchronously
  const locationUpdatedThisSession = useRef<boolean>(false); // Throttle location updates to once per session

  // Viewability config for tracking first card
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80, // First card must be at least 80% visible
    minimumViewTime: 0,
  });

  // Track which items are visible
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const firstCardVisible = viewableItems.some((item: any) => item.index === 0);
    setIsFirstCardVisible(firstCardVisible);
    console.log('👁️ First card visible:', firstCardVisible, 'viewableItems:', viewableItems.map((i: any) => i.index));
  });

  // Load saved search radius on mount (Phase 1.4: Radius Persistence)
  useEffect(() => {
    const loadSavedRadius = async () => {
      if (!user) return;

      const prefs = user.preferences as UserPreferences;
      const savedRadius = prefs?.last_search_radius;
      if (savedRadius && savedRadius > 10) {
        console.log(`📍 Restoring saved search radius: ${savedRadius} miles`);
        searchRadiusRef.current = savedRadius;
        setSearchRadius(savedRadius);
      }
    };
    loadSavedRadius();
  }, [user]);

  // Handle deep link scroll to card (from notifications)
  useEffect(() => {
    if (!highlightPlanId || scrollToCard !== 'true' || recommendations.length === 0) return;

    // Find the index of the card with matching plan ID
    const cardIndex = recommendations.findIndex(
      (rec: Recommendation) => {
        // Check if this recommendation has a group plan with matching ID
        const socialData = getMockSocialData(recommendations.indexOf(rec), rec.id);
        return socialData.groupPlan?.planId === highlightPlanId;
      }
    );

    if (cardIndex >= 0) {
      console.log(`📍 Deep link: Scrolling to card index ${cardIndex} (plan: ${highlightPlanId})`);

      // Small delay to ensure FlatList is ready
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: cardIndex,
          animated: true,
          viewPosition: 0.1, // Position near top of viewport
        });
      }, 300);

      // Clear params after scrolling (using router.setParams)
      router.setParams({ highlightPlanId: undefined, scrollToCard: undefined });
    }
  }, [highlightPlanId, scrollToCard, recommendations, router]);

  // Check daily limit for subscription-based limits (Daily tab)
  useEffect(() => {
    const loadDailyLimit = async () => {
      if (!user) {
        setDailyLimitInfo(null);
        return;
      }

      try {
        const limitInfo = await checkDailyLimit(user.id);
        setDailyLimitInfo(limitInfo);
        console.log(`📊 Daily limit: ${limitInfo.viewedToday}/${limitInfo.dailyLimit} (${limitInfo.subscriptionTier} tier)`);
      } catch (error) {
        console.error('❌ Error checking daily limit:', error);
      }
    };
    loadDailyLimit();
  }, [user]);

  // Save radius changes to user preferences (Phase 1.4: Radius Persistence)
  useEffect(() => {
    const saveRadius = async () => {
      if (!user || searchRadius <= 10) return;

      try {
        const prefs = (user.preferences as UserPreferences) || {};
        await supabase
          .from('users')
          .update({
            preferences: {
              ...prefs,
              last_search_radius: searchRadius
            }
          })
          .eq('id', user.id);
        console.log(`💾 Saved search radius: ${searchRadius} miles`);
      } catch (error) {
        console.error('❌ Error saving search radius:', error);
      }
    };

    // Debounce: Only save after 2 seconds of no changes
    const timer = setTimeout(saveRadius, 2000);
    return () => clearTimeout(timer);
  }, [searchRadius, user]);

  // Filter recommendations based on user filters
  // Memoize filtered recommendations to prevent recalculation on every render
  const filteredRecommendations = useMemo(() => {
    let filtered = recommendations.filter((rec) => {
      // Filter by distance
      if (filters.maxDistance < 100) {
        const distanceValue = parseFloat(rec.distance.replace(' mi', ''));
        if (distanceValue > filters.maxDistance) {
          return false;
        }
      }

      // Filter by price range
      if (filters.priceRange !== 'any') {
        if (rec.priceRange !== filters.priceRange) {
          return false;
        }
      }

      // Filter by time of day (based on suggested time if available)
      if (filters.timeOfDay !== 'any' && rec.suggestedTime) {
        const hour = new Date(rec.suggestedTime).getHours();
        const timeRanges = {
          morning: [6, 12],
          afternoon: [12, 17],
          evening: [17, 21],
          night: [21, 6], // Special case: wraps around
        };

        const [start, end] = timeRanges[filters.timeOfDay];
        if (filters.timeOfDay === 'night') {
          if (hour < start && hour >= end) {
            return false;
          }
        } else {
          if (hour < start || hour >= end) {
            return false;
          }
        }
      }

      // Filter by minimum rating (from FilterSheet)
      if (filterSheetFilters.minRating > 0 && rec.rating) {
        const rating = parseFloat(rec.rating.toString());
        if (rating < filterSheetFilters.minRating) {
          return false;
        }
      }

      // Filter by categories (from FilterSheet)
      if (filterSheetFilters.categories.length > 0) {
        const recCategory = rec.category?.toLowerCase() || '';
        const matchesCategory = filterSheetFilters.categories.some(
          cat => recCategory.includes(cat.toLowerCase()) || cat.toLowerCase().includes(recCategory)
        );
        if (!matchesCategory) {
          return false;
        }
      }

      return true;
    });

    // If all cards are filtered out, show all recommendations to prevent empty feed
    if (filtered.length === 0 && recommendations.length > 0) {
      filtered = recommendations;
    }

    return filtered;
  }, [recommendations, filters, filterSheetFilters]);

  // Build blended feed: unified list with per-card showInsights flag
  // All cards look identical; free users see AI insights on first 8 only
  const blendedFeed = useMemo(() => {
    const insightsLimit = dailyLimitInfo?.insightsLimit ?? INSIGHTS_LIMIT.free;
    const subscriptionTier = dailyLimitInfo?.subscriptionTier ?? 'free';
    const isPlus = subscriptionTier === 'plus';

    const items: Recommendation[] = [];
    let sponsoredInFirstTen = 0;

    filteredRecommendations.forEach((r, i) => {
      // Enforce max 2 sponsored in first 10 cards (20% ratio)
      if (r.isSponsored && i < 10) {
        if (sponsoredInFirstTen >= 2) return; // Skip excess sponsored
        sponsoredInFirstTen++;
      }

      items.push({
        ...r,
        cardType: r.cardType || 'ai_curated' as const,
        showInsights: isPlus || i < insightsLimit,
      });
    });

    // Inject radar alert cards at the top of the feed (max 3)
    if (FEATURE_FLAGS.ENABLE_RADAR && radarAlerts.length > 0) {
      const radarCards: Recommendation[] = radarAlerts
        .slice(0, MAX_RADAR_CARDS_PER_SESSION)
        .map((alert, i) => ({
          id: `radar-alert-${alert.id}`,
          cardType: 'radar_alert' as const,
          title: alert.title,
          category: alert.eventData?.category || '',
          location: alert.eventData?.venue || '',
          distance: '',
          priceRange: 0,
          rating: 0,
          imageUrl: alert.eventData?.imageUrl || '',
          aiExplanation: '',
          isSponsored: false,
          showInsights: false,
          radarMatch: notificationToRadarMatch(alert),
          _radarNotification: alert,
        } as Recommendation & { _radarNotification: HookNotification }));

      items.splice(0, 0, ...radarCards);
    }

    // Inject hot drop cards (max 1, at position 2)
    if (FEATURE_FLAGS.ENABLE_HOT_DROPS && hotDrops.length > 0) {
      const hotDropCard: Recommendation = {
        id: `hot-drop-${hotDrops[0].id}`,
        cardType: 'hot_drop' as const,
        title: hotDrops[0].title,
        category: hotDrops[0].category,
        location: hotDrops[0].address || '',
        distance: '',
        priceRange: 0,
        rating: 0,
        imageUrl: hotDrops[0].imageUrl || '',
        aiExplanation: '',
        isSponsored: false,
        showInsights: false,
      };
      const insertPos = Math.min(HOT_DROP_FEED_POSITION, items.length);
      items.splice(insertPos, 0, hotDropCard);
    }

    // For free users: insert insights nudge after the insights limit
    if (!isPlus && items.length > insightsLimit && !upgradeDismissed) {
      const trialDaysLeft = dailyLimitInfo?.trialStatus?.expired ? 0 : undefined;
      items.splice(insightsLimit + radarAlerts.length, 0, {
        id: 'insights-nudge',
        cardType: 'insights_nudge',
        title: '',
        category: '',
        location: '',
        distance: '',
        priceRange: 0,
        rating: 0,
        imageUrl: '',
        aiExplanation: '',
        isSponsored: false,
        showInsights: false,
      } as Recommendation);
    }

    return items;
  }, [filteredRecommendations, dailyLimitInfo, upgradeDismissed, radarAlerts, hotDrops]);

  // Sync refs with state for synchronous access in callbacks (avoid stale closures)
  useEffect(() => {
    searchRadiusRef.current = searchRadius;
  }, [searchRadius]);

  useEffect(() => {
    feedExhaustedRef.current = feedExhausted;
  }, [feedExhausted]);

  // Rotating welcome messages (like Claude's loading messages)
  const welcomeMessages = [
    "Discover something great near you today",
    "Let's find your next adventure",
    "Ready to explore?",
    "Your perfect day starts here",
    "What catches your eye today?",
    "Time to make some memories",
    "Let's see what's out there",
    "Find your next favorite spot",
  ];
  const [welcomeMessage] = useState(() =>
    welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]
  );

  // Fetch recommendations
  // skipDbCache: force fresh generation
  const fetchRecommendations = async (showRefreshIndicator = false, _modeOverride?: string, skipDbCache = false) => {
    const effectiveMode = 'for_you' as const;
    console.log('🚀 fetchRecommendations called, user:', user?.id, 'skipCache:', skipDbCache);

    if (!user) {
      console.log('❌ No user, returning early');
      return;
    }

    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
        // Hide filters when refreshing
        if (showFilters) {
          console.log('🔄 Hiding filters during refresh');
          setShowFilters(false);
          filtersHeight.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) });
        }
      } else {
        setLoading(true);
      }

      // Reset search radius and exhausted flag on refresh (user wants to see fresh nearby recommendations)
      if (showRefreshIndicator) {
        console.log('🔄 Reset: Search radius reset to 10 miles (manual refresh)');
        setSearchRadius(10);
        searchRadiusRef.current = 10; // Update ref synchronously
        setFeedExhausted(false);
        feedExhaustedRef.current = false; // Update ref synchronously
      }

      console.log('🔄 Fetching recommendations...');

      // DATABASE-FIRST ARCHITECTURE: Try loading from database first
      // Skip DB cache when switching discovery modes — need fresh generation with new mode
      if (!skipDbCache) {
        console.log('📦 Loading recommendations from database...');
        const cachedRecs = await loadRecommendationsFromDB(user.id, effectiveMode);
        console.log('📦 DB returned:', cachedRecs?.length || 0, 'recommendations');

        if (cachedRecs && cachedRecs.length > 0) {
          // Use cached recommendations (daily job ensures quality)
          console.log(`✅ Loaded ${cachedRecs.length} recommendations from database`);
          setRecommendations(cachedRecs);
          setLoading(false);
          setRefreshing(false);
          return; // Always use cache if available
        }
      } else {
        console.log('⏭️ Skipping DB cache (discovery mode changed)');
      }

      // No recommendations in database - generate fresh ones (will seed city cache if needed)
      console.log('📭 No recommendations in database - generating fresh recommendations...');

      // Import generateRecommendations
      const { generateRecommendations } = await import('@/services/recommendations');
      const { detectUserCityWithFallback } = await import('@/services/city-detection');

      try {
        // Get user's current location FIRST (needed for city detection)
        const location = await getCurrentLocation();
        const currentLocation: PlaceLocation = {
          lat: location.latitude,
          lng: location.longitude,
        };

        // Update user's current_location in Supabase (once per session)
        if (!locationUpdatedThisSession.current && user.id) {
          locationUpdatedThisSession.current = true;
          supabase
            .from('users')
            .update({ current_location: `POINT(${location.longitude} ${location.latitude})` })
            .eq('id', user.id)
            .then(({ error }) => {
              if (error) console.warn('Failed to update current_location:', error.message);
            });
        }

        // Detect city for loading message using current GPS location
        const cityInfo = await detectUserCityWithFallback(user, {
          lat: location.latitude,
          lng: location.longitude
        });
        if (cityInfo) {
          console.log(`🏙️ Generating recommendations for ${cityInfo.city}, ${cityInfo.state}...`);
          setCityName(cityInfo.city);
          setSeedingCity(true); // Show "Setting up recommendations for {city}..." UI
        }

        // Get home/work locations if available
        const homeLocation = user.home_location && (user.home_location as any).coordinates
          ? { lat: (user.home_location as any).coordinates[1], lng: (user.home_location as any).coordinates[0] }
          : undefined;

        const workLocation = user.work_location && (user.work_location as any).coordinates
          ? { lat: (user.work_location as any).coordinates[1], lng: (user.work_location as any).coordinates[0] }
          : undefined;

        // Generate recommendations (will use city cache or seed if needed)
        const prefs = user.preferences as UserPreferences;
        const params: RecommendationParams = {
          user,
          userLocation: currentLocation,
          homeLocation,
          workLocation,
          maxDistance: prefs?.max_distance_miles || 10,
          maxResults: 100,
          discoveryMode: effectiveMode,
        };

        const scored = await generateRecommendations(params);
        console.log(`✅ Generated ${scored.length} fresh recommendations`);

        // Parse neighborhood from address (e.g. "123 Main St, Deep Ellum, Dallas, TX" → "Deep Ellum")
        const parseNeighborhood = (vicinity?: string, fullAddress?: string): string | undefined => {
          // Vicinity is typically "123 Main St, Neighborhood" (short form)
          const addr = fullAddress || '';
          const parts = addr.split(',').map(p => p.trim());
          // For US addresses: [street, neighborhood/city, state zip, country]
          // The second part is often neighborhood or city — skip if it matches city from 3rd part
          if (parts.length >= 3) {
            const candidate = parts[1];
            // Skip if it looks like a state abbreviation or zip or country
            if (candidate && !/^\d/.test(candidate) && candidate.length > 2 && candidate !== 'USA' && candidate !== 'US') {
              // If we have 4+ parts, parts[1] is often neighborhood (parts[2] is "City" or "State Zip")
              if (parts.length >= 4) return candidate;
            }
          }
          // Fallback: try vicinity (often "Street, Area")
          if (vicinity) {
            const vicParts = vicinity.split(',').map(p => p.trim());
            if (vicParts.length >= 2) return vicParts[vicParts.length - 1];
          }
          return undefined;
        };

        // Convert to Recommendation format
        const freshRecommendations: Recommendation[] = scored.map((s, index) => ({
          id: s.place.place_id || `rec-${index}`,
          title: s.place.name,
          category: s.category,
          location: s.place.vicinity || s.place.formatted_address || 'Unknown location',
          neighborhood: parseNeighborhood(s.place.vicinity, s.place.formatted_address),
          distance: `${s.distance.toFixed(1)} mi`,
          priceRange: s.place.price_level || 2,
          rating: s.place.rating || 0,
          imageUrl: s.photoUrl || '',
          photos: s.photoUrls,
          aiExplanation: s.aiExplanation,
          description: s.place.description,
          openNow: s.place.opening_hours?.open_now,
          isSponsored: s.isSponsored,
          score: s.score,
          businessHours: s.businessHours,
          hasEstimatedHours: s.hasEstimatedHours,
          suggestedTime: s.suggestedTime,
          event_metadata: s.place.event_metadata,
          isCurated: !!(s.place as any)?._isCurated,
          curatorName: (s.place as any)?._curatorName,
          scoreBreakdown: {
            baseScore: s.scoreBreakdown.baseScore,
            locationScore: s.scoreBreakdown.locationScore,
            timeScore: s.scoreBreakdown.timeScore,
            feedbackScore: s.scoreBreakdown.feedbackScore,
            collaborativeScore: s.scoreBreakdown.collaborativeScore,
            sponsorBoost: s.scoreBreakdown.sponsoredBoost,
            finalScore: s.scoreBreakdown.finalScore,
          },
          activity: {
            id: s.place.place_id || `act-${index}`,
            name: s.place.name,
            category: s.category,
            description: s.place.description,
            location: {
              latitude: getPlaceCoords(s.place).lat,
              longitude: getPlaceCoords(s.place).lng,
              address: s.place.vicinity || s.place.formatted_address || '',
            },
            distance: s.distance,
            rating: s.place.rating,
            reviewsCount: s.place.user_ratings_total,
            priceRange: s.place.price_level || 2,
            photoUrl: s.photoUrl,
            phone: s.place.formatted_phone_number,
            website: s.place.website,
            googlePlaceId: s.place.place_id,
          },
          groupContext: s.groupMemberMatches?.length ? {
            memberMatches: s.groupMemberMatches,
            interestMatchScore: s.scoreBreakdown.baseScore,
            farthestMemberName: s.groupMemberMatches.reduce((f, m) =>
              m.distanceMiles > f.distanceMiles ? m : f
            ).name,
            farthestMemberDistance: Math.max(...s.groupMemberMatches.map(m => m.distanceMiles)),
          } : undefined,
        }));

        // Save to database for future loads (with discovery mode tag)
        await saveRecommendationsToDB(user.id, freshRecommendations, effectiveMode);

        setRecommendations(freshRecommendations);
      } catch (error) {
        console.error('Error generating recommendations:', error);
        // Don't clear existing recommendations — keep whatever was loaded previously
        // The empty state UI will show naturally if recommendations state is still []
      } finally {
        setSeedingCity(false);
        setCityName(null);
        setLoading(false);
        setRefreshing(false);
      }
      return;

      /*
       * ============================================================================
       * API GENERATION CODE DISABLED (Database-Only Architecture)
       * ============================================================================
       *
       * The code below has been disabled as part of the database-first architecture.
       * Recommendations are now generated by a daily background job that calls:
       * scripts/generate-daily-recommendations.ts
       *
       * This runs once per day for all users, populating the recommendation_tracking
       * table. The feed screen (above) only reads from the database.
       *
       * Benefits:
       * - 80% cost reduction (APIs called 1x/day instead of per-session)
       * - Instant feed loading (database query only)
       * - Scalable to 10,000+ users with same API cost
       *
       * To re-enable API generation at runtime (not recommended):
       * Uncomment the code block below and remove early returns above.
       * ============================================================================
       */

      /* DISABLED: All API generation code below is unreachable (commented out to prevent TypeScript errors)

      // DISABLED: Log API usage summary before fetching (if API key is enabled)
      if (process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY) {
        const { logAPIUsageSummary } = await import('@/utils/api-cost-tracker');
        await logAPIUsageSummary();
      }

      // Get user's current location
      const location = await getCurrentLocation();
      const currentLocation: PlaceLocation = {
        lat: location.latitude,
        lng: location.longitude,
      };

      // Store for advanced search modal
      setUserLocation(currentLocation);

      console.log(`📍 Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);

      console.log('🔍 Checking home_location:', user.home_location);
      console.log('🔍 Checking work_location:', user.work_location);

      // Get home/work locations if available
      // Note: user is guaranteed non-null here due to guard at top of function
      const homeLocation = user?.home_location && (user?.home_location as any)?.coordinates
        ? { lat: (user?.home_location as any).coordinates[1], lng: (user?.home_location as any).coordinates[0] }
        : undefined;

      const workLocation = user?.work_location && (user?.work_location as any)?.coordinates
        ? { lat: (user?.work_location as any).coordinates[1], lng: (user?.work_location as any).coordinates[0] }
        : undefined;

      console.log('✅ Location parsing complete');
      console.log('🔍 User object keys:', Object.keys(user));
      console.log('🔍 User preferences:', user.preferences);
      console.log('🔍 User interests:', user.interests);

      // Generate recommendations
      // Use filter's maxDistance if set (100 = "any"), otherwise use user preference
      const prefs = user.preferences as UserPreferences;
      const effectiveMaxDistance = filters.maxDistance < 100
        ? filters.maxDistance
        : (prefs?.max_distance_miles || 10);

      const params: RecommendationParams = {
        user,
        userLocation: currentLocation,
        homeLocation,
        workLocation,
        maxDistance: effectiveMaxDistance,
        maxResults: 250, // Extra large batch for extended scrolling before loading
        timeOfDay: filters.timeOfDay !== 'any' ? filters.timeOfDay : undefined,
        priceRange: filters.priceRange !== 'any' ? filters.priceRange : undefined,
        discoveryMode: effectiveMode, // Use effective mode (handles stale closure)
        categories: selectedCategories.length > 0 ? selectedCategories : undefined, // Category filter
      };

      console.log('✅ Params object created, calling generateRecommendations...');
      const scored = await generateRecommendations(params);
      console.log(`✅ generateRecommendations returned ${scored.length} results`);

      // Convert ScoredRecommendation[] to Recommendation[]
      const recommendations: Recommendation[] = scored.map((s, index) => ({
        id: s.place.place_id || `rec-${index}`,
        title: s.place.name,
        category: s.category,
        location: s.place.vicinity || s.place.formatted_address || 'Unknown location',
        distance: `${s.distance.toFixed(1)} mi`,
        priceRange: s.place.price_level || 2,
        rating: s.place.rating || 0,
        imageUrl: s.photoUrl || '',
        photos: s.photoUrls, // Array of photos for carousel (only if 3+ photos)
        aiExplanation: s.aiExplanation,
        description: s.place.description, // Editorial summary from Google Places
        openNow: s.place.opening_hours?.open_now,
        isSponsored: s.isSponsored,
        isCurated: !!(s.place as any)?._isCurated,
        curatorName: (s.place as any)?._curatorName,
        score: s.score,
        businessHours: s.businessHours,
        hasEstimatedHours: s.hasEstimatedHours,
        suggestedTime: s.suggestedTime, // Phase 1.6a: Use recommendation context time
        event_metadata: s.place.event_metadata, // CRITICAL: Maps event data for Ticketmaster events (fixes ticket buttons + deduplication)
        scoreBreakdown: {
          baseScore: s.scoreBreakdown.baseScore,
          locationScore: s.scoreBreakdown.locationScore,
          timeScore: s.scoreBreakdown.timeScore,
          feedbackScore: s.scoreBreakdown.feedbackScore,
          collaborativeScore: s.scoreBreakdown.collaborativeScore,
          sponsorBoost: s.scoreBreakdown.sponsoredBoost,
          finalScore: s.scoreBreakdown.finalScore,
        },
        activity: {
          id: s.place.place_id || `act-${index}`,
          name: s.place.name,
          category: s.category,
          description: s.place.description,
          location: {
            latitude: getPlaceCoords(s.place).lat,
            longitude: getPlaceCoords(s.place).lng,
            address: s.place.vicinity || s.place.formatted_address || '',
          },
          distance: s.distance,
          rating: s.place.rating,
          reviewsCount: s.place.user_ratings_total,
          priceRange: s.place.price_level || 2,
          photoUrl: s.photoUrl,
          phone: s.place.formatted_phone_number,
          website: s.place.website,
          googlePlaceId: s.place.place_id,
        },
        // Group planning context — maps groupMemberMatches to GroupContext for see-details-modal
        groupContext: s.groupMemberMatches?.length ? {
          memberMatches: s.groupMemberMatches,
          interestMatchScore: s.scoreBreakdown.baseScore,
          farthestMemberName: s.groupMemberMatches.reduce((f, m) =>
            m.distanceMiles > f.distanceMiles ? m : f
          ).name,
          farthestMemberDistance: Math.max(...s.groupMemberMatches.map(m => m.distanceMiles)),
        } : undefined,
      }));

      console.log(`✅ Generated ${recommendations.length} recommendations`);
      console.log(`📍 First 3 places:`, recommendations.slice(0, 3).map(r => r.title));

      // If refresh returned 0 results, don't clear the existing recommendations
      if (recommendations.length === 0 && showRefreshIndicator) {
        console.log('⚠️ Refresh returned 0 results, keeping existing recommendations');
        return;
      }

      // AGGRESSIVE DEDUPLICATION: Remove duplicate events by name + date
      const seenEvents = new Set<string>();
      const dedupedRecommendations = recommendations.filter((rec: any) => {
        // For events, use name + start date as unique key
        if (rec.event_metadata && rec.event_metadata.start_time) {
          const eventKey = `${rec.title.toLowerCase()}_${rec.event_metadata.start_time}`;
          if (seenEvents.has(eventKey)) {
            console.log(`🔄 DUPLICATE EVENT REMOVED: ${rec.title} (${rec.event_metadata.start_time})`);
            return false;
          }
          seenEvents.add(eventKey);
          return true;
        }

        // For regular places, use place_id
        const placeId = rec.activity?.googlePlaceId || rec.id;
        if (seenEvents.has(placeId)) {
          console.log(`🔄 DUPLICATE PLACE REMOVED: ${rec.title}`);
          return false;
        }
        seenEvents.add(placeId);
        return true;
      });

      console.log(`🧹 Deduplication: ${recommendations.length} → ${dedupedRecommendations.length} (removed ${recommendations.length - dedupedRecommendations.length} duplicates)`);

      // PHASE 1: Save recommendations to database BEFORE updating UI (with discovery mode tag)
      await saveRecommendationsToDB(user.id, dedupedRecommendations, effectiveMode);
      console.log(`💾 Saved to DB, now updating UI state`);

      setRecommendations(dedupedRecommendations);
      setRefreshKey(prev => prev + 1); // Force FlatList to recognize new data
      console.log(`✅ UI state updated with ${dedupedRecommendations.length} recommendations, refreshKey:`, refreshKey + 1);

      END OF DISABLED CODE BLOCK */

    } catch (error) {
      console.error('❌ Error fetching recommendations:', error);
      handleError(error, 'Failed to load recommendations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle adding activity to calendar
  const handleAddToCalendar = useCallback((recommendation: Recommendation, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedRecommendation(recommendation);
    setShowScheduleModal(true);
  }, []);

  // Handle see details
  const handleSeeDetails = useCallback((recommendation: Recommendation, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRecommendation(recommendation);
    setShowDetailsModal(true);
  }, []);

  // Handle not interested button
  const handleNotInterested = useCallback((recommendation: Recommendation, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRecommendation(recommendation);
    setShowBlockModal(true);
  }, []);

  // Handle feedback submission
  const handleFeedbackSubmit = async (feedback: {
    rating: 'thumbs_up' | 'thumbs_down';
    tags?: string[];
    notes?: string;
  }) => {
    if (!user || !feedbackActivity) return;

    try {
      console.log('📝 Submitting feedback:', feedback);

      const result = await submitFeedback({
        userId: user.id,
        activityId: feedbackActivity.activityId,
        recommendationId: feedbackActivity.recommendationId,
        rating: feedback.rating,
        tags: feedback.tags,
        notes: feedback.notes,
        completedAt: feedbackActivity.completedAt,
      });

      if (result.success) {
        console.log('✅ Feedback submitted successfully');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        console.error('❌ Failed to submit feedback:', result.error);
      }
    } catch (error) {
      console.error('❌ Error submitting feedback:', error);
    } finally {
      setShowFeedbackModal(false);
      setFeedbackActivity(null);
    }
  };

  // Handle block confirmation
  const handleBlockConfirm = async () => {
    if (!selectedRecommendation || !user) return;

    try {
      const googlePlaceId = selectedRecommendation.activity?.googlePlaceId || selectedRecommendation.id;

      console.log(`🚫 Blocking ${selectedRecommendation.title} (${googlePlaceId})`);

      // Block the activity permanently
      await blockActivity(
        user.id,
        googlePlaceId,
        selectedRecommendation.title,
        'User chose "Never show again"'
      );

      // Remove from current recommendations list
      setRecommendations(prev => prev.filter(r =>
        (r.activity?.googlePlaceId || r.id) !== googlePlaceId
      ));

      // Close modal
      setShowBlockModal(false);
      setSelectedRecommendation(null);

      // Show toast notification
      setToastMessage("We won't show you this place again");
      setShowToast(true);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      console.log(`✅ Blocked ${selectedRecommendation.title}`);
    } catch (error) {
      console.error('Error blocking activity:', error);
      handleError(error, 'Failed to block activity');
    }
  };

  // Map Google Places categories to database-valid categories
  const mapCategoryToDBCategory = (category: string): string => {
    const categoryLower = category.toLowerCase();

    // Database allows: 'work', 'personal', 'social', 'dining', 'fitness', 'entertainment', 'travel', 'other'
    const categoryMap: Record<string, string> = {
      // Dining
      'restaurant': 'dining',
      'restaurants': 'dining',
      'cafe': 'dining',
      'coffee': 'dining',
      'food': 'dining',
      'bakery': 'dining',
      'meal_takeaway': 'dining',

      // Entertainment
      'bar': 'entertainment',
      'bars': 'entertainment',
      'night_club': 'entertainment',
      'movie_theater': 'entertainment',
      'museum': 'entertainment',
      'art_gallery': 'entertainment',
      'amusement_park': 'entertainment',
      'aquarium': 'entertainment',
      'bowling_alley': 'entertainment',
      'casino': 'entertainment',
      'stadium': 'entertainment',
      'zoo': 'entertainment',
      'live music': 'entertainment',
      'concert': 'entertainment',

      // Fitness
      'gym': 'fitness',
      'park': 'fitness',
      'hiking': 'fitness',
      'spa': 'fitness',
      'yoga': 'fitness',

      // Social
      'shopping_mall': 'social',
      'book_store': 'social',
      'library': 'social',
      'store': 'social',

      // Travel
      'lodging': 'travel',
      'tourist_attraction': 'travel',
      'travel_agency': 'travel',
      'airport': 'travel',
      'train_station': 'travel',
      'bus_station': 'travel',
    };

    return categoryMap[categoryLower] || 'other';
  };

  // Handle schedule confirmation
  // Conflict modal handlers
  const handleConflictCancel = () => {
    setShowConflictModal(false);
    setConflictType(null);
    setConflictingTask(null);
    setTravelDetails(null);
    setPendingSchedule(null);
  };

  const handleConflictChangeTime = () => {
    setShowConflictModal(false);
    // Keep schedule modal open so user can pick a different time
    // Modal is already open, just clear conflict state
    setConflictType(null);
    setConflictingTask(null);
    setTravelDetails(null);
    setPendingSchedule(null);
  };

  const handleConflictReplaceTask = async () => {
    if (!conflictingTask || !pendingSchedule) return;

    try {
      // Delete the conflicting task
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', conflictingTask.id);

      if (error) throw error;

      console.log(`🗑️ Deleted conflicting task: "${conflictingTask.title}"`);

      // Close conflict modal and proceed with scheduling
      setShowConflictModal(false);
      setConflictType(null);
      setConflictingTask(null);

      // Retry scheduling
      await handleScheduleConfirm(pendingSchedule.time);
    } catch (error) {
      console.error('❌ Error replacing task:', error);
      handleError(error, 'Failed to replace task');
    }
  };

  const handleScheduleConfirm = async (scheduledTime: Date) => {
    if (!selectedRecommendation || !user) return;

    try {
      console.log(`📅 Adding ${selectedRecommendation.title} to calendar`);

      // Extract coordinates from recommendation
      const latitude = selectedRecommendation.activity?.location?.latitude;
      const longitude = selectedRecommendation.activity?.location?.longitude;

      // Validate coordinates exist
      if (!latitude || !longitude) {
        console.error('❌ Missing coordinates:', { latitude, longitude, activity: selectedRecommendation.activity });
        throw new Error('Activity location coordinates are missing');
      }

      console.log(`📍 Location: ${latitude}, ${longitude}`);

      // CRITICAL: Check for scheduling conflicts BEFORE inserting
      const endTime = new Date(scheduledTime.getTime() + 60 * 60 * 1000); // 1 hour duration

      // Check 1: Double-booking conflict
      const conflict = await checkTimeConflict(user.id, scheduledTime, endTime);
      if (conflict) {
        console.log(`⚠️ Double-booking conflict detected with "${conflict.title}"`);
        setConflictType('double-booking');
        setConflictingTask(conflict);
        setPendingSchedule({ time: scheduledTime });
        setShowConflictModal(true);
        return; // Stop scheduling, wait for user decision
      }

      // Check 2: Travel time feasibility
      const feasibilityCheck = await canMakeItOnTime(user.id, scheduledTime, { latitude, longitude });
      if (!feasibilityCheck.feasible && feasibilityCheck.previousTask) {
        console.log(`⚠️ Travel time conflict: Can't make it from "${feasibilityCheck.previousTask.title}"`);
        setConflictType('travel-time');
        setTravelDetails({
          previousTask: feasibilityCheck.previousTask.title,
          travelMinutes: feasibilityCheck.travelMinutes!,
          arrivalTime: feasibilityCheck.arrivalTime!,
          minutesLate: feasibilityCheck.minutesLate!,
        });
        setPendingSchedule({ time: scheduledTime });
        setShowConflictModal(true);
        return; // Stop scheduling, wait for user decision
      }

      // Map category to database-valid value
      const dbCategory = mapCategoryToDBCategory(selectedRecommendation.category);
      console.log(`📂 Category mapping: "${selectedRecommendation.category}" → "${dbCategory}"`);

      // Build calendar event object
      const eventData: any = {
        user_id: user.id,
        title: selectedRecommendation.title,
        description: selectedRecommendation.aiExplanation || '',
        category: dbCategory,
        location: `POINT(${longitude} ${latitude})`, // WKT format: POINT(lng lat)
        address: selectedRecommendation.location,
        start_time: scheduledTime.toISOString(),
        end_time: new Date(scheduledTime.getTime() + 60 * 60 * 1000).toISOString(),
        source: 'recommendation',
        status: 'scheduled',
      };

      // NOTE: activity_id expects UUID but we only have Google Place ID
      // We track the place separately via googlePlaceId, so activity_id is not needed

      console.log('📝 Calendar event data:', JSON.stringify(eventData, null, 2));

      // Add to calendar_events table (use WKT format for PostGIS compatibility)
      const { data: calendarEvent, error } = await (supabase.from('calendar_events') as any)
        .insert(eventData)
        .select()
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      // PHASE 1: Mark recommendation as accepted in tracking table
      if (calendarEvent && selectedRecommendation.activity?.googlePlaceId) {
        await markAsAccepted(
          user.id,
          selectedRecommendation.activity.googlePlaceId,
          calendarEvent.id
        );
      }

      // Close modal and show success toast
      setShowScheduleModal(false);
      setToastMessage('Added to calendar ✓');
      setShowToast(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      console.log('✅ Added to calendar and marked as accepted');

      // ANIMATION: Trigger card removal animation (slide left toward Calendar tab)
      const cardId = selectedRecommendation.id;
      setRemovingCardId(cardId);

      // After animation completes (850ms = 800ms animation + 50ms buffer), remove card from feed
      setTimeout(() => {
        setRecommendations(prev => prev.filter(rec => rec.id !== cardId));
        setRemovingCardId(null);
        console.log(`🗑️ Removed card ${selectedRecommendation.title} from feed`);
      }, 850);

    } catch (error) {
      console.error('❌ Error adding to calendar:', error);
      handleError(error, 'Failed to add to calendar');
    }
  };

  // Initial load
  useEffect(() => {
    console.log('🎬 Feed screen mounted, user:', user?.id);
    if (user) {
      console.log('✅ User exists, fetching recommendations...');
      fetchRecommendations().catch(error => {
        console.error('❌ CRITICAL: fetchRecommendations failed in useEffect:', error);
        setLoading(false); // Ensure we exit loading state even on error
      });
      checkDashboardStatus();

      // Fetch pending radar alerts for feed injection
      if (FEATURE_FLAGS.ENABLE_RADAR && !radarAlertsFetched.current) {
        radarAlertsFetched.current = true;
        getPendingRadarAlerts(user.id).then(alerts => {
          if (alerts.length > 0) {
            setRadarAlerts(alerts);
            console.log(`📡 Loaded ${alerts.length} radar alerts for feed`);
          }
        }).catch(err => {
          console.warn('[Radar] Failed to fetch alerts:', err);
        });
      }

      // Fetch hot drops for feed injection
      if (FEATURE_FLAGS.ENABLE_HOT_DROPS && !hotDropsFetched.current) {
        hotDropsFetched.current = true;
        const userTier = user.subscription_tier === 'plus' ? 'plus' : 'free';
        getHotDropsForFeed(userTier).then(drops => {
          if (drops.length > 0) {
            setHotDrops(drops);
            console.log(`🔥 Loaded ${drops.length} hot drops for feed`);
          }
        }).catch(err => {
          console.warn('[HotDrops] Failed to fetch drops:', err);
        });
      }

      // REMOVED: Feedback modal on app launch
      // User feedback: "I can't do anything but close it so I don't see the point"
      // Feedback prompts are still available on the Calendar screen where they're more contextual
      // If we want to re-enable this, it should be after significant user activity, not on launch
    } else {
      console.log('⚠️ No user found, staying in loading state');
      // Set a timeout to prevent infinite loading if auth fails
      const timeout = setTimeout(() => {
        console.error('❌ TIMEOUT: No user after 10 seconds, exiting loading state');
        setLoading(false);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [user]);

  // Check for activities that need feedback
  const checkForPendingFeedback = async () => {
    if (!user) return;

    try {
      const result = await shouldPromptForFeedback(user.id);
      if (result.shouldPrompt && result.activity) {
        console.log('💬 Showing feedback prompt for activity:', result.activity.activityName);

        // Get recommendation ID if activity came from a recommendation
        const recommendationId = result.activity.activityId
          ? await getRecommendationIdForActivity(user.id, result.activity.activityId)
          : null;

        setFeedbackActivity({
          activityId: result.activity.activityId || '',
          activityName: result.activity.activityName,
          completedAt: result.activity.completedAt,
          recommendationId: recommendationId || undefined,
          place: result.activity.place,
        });
        setShowFeedbackModal(true);
      }
    } catch (error) {
      console.error('Error checking for pending feedback:', error);
    }
  };

  // Check for pending feedback on mount — load first activity for inline card
  useEffect(() => {
    if (!user) return;
    Promise.all([
      getPendingFeedbackActivities(user.id),
      getPastEventsNeedingFeedback(user.id),
    ]).then(([completed, past]) => {
      const seenIds = new Set(completed.map(a => a.eventId));
      const uniquePast = past.filter(a => !seenIds.has(a.eventId));
      const allPending = [...completed, ...uniquePast];
      setPendingFeedbackCount(allPending.length);
      setFeedbackBannerDismissed(false);
      // Set first activity for inline card (one at a time)
      if (allPending.length > 0) {
        const first = allPending[0];
        setNextFeedbackActivity({
          eventId: first.eventId,
          activityId: first.activityId,
          activityName: first.activityName,
          activityCategory: first.activityCategory,
          completedAt: first.completedAt,
        });
      } else {
        setNextFeedbackActivity(null);
      }
    }).catch(() => {});
  }, [user]);

  // Handle feedback request from notification tray
  const handleNotificationFeedbackRequest = useCallback(async (data: {
    eventId: string;
    activityId: string | null;
    activityName: string;
    activityCategory: string;
    completedAt: string;
    place?: { id: string; name: string; address?: string };
  }) => {
    if (!user) return;

    // Get recommendation ID if activity came from a recommendation
    const recommendationId = data.activityId
      ? await getRecommendationIdForActivity(user.id, data.activityId)
      : null;

    setFeedbackActivity({
      activityId: data.activityId || '',
      activityName: data.activityName,
      completedAt: data.completedAt,
      recommendationId: recommendationId || undefined,
      place: data.place,
    });
    setShowFeedbackModal(true);
  }, [user]);

  // Share handler — opens the share bottom sheet for a card
  const handleShare = useCallback((item: Recommendation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShareRecommendation(item);
    setShareSheetVisible(true);
  }, []);

  // Cache handlers per item to prevent recreation
  const handlersCache = useRef<Map<string, any>>(new Map());

  const handleAddToRadar = useCallback((item: Recommendation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRadarPrefill({
      hookType: 'venue',
      entityName: item.title,
      category: item.category,
    });
    setShowRadarSheet(true);
  }, []);

  const getHandlersForItem = useCallback((item: Recommendation, index: number) => {
    const cacheKey = `${item.id}-${index}`;
    if (!handlersCache.current.has(cacheKey)) {
      handlersCache.current.set(cacheKey, {
        onAddToCalendar: () => handleAddToCalendar(item, index),
        onSeeDetails: () => handleSeeDetails(item, index),
        onComment: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedRecommendation(item);
          setDetailsScrollToComments(true);
          setShowDetailsModal(true);
        },
        onNotInterested: () => handleNotInterested(item, index),
        onAddToRadar: () => handleAddToRadar(item),
        onShare: () => handleShare(item),
      });
    }
    return handlersCache.current.get(cacheKey);
  }, [handleAddToCalendar, handleSeeDetails, handleNotInterested, handleAddToRadar, handleShare]);

  // RSVP handlers for group plans (mock for demo)
  const handleAcceptRSVP = useCallback((recId: string) => {
    console.log('✅ Accepted RSVP for:', recId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setToastMessage("You're going! We'll notify the group.");
    setShowToast(true);
  }, []);

  const handleDeclineRSVP = useCallback((recId: string) => {
    console.log('❌ Declined RSVP for:', recId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setToastMessage("No problem! We'll let them know.");
    setShowToast(true);
  }, []);

  const handleMaybeRSVP = useCallback((recId: string) => {
    console.log('❓ Maybe RSVP for:', recId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setToastMessage("Marked as maybe. You can change this later.");
    setShowToast(true);
  }, []);

  // Memoized render item to prevent unnecessary re-renders
  const renderItem = useCallback(
    ({ item, index }: { item: Recommendation; index: number }) => {
      // Handle insights nudge (subtle inline upgrade card)
      if (item.cardType === 'insights_nudge') {
        const trialDaysLeft = dailyLimitInfo?.trialStatus?.isTrialing
          ? dailyLimitInfo.trialStatus.daysLeft
          : undefined;
        return (
          <InsightsNudge
            trialDaysLeft={trialDaysLeft}
            onDismiss={() => setUpgradeDismissed(true)}
          />
        );
      }

      // Handle hot drop cards
      if (item.cardType === 'hot_drop' && hotDrops.length > 0) {
        const drop = hotDrops[0];
        const isPlusUser = user?.subscription_tier === 'plus';
        return (
          <HotDropCard
            hotDrop={drop}
            isPlusUser={isPlusUser}
            onClaim={async (hotDropId) => {
              const result = await claimHotDrop(hotDropId, user?.id || 'demo-user-123');
              if (result.success) {
                setToastMessage('Claimed! Show this at the venue.');
                setShowToast(true);
                // Update local state
                setHotDrops(prev => prev.map(d =>
                  d.id === hotDropId
                    ? { ...d, currentClaims: d.currentClaims + 1 }
                    : d
                ));
              } else {
                setToastMessage(result.error || 'Could not claim.');
                setShowToast(true);
              }
            }}
          />
        );
      }

      // Handle radar alert cards
      if (item.cardType === 'radar_alert') {
        const notification = (item as any)._radarNotification as HookNotification;
        if (!notification) return null;
        const radarMatch = item.radarMatch || notificationToRadarMatch(notification);
        return (
          <RadarAlertCard
            notification={notification}
            radarMatch={radarMatch}
            index={index}
            onDismiss={() => {
              markNotificationDismissed(notification.userId, notification.id);
              setRadarAlerts(prev => prev.filter(a => a.id !== notification.id));
            }}
            onSave={() => {
              markNotificationViewed(notification.userId, notification.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          />
        );
      }

      const handlers = getHandlersForItem(item, index);

      // Get mock social/group data for this item (Phase 2 demo)
      const mockData = getMockSocialData(index, item.id);

      return (
        <ActivityCardIntelligent
          recommendation={item}
          onAddToCalendar={handlers.onAddToCalendar}
          onSeeDetails={handlers.onSeeDetails}
          onComment={handlers.onComment}
          onNotInterested={handlers.onNotInterested}
          onAddToRadar={handlers.onAddToRadar}
          onShare={handlers.onShare}
          commentsCount={item.commentsCount}
          index={index}
          isRemoving={removingCardId === item.id}
          // Phase 2: Social & Group features (mock data for demo)
          friendActivity={mockData.friendActivity}
          groupPlan={mockData.groupPlan}
          onAcceptRSVP={() => handleAcceptRSVP(item.id)}
          onDeclineRSVP={() => handleDeclineRSVP(item.id)}
          onMaybeRSVP={() => handleMaybeRSVP(item.id)}
          cardType={(item.cardType === 'ai_curated' || item.cardType === 'discovery') ? item.cardType : 'ai_curated'}
          showInsights={item.showInsights !== false}
        />
      );
    },
    [getHandlersForItem, removingCardId, handleAcceptRSVP, handleDeclineRSVP, handleMaybeRSVP, dailyLimitInfo, colors.textSecondary, radarAlerts, hotDrops, user]
  );

  // Phase 1.2: Smart Merge Pull-to-Refresh
  const handleSmartRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('🔄 Smart refresh: Fetching fresh content...');

    try {
      if (!user) {
        setRefreshing(false);
        return;
      }

      const location = await getCurrentLocation();
      const userLocation = { lat: location.latitude, lng: location.longitude };

      const homeLocation = user.home_location && (user.home_location as any).coordinates
        ? { lat: (user.home_location as any).coordinates[1], lng: (user.home_location as any).coordinates[0] }
        : undefined;

      const workLocation = user.work_location && (user.work_location as any).coordinates
        ? { lat: (user.work_location as any).coordinates[1], lng: (user.work_location as any).coordinates[0] }
        : undefined;

      // Fetch 15-20 fresh recommendations at current radius
      const freshRecommendations = await generateRecommendations({
        user,
        userLocation,
        homeLocation,
        workLocation,
        maxDistance: searchRadiusRef.current, // Use current radius, not reset to 10
        maxResults: 20,
        excludePlaceIds: recommendations.slice(0, 5).map(r => r.activity?.googlePlaceId).filter(Boolean) as string[], // Only exclude top 5
        timeOfDay: filters.timeOfDay !== 'any' ? filters.timeOfDay : undefined,
        priceRange: filters.priceRange !== 'any' ? filters.priceRange : undefined,
        discoveryMode: 'for_you',
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      });

      if (freshRecommendations.length > 0) {
        // Convert to Recommendation[] format
        const newRecs: Recommendation[] = freshRecommendations.map((s, index) => ({
          id: s.place.place_id || `rec-fresh-${Date.now()}-${index}`,
          title: s.place.name,
          category: s.category,
          location: s.place.vicinity || s.place.formatted_address || 'Unknown location',
          distance: `${s.distance.toFixed(1)} mi`,
          priceRange: s.place.price_level || 2,
          rating: s.place.rating || 0,
          imageUrl: s.photoUrl || '',
          photos: s.photoUrls,
          aiExplanation: s.aiExplanation,
          suggestedTime: s.suggestedTime,
          description: s.place.description,
          openNow: s.place.opening_hours?.open_now,
          isSponsored: s.isSponsored,
          score: s.score,
          businessHours: s.businessHours,
          hasEstimatedHours: s.hasEstimatedHours,
          isCurated: !!(s.place as any)?._isCurated,
          curatorName: (s.place as any)?._curatorName,
          scoreBreakdown: {
            baseScore: s.scoreBreakdown.baseScore,
            locationScore: s.scoreBreakdown.locationScore,
            timeScore: s.scoreBreakdown.timeScore,
            feedbackScore: s.scoreBreakdown.feedbackScore,
            collaborativeScore: s.scoreBreakdown.collaborativeScore,
            sponsorBoost: s.scoreBreakdown.sponsoredBoost,
            finalScore: s.scoreBreakdown.finalScore,
          },
          activity: {
            id: s.place.place_id || `act-fresh-${index}`,
            name: s.place.name,
            category: s.category,
            description: s.place.description,
            location: {
              latitude: getPlaceCoords(s.place).lat,
              longitude: getPlaceCoords(s.place).lng,
              address: s.place.vicinity || s.place.formatted_address || '',
            },
            distance: s.distance,
            rating: s.place.rating,
            reviewsCount: s.place.user_ratings_total,
            priceRange: s.place.price_level || 2,
            photoUrl: s.photoUrl,
            phone: s.place.formatted_phone_number,
            website: s.place.website,
            // hours property omitted - opening_hours format doesn't match Record<string, string>
            tags: s.place.types,
            isSponsored: s.isSponsored,
            googlePlaceId: s.place.place_id,
          },
          groupContext: s.groupMemberMatches?.length ? {
            memberMatches: s.groupMemberMatches,
            interestMatchScore: s.scoreBreakdown.baseScore,
            farthestMemberName: s.groupMemberMatches.reduce((f, m) =>
              m.distanceMiles > f.distanceMiles ? m : f
            ).name,
            farthestMemberDistance: Math.max(...s.groupMemberMatches.map(m => m.distanceMiles)),
          } : undefined,
        }));

        // Smart merge: Add new at top, keep bottom 40 existing (NO divider)
        setRecommendations(prev => [
          ...newRecs,
          ...prev.slice(0, 40) // Keep bottom 40
        ]);

        // Save new recommendations to DB
        await saveRecommendationsToDB(user.id, newRecs, 'for_you');

        // Increment refresh key to force re-render
        setRefreshKey(prev => prev + 1);

        console.log(`✅ Smart refresh: Added ${newRecs.length} fresh + kept ${Math.min(40, recommendations.length)} old`);
      } else {
        console.log('⚠️ No fresh content found, keeping existing feed');
      }
    } catch (error) {
      console.error('❌ Smart refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user, recommendations, searchRadiusRef, filters, getCurrentLocation, saveRecommendationsToDB]);

  // Memoized onRefresh handler - calls smart merge refresh
  const handleRefresh = useCallback(() => {
    console.log('🔄 Pull to refresh triggered');
    handleSmartRefresh();
  }, [handleSmartRefresh]);

  // Handle load more (infinite scroll) - DISABLED for Daily tab
  // Daily tab shows finite recommendations based on subscription tier
  // Infinite scroll is only available in Explore tab
  // Note: Full infinite scroll implementation is in explore.tsx
  const handleLoadMore = useCallback(() => {
    // Daily tab does not support infinite scroll - recommendations are tier-limited
    // Infinite scroll is implemented in the Explore tab (explore.tsx)
  }, []);

  // Welcome message animation - shows for 5 seconds then fades (only on first load)
  useEffect(() => {
    if (recommendations.length > 0 && !hasShownWelcome.current) {
      console.log('👋 Showing welcome message (first load)');
      hasShownWelcome.current = true; // Mark as shown

      // Show welcome message immediately
      welcomeHeight.value = 60; // Reduced height for less space
      welcomeOpacity.value = withTiming(1, { duration: 400 });

      // Feed is always visible
      feedOpacity.value = 1;

      // After 5 seconds, fade out then snap height to 0
      const timeout = setTimeout(() => {
        welcomeOpacity.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) }, () => {
          // After fade completes, collapse height instantly
          welcomeHeight.value = 0;
        });
      }, 5000);

      return () => clearTimeout(timeout);
    } else if (recommendations.length > 0) {
      // Just show feed without welcome message
      feedOpacity.value = 1;
    }
  }, [recommendations.length]);

  // Track last filter interaction time and collapse delay
  const [lastFilterInteraction, setLastFilterInteraction] = useState<number>(0);
  const [collapseDelay, setCollapseDelay] = useState<number>(4000); // 4 seconds by default (initial reveal)

  // Auto-collapse after specified delay (4s on reveal, 2s after interaction)
  useEffect(() => {
    if (lastFilterInteraction === 0) {
      console.log('⏱️ No filter interaction yet, skipping timer');
      return;
    }

    console.log(`⏱️ Setting up auto-collapse timer for ${collapseDelay}ms at:`, lastFilterInteraction);

    const timerId = setTimeout(() => {
      console.log('⏱️ ✨ TIMER FIRED! Collapsing filters now');
      setShowFilters(false);
      filtersHeight.value = withTiming(0, { duration: 350, easing: Easing.inOut(Easing.quad) });
    }, collapseDelay);

    console.log('⏱️ Timer ID:', timerId);

    return () => {
      console.log('⏱️ Cleanup - clearing timer:', timerId);
      clearTimeout(timerId);
    };
  }, [lastFilterInteraction]); // Only depend on lastFilterInteraction, not showFilters

  // Reset timer on any filter interaction (touch, scroll, or change)
  const handleFilterInteraction = () => {
    console.log('🎛️ Filter interaction detected, resetting timer');
    setCollapseDelay(3000); // 3 seconds after any interaction
    setLastFilterInteraction(Date.now());
  };

  // Handle filter change (user selection)
  const handleFiltersChange = (newFilters: FeedFilters) => {
    console.log('🎛️ Filter changed:', newFilters);
    setFilters(newFilters);
    handleFilterInteraction(); // Reset timer
    // Refetch recommendations with new filters
    fetchRecommendations(true);
  };

  // Phase 1.5: Expand distance filter by 10 miles
  const handleExpandDistance = useCallback(() => {
    console.log('🔍 Expanding distance filter by 10 miles');
    const currentDistance = filters.maxDistance || (activeFilters?.maxDistance) || 10;
    const newDistance = currentDistance + 10;

    setFilters({ ...filters, maxDistance: newDistance });
    setActiveFilters({ ...(activeFilters || {} as SearchFilters), maxDistance: newDistance } as SearchFilters);
    setFeedExhausted(false);
    feedExhaustedRef.current = false;

    // Trigger load more to fetch with expanded radius
    handleLoadMore();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [filters, activeFilters, handleLoadMore]);

  // Phase 1.5: Remove distance filter (set to 100 miles = "any")
  const handleRemoveDistanceFilter = useCallback(() => {
    console.log('🌍 Removing distance filter');

    setFilters({ ...filters, maxDistance: 100 });
    setActiveFilters({ ...(activeFilters || {} as SearchFilters), maxDistance: 100 } as SearchFilters);
    setFeedExhausted(false);
    feedExhaustedRef.current = false;

    // Trigger load more to fetch with unlimited radius
    handleLoadMore();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [filters, activeFilters, handleLoadMore]);

  // Handle advanced search filters
  const handleApplyAdvancedFilters = async (searchFilters: SearchFilters) => {
    console.log('🔍 Advanced filters applied:', searchFilters);

    // Store active filters
    setActiveFilters(searchFilters);

    // Trigger haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // FAST PATH: If the user only changed basic filters (no custom search location/query),
    // re-filter the existing DB-cached recommendations instead of calling live API.
    const hasCustomSearch = searchFilters.searchQuery ||
      searchFilters.location ||
      searchFilters.searchType === 'place';

    if (!hasCustomSearch && recommendations.length > 0) {
      console.log('⚡ Fast filter: Re-filtering cached recommendations (no live API needed)');

      // Sync filterSheetFilters for the useMemo filter pipeline
      setFilterSheetFilters({
        mode: 'for_you',
        categories: searchFilters.categories,
        maxDistance: searchFilters.maxDistance,
        priceRange: searchFilters.priceRange[1] === 3 ? 'any' : searchFilters.priceRange[1] as 1 | 2 | 3 | 4,
        minRating: searchFilters.minRating,
        timeOfDay: searchFilters.timeOfDay.length === 1 ? searchFilters.timeOfDay[0] as any : 'any',
      });

      // Show confirmation toast
      const filterSummary: string[] = [];
      if (searchFilters.categories.length > 0) filterSummary.push(`${searchFilters.categories.length} categories`);
      if (searchFilters.minRating > 0) filterSummary.push(`${searchFilters.minRating}+ stars`);
      if (searchFilters.openNow) filterSummary.push('open now');

      setToastMessage(
        filterSummary.length > 0
          ? `Filtered by: ${filterSummary.join(', ')}`
          : 'Filters applied'
      );
      setShowToast(true);
      return;
    }

    // SLOW PATH: Custom search location or query — need live API call
    setRefreshing(true);

    try {
      if (!user) {
        setRefreshing(false);
        return;
      }

      // Determine search location (custom location or user's current location)
      let searchLocation: PlaceLocation | null = searchFilters.location
        ? { lat: searchFilters.location.latitude, lng: searchFilters.location.longitude }
        : userLocation;

      if (!searchLocation) {
        const location = await getCurrentLocation();
        searchLocation = { lat: location.latitude, lng: location.longitude };
      }

      // Build recommendation params with advanced filters
      const params: RecommendationParams = {
        user,
        userLocation: searchLocation as PlaceLocation,
        homeLocation: user.home_location && (user.home_location as any).coordinates
          ? { lat: (user.home_location as any).coordinates[1], lng: (user.home_location as any).coordinates[0] }
          : undefined,
        workLocation: user.work_location && (user.work_location as any).coordinates
          ? { lat: (user.work_location as any).coordinates[1], lng: (user.work_location as any).coordinates[0] }
          : undefined,
        maxDistance: searchFilters.maxDistance,
        maxResults: 50,
        // Map advanced filters to recommendation params
        categories: searchFilters.categories,
        minRating: searchFilters.minRating,
        priceRange: searchFilters.priceRange[1] as any, // Use max price from range
        date: searchFilters.date,
        timeOfDay: searchFilters.timeOfDay.length > 0 ? searchFilters.timeOfDay : undefined,
        openNow: searchFilters.openNow,
        discoveryMode: 'for_you', // Blended feed always uses for_you mode
      };

      console.log('🔍 Fetching recommendations with advanced params:', params);

      // Generate recommendations with filters
      const scored = await generateRecommendations(params);

      // Convert to Recommendation format
      const recommendations: Recommendation[] = scored.map((s, index) => ({
        id: s.place.place_id || `rec-${index}`,
        title: s.place.name,
        category: s.category,
        location: s.place.vicinity || s.place.formatted_address || 'Unknown location',
        distance: `${s.distance.toFixed(1)} mi`,
        priceRange: s.place.price_level || 2,
        rating: s.place.rating || 0,
        imageUrl: s.photoUrl || '',
        photos: s.photoUrls,
        aiExplanation: s.aiExplanation,
        description: s.place.description,
        openNow: s.place.opening_hours?.open_now,
        isSponsored: s.isSponsored,
        score: s.score,
        businessHours: s.businessHours,
        hasEstimatedHours: s.hasEstimatedHours,
        suggestedTime: s.suggestedTime,
        scoreBreakdown: {
          baseScore: s.scoreBreakdown.baseScore,
          locationScore: s.scoreBreakdown.locationScore,
          timeScore: s.scoreBreakdown.timeScore,
          feedbackScore: s.scoreBreakdown.feedbackScore,
          collaborativeScore: s.scoreBreakdown.collaborativeScore,
          sponsorBoost: s.scoreBreakdown.sponsoredBoost,
          finalScore: s.scoreBreakdown.finalScore,
        },
        activity: {
          id: s.place.place_id || `act-${index}`,
          name: s.place.name,
          category: s.category,
          description: s.place.description,
          location: {
            latitude: getPlaceCoords(s.place).lat,
            longitude: getPlaceCoords(s.place).lng,
            address: s.place.vicinity || s.place.formatted_address || '',
          },
          distance: s.distance,
          rating: s.place.rating,
          reviewsCount: s.place.user_ratings_total,
          priceRange: s.place.price_level || 2,
          photoUrl: s.photoUrl,
          phone: s.place.formatted_phone_number,
          website: s.place.website,
          googlePlaceId: s.place.place_id,
        },
        groupContext: s.groupMemberMatches?.length ? {
          memberMatches: s.groupMemberMatches,
          interestMatchScore: s.scoreBreakdown.baseScore,
          farthestMemberName: s.groupMemberMatches.reduce((f, m) =>
            m.distanceMiles > f.distanceMiles ? m : f
          ).name,
          farthestMemberDistance: Math.max(...s.groupMemberMatches.map(m => m.distanceMiles)),
        } : undefined,
      }));

      console.log(`✅ Generated ${recommendations.length} filtered recommendations`);

      // AGGRESSIVE DEDUPLICATION: Remove duplicate events by name + date
      const seenEvents = new Set<string>();
      const dedupedRecommendations = recommendations.filter((rec: any) => {
        // For events, use name + start date as unique key
        if (rec.event_metadata && rec.event_metadata.start_time) {
          const eventKey = `${rec.title.toLowerCase()}_${rec.event_metadata.start_time}`;
          if (seenEvents.has(eventKey)) {
            console.log(`🔄 DUPLICATE EVENT REMOVED (filter): ${rec.title}`);
            return false;
          }
          seenEvents.add(eventKey);
          return true;
        }

        // For regular places, use place_id
        const placeId = rec.activity?.googlePlaceId || rec.id;
        if (seenEvents.has(placeId)) {
          console.log(`🔄 DUPLICATE PLACE REMOVED (filter): ${rec.title}`);
          return false;
        }
        seenEvents.add(placeId);
        return true;
      });

      console.log(`🧹 Filter Deduplication: ${recommendations.length} → ${dedupedRecommendations.length}`);

      // SMART SEARCH FILTERING: Filter by specific place if searchType === 'place'
      let finalRecommendations = dedupedRecommendations;
      if (searchFilters.searchType === 'place' && searchFilters.placeName) {
        console.log(`🎯 Smart Search: Filtering to places matching "${searchFilters.placeName}"`);

        finalRecommendations = dedupedRecommendations.filter(rec => {
          // Match by place name (fuzzy match - contains)
          const nameMatch = rec.title.toLowerCase().includes(searchFilters.placeName!.toLowerCase());

          // Match by place types (if available)
          const typeMatch = searchFilters.placeTypes && searchFilters.placeTypes.length > 0
            ? searchFilters.placeTypes.some(type => rec.category.toLowerCase().includes(type.toLowerCase()))
            : false;

          return nameMatch || typeMatch;
        });

        console.log(`🎯 Smart Search Results: ${dedupedRecommendations.length} → ${finalRecommendations.length} (filtered to "${searchFilters.placeName}")`);
      } else if (searchFilters.searchType === 'area') {
        console.log(`📍 Smart Search: Searching FROM area "${searchFilters.location?.address}"`);
        // Area search - recommendations are already centered on the new location from generateRecommendations
      }

      // Update state
      setRecommendations(finalRecommendations);
      setRefreshKey(prev => prev + 1);

      // Save to database (with discovery mode tag)
      await saveRecommendationsToDB(user.id, dedupedRecommendations, 'for_you');

      // Show toast with filter summary
      const filterSummary = [];
      if (searchFilters.searchType === 'place' && searchFilters.placeName) {
        filterSummary.push(`🎯 ${searchFilters.placeName}`);
      } else if (searchFilters.searchType === 'area' && searchFilters.location) {
        filterSummary.push(`📍 Near ${searchFilters.location.address.split(',')[0]}`);
      }
      if (searchFilters.categories.length > 0) filterSummary.push(`${searchFilters.categories.length} categories`);
      if (searchFilters.minRating > 0) filterSummary.push(`${searchFilters.minRating}+ stars`);
      if (searchFilters.openNow) filterSummary.push('open now');

      setToastMessage(
        filterSummary.length > 0
          ? `Filtered by: ${filterSummary.join(', ')}`
          : 'Showing all recommendations'
      );
      setShowToast(true);

    } catch (error) {
      console.error('❌ Error applying advanced filters:', error);
      handleError(error, 'Failed to apply filters');
    } finally {
      setRefreshing(false);
    }
  };

  // Track scroll position and handle filter reveal/collapse
  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const prevOffset = previousScrollOffset.current;
    scrollY.value = offsetY;

    // If currently collapsing filters, lock scroll at the locked position
    if (collapsingFilters) {
      flatListRef.current?.scrollToOffset({
        offset: lockedScrollPosition.current,
        animated: false
      });
      return; // Don't process any other scroll logic during collapse
    }

    // Reveal filters when pulling down - ONLY if user is actively dragging (not momentum)
    // This prevents triggering filters when momentum scrolling back to top
    const shouldRevealFilters =
      isFirstCardVisible && // First card must be visible
      isActivelyDragging.current && // CRITICAL: User must be actively dragging (finger on screen)
      offsetY < -20 && // Pulled down at least 20px
      prevOffset >= -20 && // Just crossed the threshold
      prevOffset <= 0 && // Started from the top
      !showFilters && // Not already showing
      !refreshing; // Not refreshing

    if (shouldRevealFilters) {
      console.log('🎯 Revealing filters (active drag detected, crossed -20 threshold)');
      setShowFilters(true);
      filtersHeight.value = withTiming(90, { duration: 300, easing: Easing.out(Easing.cubic) });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCollapseDelay(4000);
      setLastFilterInteraction(Date.now());
    }

    // PRIORITY: Collapse filters FIRST when user scrolls INTO content while filters are open
    // Cards stay locked in place during collapse animation
    // Only trigger when crossing from top zone (<=0) into content (>0) to avoid bounce-back triggering
    const isScrollingDown = offsetY > 0 && prevOffset <= 0;

    if (isScrollingDown && showFilters && !collapsingFilters) {
      console.log('📜 Detected downward scroll, locking feed and collapsing filters');

      // Lock current scroll position
      lockedScrollPosition.current = prevOffset;
      setCollapsingFilters(true);

      // Collapse filters
      setShowFilters(false);
      filtersHeight.value = withTiming(0, {
        duration: 350,
        easing: Easing.inOut(Easing.quad)
      });

      // Unlock scroll after collapse animation completes
      setTimeout(() => {
        setCollapsingFilters(false);
        console.log('✅ Filters collapsed, unlocking feed scroll');
      }, 350);

      return; // Don't update scroll offset during collapse
    }

    // Update previous scroll offset
    previousScrollOffset.current = offsetY;
  }, [collapsingFilters, isFirstCardVisible, showFilters, refreshing, scrollY, filtersHeight]);

  // Track when user starts dragging (finger on screen)
  const handleScrollBeginDrag = useCallback(() => {
    console.log('👆 User started dragging (finger on screen)');
    isActivelyDragging.current = true;
  }, []);

  // Track when user stops dragging (finger lifted)
  const handleScrollEndDrag = useCallback(() => {
    console.log('👆 User stopped dragging (finger lifted)');
    isActivelyDragging.current = false;
  }, []);

  // Pan gesture to reveal filters (only works when first card is visible)
  const panGesture = Gesture.Pan()
    .enabled(isFirstCardVisible) // Only allow when first card is visible
    .activeOffsetY(15) // Require 15px downward movement to activate
    .failOffsetY(-10) // Fail if swiping up
    .failOffsetX([-20, 20]) // Fail if swiping horizontally
    .maxPointers(1)
    .simultaneousWithExternalGesture(flatListRef as any)
    .onBegin(() => {
      'worklet';
      console.log('🎯 Pan gesture begin, firstCardVisible:', isFirstCardVisible);
    })
    .onStart(() => {
      'worklet';
      console.log('🎯 Pan gesture started - pulling to reveal filters');
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((event) => {
      'worklet';
      // Only process when scrolled to top and pulling down
      if (scrollY.value <= 0 && event.translationY > 0) {
        gestureTranslationY.value = event.translationY;
        // Smooth mapping: 0-90px swipe = 0-90px filter height
        const progress = Math.min(event.translationY / 90, 1);
        // Use easing for smoother feel
        const easedProgress = progress * progress; // Quadratic easing
        filtersHeight.value = easedProgress * 90;
      }
    })
    .onEnd((event) => {
      'worklet';
      console.log('✋ Gesture ended, translationY:', event.translationY);
      // If swiped down more than 20px, reveal filters
      if (event.translationY > 20 && scrollY.value <= 0) {
        filtersHeight.value = withTiming(90, { duration: 300, easing: Easing.out(Easing.cubic) });
        runOnJS(setShowFilters)(true);
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        // Start auto-collapse timer with 4-second delay (initial reveal)
        runOnJS(setCollapseDelay)(4000);
        runOnJS(setLastFilterInteraction)(Date.now());
      } else {
        // Snap back to hidden with smooth animation
        filtersHeight.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
        runOnJS(setShowFilters)(false);
      }
      gestureTranslationY.value = 0;
    });

  // Refresh tab bar badges from notification data
  const refreshTabBadges = async () => {
    if (!user) return;
    try {
      const [notifications, feedbackCount] = await Promise.all([
        fetchDashboardNotifications(user.id),
        getPendingFeedbackNotificationCount(user.id),
      ]);
      setPendingFeedbackCount(feedbackCount);

      // Check if any current recommendation has a high match score (90%+)
      const hasHighMatch = recommendations.some(r => (r as any).matchScore >= 90);

      const badges = computeTabBadges({
        notifications,
        pendingFeedbackCount: feedbackCount,
        hasHighMatchRec: hasHighMatch,
        hasNewRecommendations: false, // managed separately via setHasNewRecommendations
      });
      applyBadges(badges);
    } catch (error) {
      console.error('❌ Error refreshing tab badges:', error);
    }
  };

  // Check if dashboard should show on first load
  const checkDashboardStatus = async () => {
    if (!user) return;

    try {
      // Check if should show dashboard today
      const shouldShow = await shouldShowDashboardNow();
      setIsFirstLoadToday(shouldShow);
      setShowDashboard(shouldShow);

      // Refresh tab badges from notification data
      await refreshTabBadges();

      console.log(`📊 Dashboard status: shouldShow=${shouldShow}`);
    } catch (error) {
      console.error('❌ Error checking dashboard status:', error);
    }
  };

  // Handle dashboard open (from swipe-down gesture)
  const handleDashboardOpen = () => {
    setShowDashboard(true);
  };

  // Handle dashboard close
  const handleDashboardClose = async () => {
    setShowDashboard(false);

    // Mark as dismissed if it was first load
    if (isFirstLoadToday) {
      await markDashboardDismissedToday();
      setIsFirstLoadToday(false);
    }

    // Refresh tab badges after dashboard interaction
    await refreshTabBadges();
  };

  // Handle category selection change
  const handleCategoriesChange = useCallback((categories: string[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategories(categories);

    // Refresh recommendations with new categories
    fetchRecommendations(true);

    // Save to database (debounced)
    if (user) {
      setTimeout(async () => {
        try {
          const prefs = (user.preferences as UserPreferences) || {};
          await supabase
            .from('users')
            .update({
              preferences: {
                ...prefs,
                preferred_categories: categories,
              }
            })
            .eq('id', user.id);
        } catch (error) {
          console.error('Error saving category preferences:', error);
        }
      }, 1000);
    }
  }, [user, fetchRecommendations]);

  // Handle clear all filters
  const handleClearAllFilters = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset all filters to defaults
    setFilters({
      timeOfDay: 'any',
      maxDistance: 100,
      priceRange: 'any',
    });

    // Clear category filter
    setSelectedCategories([]);

    // Reset to for_you mode (optional - keep user preference)
    // setDiscoveryMode('for_you');

    // Refresh feed
    fetchRecommendations(true);
  }, [fetchRecommendations]);

  // Handle filter sheet apply
  const handleFilterSheetApply = useCallback((newFilters: FilterSheetFilters) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Sync with FeedFilters bar for consistency
    setFilters(prev => ({
      ...prev,
      timeOfDay: newFilters.timeOfDay,
      maxDistance: newFilters.maxDistance,
      priceRange: newFilters.priceRange,
    }));

    // Sync categories
    setSelectedCategories(newFilters.categories);
  }, []);

  // Handle filter sheet reset
  const handleFilterSheetReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const defaultFilters: FilterSheetFilters = {
      mode: 'for_you', // Reset to default For You mode
      categories: [],
      maxDistance: 100,
      priceRange: 'any',
      minRating: 0,
      timeOfDay: 'any',
    };
    setFilterSheetFilters(defaultFilters);

    // Also sync with FeedFilters
    setFilters({
      timeOfDay: 'any',
      maxDistance: 100,
      priceRange: 'any',
    });
    setSelectedCategories([]);
  }, []);

  // Animated styles (must be defined before any conditional returns to follow Rules of Hooks)
  const welcomeMessageStyle = useAnimatedStyle(() => {
    return {
      opacity: welcomeOpacity.value,
      maxHeight: welcomeHeight.value,
      paddingVertical: welcomeHeight.value > 0 ? Spacing.md : 0,
    };
  });

  const feedStyle = useAnimatedStyle(() => {
    return {
      opacity: feedOpacity.value,
    };
  });

  const filtersStyle = useAnimatedStyle(() => {
    return {
      height: filtersHeight.value,
      opacity: interpolate(filtersHeight.value, [0, 90], [0, 1], Extrapolate.CLAMP),
      overflow: 'hidden',
    };
  });

  // Render loading state
  if (loading) {
    return (
      <SwipeableLayout disableLeftEdgeSwipe>
        <GestureDetector gesture={menuEdgeGesture}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Animated.View style={[styles.container, { backgroundColor: colors.background }, menuContentStyle]}>
          <LoopHeader
            showProfileAvatar={true}
            onProfilePress={() => { setMenuGestureControlled(false); setShowMainMenu(true); }}
            showSearchButton={true}
            onSearchPress={() => setShowAdvancedSearch(true)}
            hasActiveFilters={isFilterSheetActive}

            onMenuDrag={handleHeaderMenuDrag}
            onMenuDragEnd={handleHeaderMenuDragEnd}
            menuProgress={menuProgress}
          />
          {seedingCity ? (
            <View style={[styles.seedingContainer, { backgroundColor: colors.background }]}>
              <ActivityIndicator size="large" color={BrandColors.loopBlue} style={{ marginBottom: Spacing.lg }} />
              <Text style={[Typography.headlineSmall, { color: colors.text, textAlign: 'center', marginBottom: Spacing.sm }]}>
                Setting up recommendations for {cityName}...
              </Text>
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center', maxWidth: 300 }]}>
                This may take 1-2 minutes as we discover the best places in your city.
              </Text>
            </View>
          ) : (
            <FlatList
              data={[1, 2, 3]}
              renderItem={() => <ActivityCardSkeleton />}
              keyExtractor={(item) => `skeleton-${item}`}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
          {/* Blur overlay for menu transition */}
          <AnimatedBlurView
            animatedProps={menuBlurAnimatedProps}
            tint="dark"
            experimentalBlurMethod={ANDROID_BLUR_METHOD}
            style={[StyleSheet.absoluteFill, menuBlurOverlayStyle]}
            pointerEvents="none"
          />
        </Animated.View>
        </View>
        </GestureDetector>
      </SwipeableLayout>
    );
  }

  // Render empty state
  if (recommendations.length === 0) {
    return (
      <SwipeableLayout disableLeftEdgeSwipe>
        <GestureDetector gesture={menuEdgeGesture}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Animated.View style={[styles.container, { backgroundColor: colors.background }, menuContentStyle]}>
          <LoopHeader
            showProfileAvatar={true}
            onProfilePress={() => { setMenuGestureControlled(false); setShowMainMenu(true); }}
            showSearchButton={true}
            onSearchPress={() => setShowAdvancedSearch(true)}
            hasActiveFilters={isFilterSheetActive}

            onMenuDrag={handleHeaderMenuDrag}
            onMenuDragEnd={handleHeaderMenuDragEnd}
            menuProgress={menuProgress}
          />
          <EmptyState
            icon="sparkles"
            title="No recommendations yet"
            message="Pull down to refresh and find activities near you"
          />
          {/* Blur overlay for menu transition */}
          <AnimatedBlurView
            animatedProps={menuBlurAnimatedProps}
            tint="dark"
            experimentalBlurMethod={ANDROID_BLUR_METHOD}
            style={[StyleSheet.absoluteFill, menuBlurOverlayStyle]}
            pointerEvents="none"
          />
        </Animated.View>
        </View>
        </GestureDetector>
      </SwipeableLayout>
    );
  }

  // Render recommendations list
  return (
    <SwipeableLayout disableLeftEdgeSwipe>
      <GestureDetector gesture={menuEdgeGesture}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Animated.View style={[styles.container, { backgroundColor: colors.background }, menuContentStyle]}>
        <LoopHeader
          showProfileAvatar={true}
          onProfilePress={() => { setMenuGestureControlled(false); setShowMainMenu(true); }}
          showSearchButton={true}
          onSearchPress={() => setShowAdvancedSearch(true)}
          hasActiveFilters={isFilterSheetActive}

          onMenuDrag={handleHeaderMenuDrag}
          onMenuDragEnd={handleHeaderMenuDragEnd}
          menuProgress={menuProgress}
          onLogoPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }}
          isLoading={USE_SHIMMER_FOR_REFRESH && refreshing}
        />

        {/* Trial Badge (for trialing users) */}
        {dailyLimitInfo?.trialStatus?.isTrialing && (
          <TouchableOpacity
            style={styles.trialBadge}
            onPress={() => router.push('/(tabs)/settings')}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[BrandColors.loopGreen, BrandColors.loopBlue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.trialBadgeGradient}
            >
              <Ionicons name="star" size={12} color="#FFFFFF" />
              <Text style={styles.trialBadgeText}>
                Plus Trial: {dailyLimitInfo.trialStatus.daysLeft} day{dailyLimitInfo.trialStatus.daysLeft === 1 ? '' : 's'} left
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Welcome Message */}
        <Animated.View style={[styles.welcomeContainer, welcomeMessageStyle]}>
          <Text style={[
            styles.welcomeText,
            { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.65)' }
          ]}>
            {welcomeMessage}
          </Text>
        </Animated.View>

        {/* Inline feedback card — one activity at a time (replaces old batch banner) */}
        {nextFeedbackActivity && !feedbackBannerDismissed && (
          <View style={[styles.feedbackCard, { backgroundColor: colors.card }]}>
            <View style={styles.feedbackCardHeader}>
              <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                How was your visit?
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setNextFeedbackActivity(null);
                  setFeedbackBannerDismissed(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>Skip</Text>
              </TouchableOpacity>
            </View>
            <Text style={[Typography.titleMedium, { color: colors.text, marginBottom: 4 }]} numberOfLines={1}>
              {nextFeedbackActivity.activityName}
            </Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginBottom: Spacing.md }]}>
              {nextFeedbackActivity.activityCategory}
              {nextFeedbackActivity.completedAt ? ` \u00B7 ${new Date(nextFeedbackActivity.completedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}
            </Text>
            <View style={styles.feedbackCardActions}>
              <TouchableOpacity
                style={[styles.feedbackThumbBtn, { backgroundColor: BrandColors.loopGreen + '15' }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  // Set the activity and open feedback modal for full feedback flow
                  setFeedbackActivity({
                    activityId: nextFeedbackActivity.activityId || '',
                    activityName: nextFeedbackActivity.activityName,
                    completedAt: nextFeedbackActivity.completedAt,
                  });
                  setShowFeedbackModal(true);
                  setNextFeedbackActivity(null);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="thumbs-up" size={22} color={BrandColors.loopGreen} />
                <Text style={[Typography.labelMedium, { color: BrandColors.loopGreen, marginLeft: 6 }]}>Loved it</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.feedbackThumbBtn, { backgroundColor: '#FF6B6B15' }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setFeedbackActivity({
                    activityId: nextFeedbackActivity.activityId || '',
                    activityName: nextFeedbackActivity.activityName,
                    completedAt: nextFeedbackActivity.completedAt,
                  });
                  setShowFeedbackModal(true);
                  setNextFeedbackActivity(null);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="thumbs-down" size={22} color="#FF6B6B" />
                <Text style={[Typography.labelMedium, { color: '#FF6B6B', marginLeft: 6 }]}>Not great</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Collapsible Filters (push cards down when visible) */}
        <Animated.View style={filtersStyle}>
          <FeedFiltersBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onInteraction={handleFilterInteraction}
          />
        </Animated.View>

        {/* Feed with gesture to reveal filters */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={{ flex: 1 }}>
            <FeedList
              data={blendedFeed}
              renderItem={renderItem}
              flatListRef={flatListRef}
              handleScroll={handleScroll}
              onScrollBeginDrag={handleScrollBeginDrag}
              onScrollEndDrag={handleScrollEndDrag}
              onViewableItemsChanged={onViewableItemsChanged.current}
              viewabilityConfig={viewabilityConfig.current}
              feedStyle={feedStyle}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              onEndReached={handleLoadMore}
              loadingMore={loadingMore}
              feedExhausted={feedExhausted}
              searchRadius={searchRadius}
              extraData={`${refreshKey}`}
              useShimmer={USE_SHIMMER_FOR_REFRESH}
              filters={filters}
              onExpandDistance={handleExpandDistance}
              onRemoveDistanceFilter={handleRemoveDistanceFilter}
            />
          </Animated.View>
        </GestureDetector>

        {/* Schedule Modal */}
        {selectedRecommendation && (
          <SchedulePlanModal
            visible={showScheduleModal}
            onClose={() => setShowScheduleModal(false)}
            onSchedule={handleScheduleConfirm}
            activity={selectedRecommendation.activity || null}
            recommendation={selectedRecommendation}
          />
        )}

        {/* See Details Modal */}
        {selectedRecommendation && (
          <SeeDetailsModal
            visible={showDetailsModal}
            recommendation={selectedRecommendation}
            onClose={() => {
              setShowDetailsModal(false);
              setDetailsScrollToComments(false);
            }}
            onAddToCalendar={() => {
              setShowDetailsModal(false);
              setShowScheduleModal(true);
            }}
            userId={user?.id}
            scrollToComments={detailsScrollToComments}
          />
        )}

        {/* Block Activity Modal */}
        {selectedRecommendation && (
          <BlockActivityModal
            visible={showBlockModal}
            placeName={selectedRecommendation.title}
            onConfirm={handleBlockConfirm}
            onCancel={() => setShowBlockModal(false)}
          />
        )}

        {/* Conflict Warning Modal */}
        <ConflictWarningModal
          visible={showConflictModal}
          conflictType={conflictType}
          conflictingTask={conflictingTask}
          travelDetails={travelDetails}
          onCancel={handleConflictCancel}
          onReplaceTask={handleConflictReplaceTask}
          onChangeTime={handleConflictChangeTime}
          onDeletePrevious={handleConflictReplaceTask} // Same handler for now
        />

        {/* Activity Feedback Modal - Keep mounted to ensure proper cleanup */}
        <ActivityFeedbackModal
          visible={showFeedbackModal && feedbackActivity !== null}
          activityName={feedbackActivity?.activityName || ''}
          activityId={feedbackActivity?.activityId || ''}
          onClose={() => {
            console.log('📱 Feedback modal closing, resetting state');
            setShowFeedbackModal(false);
            setFeedbackActivity(null);
            // Refresh tab badges after feedback submission
            refreshTabBadges();
          }}
          onSubmit={handleFeedbackSubmit}
        />

        {/* Toast Notification */}
        <ToastNotification
          visible={showToast}
          message={toastMessage}
          icon="checkmark-circle"
          onComplete={() => setShowToast(false)}
        />

        {/* Daily Dashboard Modal */}
        <DailyDashboardModal
          visible={showDashboard}
          onClose={handleDashboardClose}
          isFirstLoadToday={isFirstLoadToday}
          selectedCategories={selectedCategories}
          onCategoriesChange={handleCategoriesChange}
          filters={filters}
          onClearAllFilters={handleClearAllFilters}
        />

        {/* Advanced Search Modal */}
        <AdvancedSearchModal
          visible={showAdvancedSearch}
          onClose={() => setShowAdvancedSearch(false)}
          onApplyFilters={handleApplyAdvancedFilters}
          currentFilters={activeFilters ? { ...activeFilters, discoveryMode: 'for_you' } : { discoveryMode: 'for_you' }}
          userLocation={
            user
              ? {
                  latitude: userLocation?.lat || 0,
                  longitude: userLocation?.lng || 0,
                }
              : undefined
          }
        />

        {/* Notifications Tray Modal */}
        <NotificationsTrayModal
          visible={showNotificationsTray}
          onClose={() => setShowNotificationsTray(false)}
          onFeedbackRequest={handleNotificationFeedbackRequest}
        />

        {/* Profile Drawer (formerly Main Menu) */}
        <MainMenuModal
          visible={showMainMenu}
          onClose={handleCloseMenu}

          onOpenDashboard={() => setShowDashboard(true)}
          onOpenHistory={() => setShowHistory(true)}
          gestureControlled={menuGestureControlled}
        />

        {/* Recommendation History Modal */}
        <RecommendationHistoryModal
          visible={showHistory}
          onClose={() => setShowHistory(false)}
        />

        {/* Share Bottom Sheet */}
        <ShareBottomSheet
          visible={shareSheetVisible}
          onClose={() => setShareSheetVisible(false)}
          recommendation={shareRecommendation}
          onShareSuccess={() => {
            setToastMessage('Shared successfully!');
            setShowToast(true);
          }}
        />

        {/* Add to Radar Sheet (from card action menu) */}
        <AddRadarSheet
          visible={showRadarSheet}
          onClose={() => {
            setShowRadarSheet(false);
            setRadarPrefill(undefined);
          }}
          onRadarCreated={() => {
            setToastMessage('Radar created!');
            setShowToast(true);
          }}
          tier={(user?.subscription_tier as 'free' | 'plus') || 'free'}
          prefillData={radarPrefill}
          onUpgrade={() => {
            setShowRadarSheet(false);
            router.push('/paywall');
          }}
        />

        {/* Upgrade Prompt Modal (tier gating) */}
        <UpgradePromptModal
          visible={upgradeModalVisible}
          onClose={() => setUpgradeModalVisible(false)}
          feature={upgradeModalFeature}
          onUpgrade={() => {
            setUpgradeModalVisible(false);
            router.push('/paywall');
          }}
        />

        {/* Blur overlay for menu transition */}
        <AnimatedBlurView
          animatedProps={menuBlurAnimatedProps}
          tint="dark"
          experimentalBlurMethod={ANDROID_BLUR_METHOD}
          style={[StyleSheet.absoluteFill, menuBlurOverlayStyle]}
          pointerEvents="none"
        />
      </Animated.View>
      </View>
      </GestureDetector>
    </SwipeableLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  welcomeContainer: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  welcomeText: {
    fontSize: 17,
    fontFamily: 'Urbanist-Light',
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 24,
  },
  trialBadge: {
    alignSelf: 'center',
    marginBottom: Spacing.xs,
    borderRadius: 20,
    overflow: 'hidden',
  },
  trialBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    gap: 4,
  },
  trialBadgeText: {
    ...Typography.labelSmall,
    color: '#FFFFFF',
    fontFamily: 'Urbanist-SemiBold',
  },
  feedbackCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: 14,
  },
  feedbackCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  feedbackCardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  feedbackThumbBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: 10,
  },
  feedbackBannerLegacy: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
  },
  feedbackBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackBannerClose: {
    marginLeft: Spacing.sm,
    padding: 2,
  },
  listContent: {
    paddingHorizontal: 0, // Cards handle their own margins for edge-to-edge feel
    paddingTop: Spacing.xs, // Minimal top padding
    paddingBottom: 100, // Account for tab bar + safe area
  },
  exhaustedContainer: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  exhaustedText: {
    fontSize: 15,
    fontFamily: 'Urbanist-Medium',
    textAlign: 'center',
    lineHeight: 22,
  },
  continueScrollContainer: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  continueScrollText: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Phase 1.5: Distance Filter Exhaustion UI
  exhaustionCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl * 2,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.03)', // Will be overridden by theme colors
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)', // Will be overridden by theme colors
  },
  exhaustionActions: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
    width: '100%',
  },
  exhaustionButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  // Phase 5: City cache seeding loading state
  seedingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
});

