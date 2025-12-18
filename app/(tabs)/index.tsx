import { useState, useEffect, useRef, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, TouchableOpacity } from 'react-native';
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
import * as Haptics from 'expo-haptics';
import { ActivityCardIntelligent } from '@/components/activity-card-intelligent';
import { ActivityCardSkeleton } from '@/components/skeleton-loader';
import { EmptyState } from '@/components/empty-state';
import { SuccessAnimation } from '@/components/success-animation';
import { LoopHeader } from '@/components/loop-header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SchedulePlanModal } from '@/components/schedule-plan-modal';
import { SeeDetailsModal } from '@/components/see-details-modal';
import { DailyDashboardModal } from '@/components/daily-dashboard-modal';
import { BlockActivityModal } from '@/components/block-activity-modal';
import { FeedFiltersBar, type FeedFilters } from '@/components/feed-filters';
import { SwipeableLayout } from './swipeable-layout';
import { Recommendation } from '@/types/activity';
import { generateRecommendations, type RecommendationParams } from '@/services/recommendations';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BrandColors } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import { getCurrentLocation } from '@/services/location-service';
import { handleError } from '@/utils/error-handler';
import { shouldShowDashboardNow, markDashboardDismissedToday } from '@/utils/dashboard-tracker';
import { getUnreadNotificationCount } from '@/services/dashboard-aggregator';
import { loadRecommendationsFromDB, saveRecommendationsToDB, clearPendingRecommendations, markAsAccepted, blockActivity } from '@/services/recommendation-persistence';

// Type for lat/lng coordinates
type PlaceLocation = { lat: number; lng: number };

export default function RecommendationFeedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

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
  const [isAtTop, setIsAtTop] = useState(true);
  const [isFirstCardVisible, setIsFirstCardVisible] = useState(true);
  const [enableRefresh, setEnableRefresh] = useState(false);
  const [hasScrolledAway, setHasScrolledAway] = useState(false);

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
  const hasShownWelcome = useRef<boolean>(false); // Track if welcome message already shown this session
  const enableRefreshTimeout = useRef<NodeJS.Timeout | null>(null);

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

  // Filter recommendations based on user filters
  const filteredRecommendations = (() => {
    const filtered = recommendations.filter((rec) => {
      // Filter by distance
      if (filters.maxDistance < 100) {
        const distanceValue = parseFloat(rec.distance.replace(' mi', ''));
        if (distanceValue > filters.maxDistance) {
          console.log(`🔍 Filtered out ${rec.activity.name}: distance ${distanceValue} > ${filters.maxDistance}`);
          return false;
        }
      }

      // Filter by price range
      if (filters.priceRange !== 'any') {
        if (rec.priceRange !== filters.priceRange) {
          console.log(`🔍 Filtered out ${rec.activity.name}: priceRange ${rec.priceRange} !== ${filters.priceRange}`);
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
            console.log(`🔍 Filtered out ${rec.activity.name}: time ${hour} not in night range`);
            return false;
          }
        } else {
          if (hour < start || hour >= end) {
            console.log(`🔍 Filtered out ${rec.activity.name}: time ${hour} not in ${filters.timeOfDay} range`);
            return false;
          }
        }
      }

      return true;
    });

    console.log(`🔍 Filter results: ${filtered.length} of ${recommendations.length} recommendations passed filters`);
    console.log('🔍 Current filters:', filters);

    // If all cards are filtered out, show all recommendations to prevent empty feed
    if (filtered.length === 0 && recommendations.length > 0) {
      console.log('⚠️ All recommendations filtered out, showing all instead');
      return recommendations;
    }

    return filtered;
  })();

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

      console.log('🔄 Fetching recommendations...');

      // PHASE 1: Try loading from database first (unless force refresh)
      if (!showRefreshIndicator) {
        console.log('📦 Loading cached recommendations from DB...');
        const cachedRecs = await loadRecommendationsFromDB(user.id);
        console.log('📦 DB returned:', cachedRecs?.length || 0, 'recommendations');

        if (cachedRecs && cachedRecs.length > 0) {
          console.log(`✅ Loaded ${cachedRecs.length} recommendations from database`);
          setRecommendations(cachedRecs);
          setLoading(false);
          setRefreshing(false);
          return; // Use cached recommendations
        }
        console.log('📦 No cached recommendations, will fetch fresh');
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
      const userLocation: PlaceLocation = {
        lat: location.latitude,
        lng: location.longitude,
      };

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
      const params: RecommendationParams = {
        user,
        userLocation,
        homeLocation,
        workLocation,
        maxResults: 25,
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

      console.log(`✅ Generated ${recommendations.length} recommendations`);
      setRecommendations(recommendations);

      // PHASE 1: Save recommendations to database
      await saveRecommendationsToDB(user.id, recommendations);

    } catch (error) {
      console.error('❌ Error fetching recommendations:', error);
      handleError(error, 'Failed to load recommendations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle adding activity to calendar
  const handleAddToCalendar = (recommendation: Recommendation, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedRecommendation(recommendation);
    setShowScheduleModal(true);
  };

  // Handle see details
  const handleSeeDetails = (recommendation: Recommendation, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRecommendation(recommendation);
    setShowDetailsModal(true);
  };

  // Handle not interested button
  const handleNotInterested = (recommendation: Recommendation, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRecommendation(recommendation);
    setShowBlockModal(true);
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      console.log(`✅ Blocked ${selectedRecommendation.title}`);
    } catch (error) {
      console.error('Error blocking activity:', error);
      handleError(error, 'Failed to block activity');
    }
  };

  // Handle schedule confirmation
  const handleScheduleConfirm = async (scheduledTime: Date) => {
    if (!selectedRecommendation || !user) return;

    try {
      console.log(`📅 Adding ${selectedRecommendation.title} to calendar`);

      // Add to calendar_events table
      const { data: calendarEvent, error } = await (supabase.from('calendar_events') as any)
        .insert({
          user_id: user.id,
          title: selectedRecommendation.title,
          description: selectedRecommendation.aiExplanation || '',
          category: selectedRecommendation.category.toLowerCase(),
          location: {
            type: 'Point',
            coordinates: [
              selectedRecommendation.activity?.location.longitude || 0,
              selectedRecommendation.activity?.location.latitude || 0
            ],
          },
          address: selectedRecommendation.location,
          start_time: scheduledTime.toISOString(),
          end_time: new Date(scheduledTime.getTime() + 60 * 60 * 1000).toISOString(),
          source: 'recommendation',
          status: 'scheduled',
          google_place_id: selectedRecommendation.activity?.googlePlaceId, // PHASE 1
          feedback_submitted: false, // PHASE 1 (for Phase 5)
        })
        .select()
        .single();

      if (error) throw error;

      // PHASE 1: Mark recommendation as accepted in tracking table
      if (calendarEvent && selectedRecommendation.activity?.googlePlaceId) {
        await markAsAccepted(
          user.id,
          selectedRecommendation.activity.googlePlaceId,
          calendarEvent.id
        );
      }

      // Show success animation
      setShowScheduleModal(false);
      setShowSuccessAnimation(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 2000);

      console.log('✅ Added to calendar and marked as accepted');

    } catch (error) {
      console.error('❌ Error adding to calendar:', error);
      handleError(error, 'Failed to add to calendar');
    }
  };

  // Initial load
  useEffect(() => {
    if (user) {
      fetchRecommendations();
      checkDashboardStatus();
    }
  }, [user]);

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
        welcomeOpacity.value = withTiming(0, { duration: 600 });
        welcomeHeight.value = withTiming(0, { duration: 600 }); // Collapse gap smoothly
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
  };

  // Track scroll position and handle filter reveal/collapse
  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const prevOffset = previousScrollOffset.current;
    scrollY.value = offsetY;
    // isAtTop = true only when at resting position (within 5px of top), not when pulled down
    setIsAtTop(offsetY >= -5 && offsetY <= 5);

    // Reveal filters when pulling down - ONLY if first card is visible
    // This prevents triggering filters when scrolled past the first card
    const justCrossedThreshold =
      isFirstCardVisible && // First card must be visible in viewport
      offsetY < -60 && // Currently below -60 (pulling down)
      prevOffset >= -60 && // Previous offset was above -60 (just crossed)
      prevOffset <= 0 && // Previous offset was at or above top (not from content area)
      !showFilters && // Not already showing
      !refreshing; // Not refreshing

    if (justCrossedThreshold) {
      console.log('🎯 Revealing filters (first card visible, crossed -60 threshold)');
      setShowFilters(true);
      filtersHeight.value = withTiming(90, { duration: 300, easing: Easing.out(Easing.cubic) });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCollapseDelay(4000);
      setLastFilterInteraction(Date.now());
    }

    // Track when user scrolls away from top (into content)
    // Only count as "scrolled away" if filters have collapsed (user truly left the top area)
    if (offsetY > 30 && !showFilters && !hasScrolledAway) {
      setHasScrolledAway(true);
    }

    // Enable RefreshControl only after:
    // 1. Filters have been shown
    // 2. User has scrolled away from top at least once
    // 3. User has returned to top
    // This ensures RefreshControl is never active during initial filter reveal
    if (showFilters && hasScrolledAway && isAtTop && !enableRefresh) {
      console.log('✅ Enabling RefreshControl permanently (after scroll away)');
      setEnableRefresh(true);
    }

    // Collapse filters smoothly when scrolling down (away from top)
    const isScrollingDown = offsetY > 30 && prevOffset >= 0 && prevOffset < offsetY;
    if (isScrollingDown && showFilters) {
      console.log('📜 Scrolling down, collapsing filters');
      setShowFilters(false);
      setEnableRefresh(false); // Reset refresh so next filter reveal is clean
      setHasScrolledAway(false); // Reset scroll tracking
      filtersHeight.value = withTiming(0, {
        duration: 350,
        easing: Easing.inOut(Easing.quad)
      });
    }

    // Update previous scroll offset
    previousScrollOffset.current = offsetY;
  };

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
      // If swiped down more than 60px, reveal filters
      if (event.translationY > 60 && scrollY.value <= 0) {
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
      overflow: 'hidden', // Hide content when collapsed
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
          {showFilters && (
            <FeedFiltersBar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onInteraction={handleFilterInteraction}
            />
          )}
        </Animated.View>

        {/* Feed with gesture to reveal filters */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={{ flex: 1 }}>
            <Animated.FlatList
              ref={flatListRef}
              data={filteredRecommendations}
              renderItem={({ item, index }) => (
                <ActivityCardIntelligent
                  recommendation={item}
                  onAddToCalendar={() => handleAddToCalendar(item, index)}
                  onSeeDetails={() => handleSeeDetails(item, index)}
                  onNotInterested={() => handleNotInterested(item, index)}
                  index={index}
                />
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onViewableItemsChanged={onViewableItemsChanged.current}
              viewabilityConfig={viewabilityConfig.current}
              {...(enableRefresh && {
                refreshControl: (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                      console.log('🔄 Refreshing feed');
                      fetchRecommendations(true);
                    }}
                    tintColor={BrandColors.loopBlue}
                    colors={[BrandColors.loopBlue]}
                    progressViewOffset={200}
                    title=""
                  />
                ),
              })}
              style={feedStyle}
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

        {/* Success Animation */}
        <SuccessAnimation
          visible={showSuccessAnimation}
          onComplete={() => setShowSuccessAnimation(false)}
        />

        {/* Daily Dashboard Modal */}
        <DailyDashboardModal
          visible={showDashboard}
          onClose={handleDashboardClose}
          isFirstLoadToday={isFirstLoadToday}
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
});

