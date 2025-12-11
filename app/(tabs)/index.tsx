import { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ActivityCardIntelligent } from '@/components/activity-card-intelligent';
import { ActivityCardSkeleton } from '@/components/skeleton-loader';
import { EmptyState } from '@/components/empty-state';
import { SuccessAnimation } from '@/components/success-animation';
import { LoopHeader } from '@/components/loop-header';
import { SchedulePlanModal } from '@/components/schedule-plan-modal';
import { SeeDetailsModal } from '@/components/see-details-modal';
import { DailyDashboardModal } from '@/components/daily-dashboard-modal';
import { SwipeableLayout } from './swipeable-layout';
import { Recommendation } from '@/types/activity';
import { generateRecommendations, type RecommendationParams } from '@/services/recommendations';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BrandColors } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import { getCurrentLocation } from '@/services/location-service';
import { handleError } from '@/utils/error-handler';
import { shouldShowDashboardNow, markDashboardDismissedToday } from '@/utils/dashboard-tracker';
import { getUnreadNotificationCount } from '@/services/dashboard-aggregator';
import { loadRecommendationsFromDB, saveRecommendationsToDB, clearPendingRecommendations, markAsAccepted } from '@/services/recommendation-persistence';

// Type for lat/lng coordinates
type PlaceLocation = { lat: number; lng: number };

export default function RecommendationFeedScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Dashboard state
  const [showDashboard, setShowDashboard] = useState(false);
  const [isFirstLoadToday, setIsFirstLoadToday] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // Welcome message animation
  const welcomeOpacity = useSharedValue(0);
  const welcomeHeight = useSharedValue(0); // Start with 0 height
  const feedOpacity = useSharedValue(0); // Feed starts invisible
  const flatListRef = useRef<FlatList>(null);

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

  // Welcome message animation - shows for 5 seconds then fades
  useEffect(() => {
    if (recommendations.length > 0) {
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
    }
  }, [recommendations.length]);

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

  // Render loading state
  if (loading) {
    return (
      <SwipeableLayout>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <LoopHeader
            onDashboardOpen={handleDashboardOpen}
            notificationCount={notificationCount}
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
          onDashboardOpen={handleDashboardOpen}
          notificationCount={notificationCount}
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

        <Animated.FlatList
          ref={flatListRef}
          data={recommendations}
          renderItem={({ item, index }) => (
            <ActivityCardIntelligent
              recommendation={item}
              onAddToCalendar={() => handleAddToCalendar(item, index)}
              onSeeDetails={() => handleSeeDetails(item, index)}
              index={index}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchRecommendations(true)}
              tintColor={BrandColors.loopBlue}
              colors={[BrandColors.loopBlue]}
            />
          }
          style={feedStyle}
        />

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

