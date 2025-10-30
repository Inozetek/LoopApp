import { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ActivityCardIntelligent } from '@/components/activity-card-intelligent';
import { ActivityCardSkeleton } from '@/components/skeleton-loader';
import { EmptyState } from '@/components/empty-state';
import { SuccessAnimation } from '@/components/success-animation';
import { LoopHeader } from '@/components/loop-header';
import { SchedulePlanModal } from '@/components/schedule-plan-modal';
import { SwipeableLayout } from './swipeable-layout';
import { Recommendation } from '@/types/activity';
import { generateRecommendations, type RecommendationParams } from '@/services/recommendations';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BrandColors } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import { getCurrentLocation } from '@/services/location-service';
import { handleError } from '@/utils/error-handler';

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
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Fetch recommendations
  const fetchRecommendations = async (showRefreshIndicator = false) => {
    if (!user) return;

    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      console.log('🔄 Fetching recommendations...');

      // Get user's current location
      const location = await getCurrentLocation();
      const userLocation: PlaceLocation = {
        lat: location.latitude,
        lng: location.longitude,
      };

      console.log(`📍 Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);

      // Get home/work locations if available
      const homeLocation = user.home_location
        ? { lat: (user.home_location as any).coordinates[1], lng: (user.home_location as any).coordinates[0] }
        : undefined;

      const workLocation = user.work_location
        ? { lat: (user.work_location as any).coordinates[1], lng: (user.work_location as any).coordinates[0] }
        : undefined;

      // Generate recommendations
      const params: RecommendationParams = {
        user,
        userLocation,
        homeLocation,
        workLocation,
        maxResults: 25,
      };

      const scored = await generateRecommendations(params);

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
        openNow: s.place.opening_hours?.open_now,
        isSponsored: s.isSponsored,
        score: s.score,
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
          googlePlaceId: s.place.place_id,
        },
      }));

      console.log(`✅ Generated ${recommendations.length} recommendations`);
      setRecommendations(recommendations);

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
    console.log('See details:', recommendation.title);
    // TODO: Navigate to details screen
  };

  // Handle schedule confirmation
  const handleScheduleConfirm = async (scheduledTime: Date) => {
    if (!selectedRecommendation || !user) return;

    try {
      console.log(`📅 Adding ${selectedRecommendation.title} to calendar`);

      // Add to calendar_events table
      const { error } = await (supabase.from('calendar_events') as any).insert({
        user_id: user.id,
        title: selectedRecommendation.title,
        description: selectedRecommendation.aiExplanation || '',
        category: selectedRecommendation.category.toLowerCase(),
        location: {
          type: 'Point',
          coordinates: [0, 0], // Will be replaced with actual coords
        },
        address: selectedRecommendation.location,
        start_time: scheduledTime.toISOString(),
        end_time: new Date(scheduledTime.getTime() + 60 * 60 * 1000).toISOString(),
        source: 'recommendation',
        status: 'scheduled',
      });

      if (error) throw error;

      // Show success animation
      setShowScheduleModal(false);
      setShowSuccessAnimation(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 2000);

      console.log('✅ Added to calendar');

    } catch (error) {
      console.error('❌ Error adding to calendar:', error);
      handleError(error, 'Failed to add to calendar');
    }
  };

  // Initial load
  useEffect(() => {
    if (user) {
      fetchRecommendations();
    }
  }, [user]);

  // Render loading state
  if (loading) {
    return (
      <SwipeableLayout>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <LoopHeader />
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
          <LoopHeader />
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
        <LoopHeader />

        <FlatList
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
        />

        {/* Schedule Modal */}
        {selectedRecommendation && (
          <SchedulePlanModal
            visible={showScheduleModal}
            onClose={() => setShowScheduleModal(false)}
            onSchedule={handleScheduleConfirm}
            activity={selectedRecommendation.activity || null}
          />
        )}

        {/* Success Animation */}
        <SuccessAnimation
          visible={showSuccessAnimation}
          onComplete={() => setShowSuccessAnimation(false)}
        />
      </View>
    </SwipeableLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
});
