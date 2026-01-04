import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
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
import { BlockActivityModal } from '@/components/block-activity-modal';
import { ActivityFeedbackModal } from '@/components/activity-feedback-modal';
import { ConflictWarningModal } from '@/components/conflict-warning-modal';
import { FeedFiltersBar, type FeedFilters } from '@/components/feed-filters';
import { AdvancedSearchModal, type SearchFilters } from '@/components/advanced-search-modal';
import SwipeableLayout from '@/components/swipeable-layout';
import { Recommendation } from '@/types/activity';
import { generateRecommendations, type RecommendationParams } from '@/services/recommendations';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BrandColors, BorderRadius, Typography } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import { getCurrentLocation } from '@/services/location-service';
import { handleError } from '@/utils/error-handler';
import { shouldShowDashboardNow, markDashboardDismissedToday } from '@/utils/dashboard-tracker';
import { getUnreadNotificationCount } from '@/services/dashboard-aggregator';
import { loadRecommendationsFromDB, saveRecommendationsToDB, clearPendingRecommendations, markAsAccepted, blockActivity } from '@/services/recommendation-persistence';
import { shouldPromptForFeedback, submitFeedback, getRecommendationIdForActivity } from '@/services/feedback-service';
import { checkTimeConflict, canMakeItOnTime } from '@/services/calendar-service';

// Type for lat/lng coordinates
type PlaceLocation = { lat: number; lng: number };

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
        keyExtractor={(item) => item.id}
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
              // With distance filter: Show expand/remove options
              <View style={styles.exhaustionCard}>
                <Ionicons name="location-outline" size={48} color={colors.textSecondary} />
                <Text style={[Typography.headlineSmall, { color: colors.text, marginTop: Spacing.md }]}>
                  You've seen all activities within {filters.maxDistance} miles
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
              // Without filter: Rare case - show refresh suggestion
              <View style={styles.exhaustionCard}>
                <Ionicons name="refresh-outline" size={48} color={colors.textSecondary} />
                <Text style={[Typography.headlineSmall, { color: colors.text, marginTop: Spacing.md }]}>
                  You've reached the end
                </Text>
                <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                  Pull down to refresh for new recommendations
                </Text>
              </View>
            )
          ) : (
            loadingMore ? (
              // Instagram-style shimmer loading for next batch
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

export default function RecommendationFeedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // Loading more recommendations for infinite scroll
  const [feedExhausted, setFeedExhausted] = useState(false); // Track if no more recommendations available
  const [searchRadius, setSearchRadius] = useState(10); // Track expanding search radius (miles)
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render on refresh
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackActivity, setFeedbackActivity] = useState<{
    activityId: string;
    activityName: string;
    completedAt: string;
    recommendationId?: string;
  } | null>(null);
  const [removingCardId, setRemovingCardId] = useState<string | null>(null); // Track card being removed with animation

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
  const [notificationCount, setNotificationCount] = useState(0);

  // Filters state
  const [filters, setFilters] = useState<FeedFilters>({
    timeOfDay: 'any',
    maxDistance: 100, // Any distance
    priceRange: 'any',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [isFirstCardVisible, setIsFirstCardVisible] = useState(true);
  const [collapsingFilters, setCollapsingFilters] = useState(false);

  // Discovery mode & category filter state
  const [discoveryMode, setDiscoveryMode] = useState<'curated' | 'explore'>('curated');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Animated value for filters height
  const filtersHeight = useSharedValue(0);
  const gestureTranslationY = useSharedValue(0);
  const scrollY = useSharedValue(0);

  // Welcome message animation
  const welcomeOpacity = useSharedValue(0);
  const welcomeHeight = useSharedValue(0); // Start with 0 height
  const feedOpacity = useSharedValue(0); // Feed starts invisible
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

      const savedRadius = user.preferences?.last_search_radius;
      if (savedRadius && savedRadius > 10) {
        console.log(`📍 Restoring saved search radius: ${savedRadius} miles`);
        searchRadiusRef.current = savedRadius;
        setSearchRadius(savedRadius);
      }
    };
    loadSavedRadius();
  }, [user]);

  // Save radius changes to user preferences (Phase 1.4: Radius Persistence)
  useEffect(() => {
    const saveRadius = async () => {
      if (!user || searchRadius <= 10) return;

      try {
        await supabase
          .from('users')
          .update({
            preferences: {
              ...user.preferences,
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
    const filtered = recommendations.filter((rec) => {
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

      return true;
    });

    // If all cards are filtered out, show all recommendations to prevent empty feed
    if (filtered.length === 0 && recommendations.length > 0) {
      return recommendations;
    }

    return filtered;
  }, [recommendations, filters]);

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
  const fetchRecommendations = async (showRefreshIndicator = false) => {
    console.log('🚀 fetchRecommendations called, user:', user?.id);

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

      // PHASE 1: Try loading from database first (unless force refresh)
      if (!showRefreshIndicator) {
        console.log('📦 Loading cached recommendations from DB...');
        const cachedRecs = await loadRecommendationsFromDB(user.id);
        console.log('📦 DB returned:', cachedRecs?.length || 0, 'recommendations');

        if (cachedRecs && cachedRecs.length > 0) {
          // CRITICAL: Validate that cached recommendations have REAL Google Places photos
          // Not just any imageUrl (could be fallback/placeholder)
          const malformedURLs: string[] = [];

          const recsWithRealPhotos = cachedRecs.filter(rec => {
            const hasUrl = rec.imageUrl && rec.imageUrl !== '';
            const isGooglePhoto = hasUrl && rec.imageUrl.includes('places.googleapis.com');

            // CRITICAL: Check for malformed double URLs
            const isMalformed = hasUrl && rec.imageUrl.includes('https://places.googleapis.com/v1/https://');

            if (isMalformed) {
              malformedURLs.push(rec.title);
            }

            return isGooglePhoto && !isMalformed;
          });

          const photoPercentage = (recsWithRealPhotos.length / cachedRecs.length) * 100;
          const malformedCount = malformedURLs.length;

          console.log(`📸 Photo validation: ${recsWithRealPhotos.length}/${cachedRecs.length} cached recs have REAL Google photos (${photoPercentage.toFixed(0)}%)`);

          if (malformedCount > 0) {
            console.log(`🧹 Found ${malformedCount} malformed URLs in cache (${malformedURLs.slice(0, 3).join(', ')}${malformedCount > 3 ? '...' : ''})`);
            console.log(`🧹 Triggering background cleanup and fetching fresh recommendations...`);

            // Trigger cleanup in background (don't wait for it)
            import('@/services/recommendation-persistence').then(({ cleanupMalformedPhotoURLs }) => {
              cleanupMalformedPhotoURLs(user.id).then(cleaned => {
                console.log(`✅ Database cleanup completed: ${cleaned} malformed recs removed`);
              }).catch(error => {
                console.error('❌ Cleanup failed:', error);
              });
            }).catch(err => {
              console.error('❌ Failed to import cleanup function:', err);
            });
          }

          // Only use cache if at least 70% of recommendations have REAL Google photos AND no malformed URLs
          if (photoPercentage >= 70 && malformedCount === 0) {
            console.log(`✅ Loaded ${cachedRecs.length} recommendations from database (photo quality OK)`);
            setRecommendations(cachedRecs);
            setLoading(false);
            setRefreshing(false);
            return; // Use cached recommendations
          } else {
            if (malformedCount > 0) {
              console.log(`⚠️ Cache invalid (${malformedCount} malformed URLs) - fetching fresh...`);
            } else {
              console.log(`⚠️ Cache quality too low (${photoPercentage.toFixed(0)}% have real photos) - fetching fresh...`);
            }
            // Fall through to fetch fresh recommendations
          }
        } else {
          console.log('📦 No cached recommendations, will fetch fresh');
        }
      } else {
        // PHASE 1: User is refreshing - clear old recommendations
        await clearPendingRecommendations(user.id);
        console.log('🔄 Force refresh - generating new recommendations');
      }

      // Log API usage summary before fetching (if API key is enabled)
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
      const homeLocation = user.home_location && (user.home_location as any).coordinates
        ? { lat: (user.home_location as any).coordinates[1], lng: (user.home_location as any).coordinates[0] }
        : undefined;

      const workLocation = user.work_location && (user.work_location as any).coordinates
        ? { lat: (user.work_location as any).coordinates[1], lng: (user.work_location as any).coordinates[0] }
        : undefined;

      console.log('✅ Location parsing complete');
      console.log('🔍 User object keys:', Object.keys(user));
      console.log('🔍 User preferences:', user.preferences);
      console.log('🔍 User interests:', user.interests);

      // Generate recommendations
      // Use filter's maxDistance if set (100 = "any"), otherwise use user preference
      const effectiveMaxDistance = filters.maxDistance < 100
        ? filters.maxDistance
        : (user.preferences?.max_distance_miles || 10);

      const params: RecommendationParams = {
        user,
        userLocation: currentLocation,
        homeLocation,
        workLocation,
        maxDistance: effectiveMaxDistance,
        maxResults: 250, // Extra large batch for extended scrolling before loading
        timeOfDay: filters.timeOfDay !== 'any' ? filters.timeOfDay : undefined,
        priceRange: filters.priceRange !== 'any' ? filters.priceRange : undefined,
        discoveryMode, // Curated vs Explore mode
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
        score: s.score,
        businessHours: s.businessHours,
        hasEstimatedHours: s.hasEstimatedHours,
        suggestedTime: s.suggestedTime, // Phase 1.6a: Use recommendation context time
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
            latitude: s.place.geometry.location.lat,
            longitude: s.place.geometry.location.lng,
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
      }));

      console.log(`✅ Generated ${recommendations.length} recommendations`);
      console.log(`📍 First 3 places:`, recommendations.slice(0, 3).map(r => r.title));

      // If refresh returned 0 results, don't clear the existing recommendations
      if (recommendations.length === 0 && showRefreshIndicator) {
        console.log('⚠️ Refresh returned 0 results, keeping existing recommendations');
        return;
      }

      // PHASE 1: Save recommendations to database BEFORE updating UI
      await saveRecommendationsToDB(user.id, recommendations);
      console.log(`💾 Saved to DB, now updating UI state`);

      setRecommendations(recommendations);
      setRefreshKey(prev => prev + 1); // Force FlatList to recognize new data
      console.log(`✅ UI state updated with ${recommendations.length} recommendations, refreshKey:`, refreshKey + 1);

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
        });
        setShowFeedbackModal(true);
      }
    } catch (error) {
      console.error('Error checking for pending feedback:', error);
    }
  };

  // Cache handlers per item to prevent recreation
  const handlersCache = useRef<Map<string, any>>(new Map());

  const getHandlersForItem = useCallback((item: Recommendation, index: number) => {
    const cacheKey = `${item.id}-${index}`;
    if (!handlersCache.current.has(cacheKey)) {
      handlersCache.current.set(cacheKey, {
        onAddToCalendar: () => handleAddToCalendar(item, index),
        onSeeDetails: () => handleSeeDetails(item, index),
        onNotInterested: () => handleNotInterested(item, index),
      });
    }
    return handlersCache.current.get(cacheKey);
  }, [handleAddToCalendar, handleSeeDetails, handleNotInterested]);

  // Memoized render item to prevent unnecessary re-renders
  const renderItem = useCallback(
    ({ item, index }: { item: Recommendation; index: number }) => {
      const handlers = getHandlersForItem(item, index);
      return (
        <ActivityCardIntelligent
          recommendation={item}
          onAddToCalendar={handlers.onAddToCalendar}
          onSeeDetails={handlers.onSeeDetails}
          onNotInterested={handlers.onNotInterested}
          index={index}
          isRemoving={removingCardId === item.id}
        />
      );
    },
    [getHandlersForItem, removingCardId]
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
        discoveryMode,
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
              latitude: s.place.geometry.location.lat,
              longitude: s.place.geometry.location.lng,
              address: s.place.vicinity || s.place.formatted_address || '',
            },
            distance: s.distance,
            rating: s.place.rating,
            reviewsCount: s.place.user_ratings_total,
            priceRange: s.place.price_level || 2,
            photoUrl: s.photoUrl,
            phone: s.place.formatted_phone_number,
            website: s.place.website,
            hours: s.place.opening_hours,
            tags: s.place.types,
            isSponsored: s.isSponsored,
            googlePlaceId: s.place.place_id,
          },
        }));

        // Smart merge: Add new at top, keep bottom 40 existing (NO divider)
        setRecommendations(prev => [
          ...newRecs,
          ...prev.slice(0, 40) // Keep bottom 40
        ]);

        // Save new recommendations to DB
        await saveRecommendationsToDB(user.id, newRecs);

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

  // Handle load more (infinite scroll)
  const handleLoadMore = useCallback(async () => {
    console.log('🎯 onEndReached fired - attempting to load more recommendations');
    console.log(`🎯 Current state: loadingMore=${loadingMore}, feedExhausted=${feedExhausted}, searchRadius=${searchRadius}, ref=${searchRadiusRef.current}`);

    // CRITICAL: Multi-layer protection against rapid-fire onEndReached calls

    // Layer 1: Ref check (synchronous, blocks immediate duplicate calls)
    if (isLoadingMoreRef.current) {
      console.log('⏸️ Skipping loadMore - ref already locked');
      return;
    }

    // Layer 2: State checks
    if (refreshing || loading || !user) {
      console.log('⏸️ Skipping loadMore - state indicates already loading');
      return;
    }

    // Layer 3: Check if feed is exhausted (use ref to avoid stale closure)
    if (feedExhaustedRef.current) {
      console.log('⏸️ Skipping loadMore - feed already exhausted (ref check)');
      return;
    }

    // Layer 4: Cooldown period (prevent calls within 2 seconds of last call)
    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadMoreTime.current;
    if (timeSinceLastLoad < 2000) {
      console.log(`⏸️ Skipping loadMore - cooldown period (${timeSinceLastLoad}ms < 2000ms)`);
      return;
    }

    // All checks passed - lock and proceed
    isLoadingMoreRef.current = true;
    lastLoadMoreTime.current = now;
    console.log('📜 Loading more recommendations (infinite scroll)...');
    console.log(`📜 Starting with searchRadius=${searchRadius}, ref=${searchRadiusRef.current}, recommendations.length=${recommendations.length}`);
    setLoadingMore(true);

    try {
      // Get user's current location
      const location = await getCurrentLocation();
      const userLocation: PlaceLocation = {
        lat: location.latitude,
        lng: location.longitude,
      };

      // Get home/work locations if available
      const homeLocation = user.home_location && (user.home_location as any).coordinates
        ? { lat: (user.home_location as any).coordinates[1], lng: (user.home_location as any).coordinates[0] }
        : undefined;

      const workLocation = user.work_location && (user.work_location as any).coordinates
        ? { lat: (user.work_location as any).coordinates[1], lng: (user.work_location as any).coordinates[0] }
        : undefined;

      // Build params for recommendations
      // Use filter's maxDistance if set (100 = "any"), otherwise use current searchRadius
      const useFilterDistance = filters.maxDistance < 100;

      // BATCHED LOADING: Fetch large batches for uninterrupted scrolling
      // User scrolls through entire batch smoothly, then brief loading moment for next batch
      const TARGET_COUNT = 250; // Extra large batch = 5-10 min scrolling before loading pause
      // Use setRecommendations callback to get current value
      let existingPlaceIds: Set<string> = new Set();
      setRecommendations(currentRecs => {
        existingPlaceIds = new Set(
          currentRecs
            .map(r => r.activity?.googlePlaceId)
            .filter((id): id is string => Boolean(id))
        );
        console.log(`📋 Current feed has ${currentRecs.length} recommendations with ${existingPlaceIds.size} unique place IDs`);
        console.log(`📋 Place IDs to exclude:`, Array.from(existingPlaceIds).slice(0, 5), existingPlaceIds.size > 5 ? `... and ${existingPlaceIds.size - 5} more` : '');
        return currentRecs;
      });
      const uniqueNewRecommendations: Recommendation[] = [];
      let attempts = 0;
      const MAX_ATTEMPTS = 20; // High limit for metroplex - allows expansion up to 200+ miles

      console.log(`🎯 Target: ${TARGET_COUNT} unique places`);

      // Track current search radius (will expand with each attempt)
      // Use ref to get synchronous access to latest value (not stale closure)
      let currentRadius = useFilterDistance ? filters.maxDistance : searchRadiusRef.current;

      console.log(`🔄 Infinite scroll starting: searchRadius=${searchRadius}, ref=${searchRadiusRef.current}, will expand from ${currentRadius}mi`);
      console.log(`🔄 Filter distance mode: ${useFilterDistance}, filters.maxDistance=${filters.maxDistance}`);

      while (uniqueNewRecommendations.length < TARGET_COUNT && attempts < MAX_ATTEMPTS) {
        attempts++;
        console.log(`📡 Attempt ${attempts}: Searching within ${currentRadius} miles...`);

        const params: RecommendationParams = {
          user,
          userLocation,
          homeLocation,
          workLocation,
          maxDistance: currentRadius, // Use expanding radius
          maxResults: 150, // Large per-category fetch for maximum variety
          excludePlaceIds: Array.from(existingPlaceIds), // Only exclude current feed items
          timeOfDay: filters.timeOfDay !== 'any' ? filters.timeOfDay : undefined,
          priceRange: filters.priceRange !== 'any' ? filters.priceRange : undefined,
          discoveryMode,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        };

        // Generate new recommendations with current radius
        const scored = await generateRecommendations(params);

        if (scored.length === 0) {
          console.log('📭 No more places available from API');
          break;
        }

        console.log(`✅ Fetched ${scored.length} places from API`);

        // Convert ScoredRecommendation[] to Recommendation[]
        const newRecommendations: Recommendation[] = scored.map((s, index) => ({
          id: s.place.place_id || `rec-${Date.now()}-${index}`,
          title: s.place.name,
          category: s.category,
          location: s.place.vicinity || s.place.formatted_address || 'Unknown location',
          distance: `${s.distance.toFixed(1)} mi`,
          priceRange: s.place.price_level || 2,
          rating: s.place.rating || 0,
          imageUrl: s.photoUrl || '',
          photos: s.photoUrls,
          aiExplanation: s.aiExplanation,
          suggestedTime: s.suggestedTime, // Phase 1.6a: Use recommendation context time
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
            id: s.place.place_id || `act-${Date.now()}-${index}`,
            name: s.place.name,
            category: s.category,
            description: s.place.description,
            location: {
              latitude: s.place.geometry.location.lat,
              longitude: s.place.geometry.location.lng,
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
        }));

        // Filter out duplicates (both from existing list and newly collected)
        const allSeenIds = new Set([...existingPlaceIds, ...uniqueNewRecommendations.map(r => r.activity?.googlePlaceId).filter(Boolean)]);

        console.log(`🔍 Checking ${newRecommendations.length} new places against ${allSeenIds.size} seen IDs`);
        console.log(`🔍 Seen IDs (first 5):`, Array.from(allSeenIds).slice(0, 5));
        console.log(`🔍 New place IDs (first 5):`, newRecommendations.slice(0, 5).map(r => r.activity?.googlePlaceId));

        const freshRecommendations = newRecommendations.filter(
          rec => {
            const isDuplicate = allSeenIds.has(rec.activity?.googlePlaceId);
            if (isDuplicate) {
              console.log(`❌ Duplicate found: ${rec.title} (${rec.activity?.googlePlaceId})`);
            }
            return !isDuplicate;
          }
        );

        console.log(`🔍 Found ${freshRecommendations.length} unique places (${newRecommendations.length - freshRecommendations.length} were duplicates)`);

        // Early exit: Only stop if at max radius with no new places after multiple attempts
        if (currentRadius >= 31 && freshRecommendations.length === 0 && attempts >= 3) {
          console.log(`⚠️  At maximum search radius (31mi/50km) with no new unique places after ${attempts} attempts. Stopping search.`);
          break;
        }

        // Add unique ones to our collection
        uniqueNewRecommendations.push(...freshRecommendations);

        console.log(`📊 Progress: ${uniqueNewRecommendations.length}/${TARGET_COUNT} unique places collected`);

        // If we've reached the target, stop fetching
        if (uniqueNewRecommendations.length >= TARGET_COUNT) {
          break;
        }

        // Expand search radius for next attempt (unless using filter distance)
        if (!useFilterDistance && uniqueNewRecommendations.length < TARGET_COUNT) {
          const oldRadius = currentRadius;
          if (currentRadius <= 10) {
            currentRadius = 20;
          } else if (currentRadius <= 20) {
            currentRadius = 30;
          } else if (currentRadius <= 30) {
            currentRadius = 31; // ~50km
          }
          console.log(`🔍 Expanding search radius: ${oldRadius}mi → ${currentRadius}mi`);
        }
      }

      if (uniqueNewRecommendations.length > 0) {
        // Add all unique recommendations (no artificial cap)
        const placesToAdd = uniqueNewRecommendations;

        console.log(`✅ Adding ${placesToAdd.length} new places to feed (no cap applied)`);

        // Reset exhausted flag since we found new places
        if (feedExhaustedRef.current) {
          console.log('🔄 Resetting feedExhausted flag (found new places)');
          setFeedExhausted(false);
          feedExhaustedRef.current = false;
        }

        // Update search radius state AND ref to persist the expanded radius for next scroll
        if (!useFilterDistance) {
          setSearchRadius(currentRadius);
          searchRadiusRef.current = currentRadius; // Update ref synchronously for immediate access
          console.log(`📍 Search radius updated to ${currentRadius} miles (state + ref) for next infinite scroll`);
        }

        // Append all at once
        setRecommendations(prev => {
          const newList = [...prev, ...placesToAdd];
          console.log(`📊 Total recommendations in feed: ${newList.length} (added ${placesToAdd.length} new)`);
          return newList;
        });
        setRefreshKey(prev => prev + 1);

        // Save to database
        await saveRecommendationsToDB(user.id, placesToAdd);
      } else {
        // CRITICAL: Only mark as exhausted if at max radius AND user has distance filter
        if (activeFilters && activeFilters.maxDistance && currentRadius >= activeFilters.maxDistance) {
          console.log(`📭 Exhausted within ${activeFilters.maxDistance}mi filter`);
          setFeedExhausted(true);
          feedExhaustedRef.current = true;
        } else {
          // No filter: Never exhaust, just keep expanding radius
          console.log(`⏸️ No new places at ${currentRadius}mi, will expand on next scroll`);
          // Update radius to continue expanding
          if (!useFilterDistance) {
            const nextRadius = currentRadius + 10; // Expand by 10 miles
            setSearchRadius(nextRadius);
            searchRadiusRef.current = nextRadius;
          }
        }
      }
    } catch (error) {
      console.error('❌ Error loading more recommendations:', error);
    } finally {
      setLoadingMore(false);
      isLoadingMoreRef.current = false; // Reset ref
    }
  }, [refreshing, loading, user, searchRadius, filters]);

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

      // After 5 seconds, fade out welcome and collapse gap
      const timeout = setTimeout(() => {
        welcomeOpacity.value = withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) });
        welcomeHeight.value = withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }); // Collapse gap smoothly
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
    setActiveFilters({ ...(activeFilters || {}), maxDistance: newDistance });
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
    setActiveFilters({ ...(activeFilters || {}), maxDistance: 100 });
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

    // Convert advanced filters to recommendation params and refetch
    setRefreshing(true);

    try {
      if (!user) return;

      // Determine search location (custom location or user's current location)
      const searchLocation = searchFilters.location
        ? { lat: searchFilters.location.latitude, lng: searchFilters.location.longitude }
        : userLocation;

      if (!searchLocation) {
        const location = await getCurrentLocation();
        searchLocation.lat = location.latitude;
        searchLocation.lng = location.longitude;
      }

      // Build recommendation params with advanced filters
      const params: RecommendationParams = {
        user,
        userLocation: searchLocation,
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
        discoveryMode, // Use global discovery mode setting
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
            latitude: s.place.geometry.location.lat,
            longitude: s.place.geometry.location.lng,
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
      }));

      console.log(`✅ Generated ${recommendations.length} filtered recommendations`);

      // Update state
      setRecommendations(recommendations);
      setRefreshKey(prev => prev + 1);

      // Save to database
      await saveRecommendationsToDB(user.id, recommendations);

      // Show toast with filter summary
      const filterSummary = [];
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

  // Check if dashboard should show on first load
  const checkDashboardStatus = async () => {
    if (!user) return;

    try {
      // Check if should show dashboard today
      const shouldShow = await shouldShowDashboardNow();
      setIsFirstLoadToday(shouldShow);
      setShowDashboard(shouldShow);

      // Fetch notification count
      const count = await getUnreadNotificationCount(user.id);
      setNotificationCount(count);

      console.log(`📊 Dashboard status: shouldShow=${shouldShow}, notifications=${count}`);
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

    // Refresh notification count
    if (user) {
      const count = await getUnreadNotificationCount(user.id);
      setNotificationCount(count);
    }
  };

  // Handle discovery mode change
  const handleDiscoveryModeChange = useCallback((mode: 'curated' | 'explore') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDiscoveryMode(mode);

    // Refresh recommendations with new mode
    fetchRecommendations(true);

    // Save to database (debounced)
    if (user) {
      setTimeout(async () => {
        try {
          await supabase
            .from('users')
            .update({
              preferences: {
                ...user.preferences,
                discovery_mode: mode,
              }
            })
            .eq('id', user.id);
        } catch (error) {
          console.error('Error saving discovery mode:', error);
        }
      }, 1000);
    }
  }, [user, fetchRecommendations]);

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
          await supabase
            .from('users')
            .update({
              preferences: {
                ...user.preferences,
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

    // Reset to curated mode (optional - keep user preference)
    // setDiscoveryMode('curated');

    // Refresh feed
    fetchRecommendations(true);
  }, [fetchRecommendations]);

  // Animated styles (must be defined before any conditional returns to follow Rules of Hooks)
  const welcomeMessageStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      welcomeOpacity.value,
      [0, 1],
      [0.95, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity: welcomeOpacity.value,
      maxHeight: welcomeHeight.value,
      paddingVertical: welcomeHeight.value > 0 ? Spacing.md : 0,
      transform: [{ scale }]
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
      <SwipeableLayout>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <LoopHeader
            onDashboardOpen={handleDashboardOpen}
            notificationCount={notificationCount}
            onSettingsPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/settings');
            }}
          />
          <FlatList
            data={[1, 2, 3]}
            renderItem={() => <ActivityCardSkeleton />}
            keyExtractor={(item) => `skeleton-${item}`}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </SwipeableLayout>
    );
  }

  // Render empty state
  if (recommendations.length === 0) {
    return (
      <SwipeableLayout>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <LoopHeader
            onDashboardOpen={handleDashboardOpen}
            notificationCount={notificationCount}
            onSettingsPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/settings');
            }}
          />
          <EmptyState
            icon="sparkles"
            title="No recommendations yet"
            message="Pull down to refresh and find activities near you"
          />
        </View>
      </SwipeableLayout>
    );
  }

  // Render recommendations list
  return (
    <SwipeableLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoopHeader
          showProfileButton={true}
          onProfilePress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(tabs)/profile');
          }}
          onDashboardOpen={handleDashboardOpen}
          notificationCount={notificationCount}
          onSettingsPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(tabs)/settings');
          }}
          onLogoPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowAdvancedSearch(true);
          }}
          isLoading={loadingMore || (USE_SHIMMER_FOR_REFRESH && refreshing)}
        />

        {/* Welcome Message */}
        <Animated.View style={[styles.welcomeContainer, welcomeMessageStyle]}>
          <Text style={[
            styles.welcomeText,
            { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.65)' }
          ]}>
            {welcomeMessage}
          </Text>
        </Animated.View>

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
              data={filteredRecommendations}
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
              extraData={refreshKey}
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
            onClose={() => setShowDetailsModal(false)}
            onAddToCalendar={() => {
              setShowDetailsModal(false);
              setShowScheduleModal(true);
            }}
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
          discoveryMode={discoveryMode}
          onDiscoveryModeChange={handleDiscoveryModeChange}
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
          currentFilters={activeFilters || undefined}
          userLocation={
            user
              ? {
                  latitude: userLocation?.lat || 0,
                  longitude: userLocation?.lng || 0,
                }
              : undefined
          }
        />
      </View>
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
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs, // Minimal top padding
    paddingBottom: Spacing.xl,
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
});

