/**
 * See Details Modal - Rich Activity Details with AI Insights
 * Shows comprehensive information about a recommended activity
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Alert,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Recommendation } from '@/types/activity';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors, ScoreBarColors } from '@/constants/brand';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getStaticMapUrl } from '@/utils/maps';
import { AFFILIATE_CONFIG } from '@/constants/affiliate-config';
import { getPlaceReviews, type PlaceReview } from '@/services/google-places';
import { extractReviewTopics, type ReviewTopic } from '@/utils/review-topics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const IMAGE_HEIGHT = 300;

interface SeeDetailsModalProps {
  visible: boolean;
  recommendation: Recommendation | null;
  onClose: () => void;
  onAddToCalendar: () => void;
}

/**
 * Detailed 5-Bar Score Graph Component
 * Shows all score components: Interest, Location, Timing, Feedback, Collaborative
 */
interface DetailedScoreGraphProps {
  scoreBreakdown: {
    baseScore: number;
    locationScore: number;
    timeScore: number;
    feedbackScore: number;
    collaborativeScore: number;
  };
}

function DetailedScoreGraph({ scoreBreakdown }: DetailedScoreGraphProps) {
  const bars = [
    { label: 'Interest Match', value: scoreBreakdown.baseScore, max: 40, color: ScoreBarColors.interest },
    { label: 'Location', value: scoreBreakdown.locationScore, max: 20, color: ScoreBarColors.location },
    { label: 'Timing', value: scoreBreakdown.timeScore, max: 15, color: ScoreBarColors.time },
    { label: 'Past Feedback', value: scoreBreakdown.feedbackScore, max: 15, color: ScoreBarColors.feedback },
    { label: 'Similar Users', value: scoreBreakdown.collaborativeScore, max: 10, color: ScoreBarColors.social },
  ];

  const totalScore = scoreBreakdown.baseScore +
                     scoreBreakdown.locationScore +
                     scoreBreakdown.timeScore +
                     scoreBreakdown.feedbackScore +
                     scoreBreakdown.collaborativeScore;

  const maxPossible = 100;

  return (
    <View style={styles.detailedGraph}>
      <View style={styles.graphHeader}>
        <Text style={styles.graphTitle}>Match Score Breakdown</Text>
        <Text style={styles.graphTotal}>{Math.round(totalScore)}/100</Text>
      </View>

      {bars.map((bar, index) => {
        const percentage = (bar.value / bar.max) * 100;
        return (
          <View key={index} style={styles.detailedBarContainer}>
            <View style={styles.barLabelRow}>
              <Text style={styles.detailedBarLabel}>{bar.label}</Text>
              <Text style={styles.barScore}>{bar.value}/{bar.max}</Text>
            </View>
            <View style={styles.detailedBarBackground}>
              <View
                style={[
                  styles.detailedBarFill,
                  {
                    width: `${percentage}%`,
                    backgroundColor: bar.color,
                  }
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Photo Carousel Component (Reused from activity card)
 */
interface PhotoCarouselProps {
  photos: string[];
}

function PhotoCarousel({ photos }: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const onScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={styles.carouselImage}
            resizeMode="cover"
          />
        )}
        keyExtractor={(item, index) => `modal-photo-${index}`}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Pagination dots */}
      {photos.length > 1 && (
        <View style={styles.paginationContainer}>
          {photos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                { opacity: index === currentIndex ? 1 : 0.4 }
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function SeeDetailsModal({
  visible,
  recommendation,
  onClose,
  onAddToCalendar,
}: SeeDetailsModalProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Reviews state
  const [reviews, setReviews] = useState<PlaceReview[]>([]);
  const [reviewTopics, setReviewTopics] = useState<ReviewTopic[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Fetch reviews when modal opens for non-event recommendations
  useEffect(() => {
    const googlePlaceId = recommendation?.activity?.googlePlaceId;
    const isEvent = !!(recommendation as any)?.event_metadata?.event_url;

    if (visible && !isEvent && googlePlaceId) {
      const fetchReviews = async () => {
        setLoadingReviews(true);
        try {
          const placeReviews = await getPlaceReviews(googlePlaceId);
          setReviews(placeReviews);

          // Extract topics from reviews
          const topics = extractReviewTopics(placeReviews);
          setReviewTopics(topics);
        } catch (error) {
          console.error('Failed to fetch reviews:', error);
          setReviews([]);
          setReviewTopics([]);
        } finally {
          setLoadingReviews(false);
        }
      };

      fetchReviews();
    } else {
      // Reset reviews when modal closes or for events
      setReviews([]);
      setReviewTopics([]);
    }
  }, [visible, recommendation?.activity?.googlePlaceId]);

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

  if (!recommendation) return null;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleAddToCalendar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    onAddToCalendar();
  };

  const getPriceDisplay = (priceRange?: number) => {
    if (!priceRange || priceRange === 0) return 'Free';
    return '$'.repeat(Math.max(1, priceRange));
  };

  const formatEventDateTime = (dateTimeString: string) => {
    try {
      const eventDate = new Date(dateTimeString);
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      };
      return eventDate.toLocaleDateString('en-US', options);
    } catch {
      return dateTimeString;
    }
  };

  // Fallback image
  const imageSource = recommendation.imageUrl
    ? { uri: recommendation.imageUrl }
    : require('@/assets/images/loop-logo6.png');

  // Photos for carousel
  const photos = recommendation.photos && recommendation.photos.length >= 3
    ? recommendation.photos
    : recommendation.imageUrl
    ? [recommendation.imageUrl]
    : [];

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.modalContainer,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={[styles.modal, { backgroundColor: colors.card }]}>
          {/* Close Button */}
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <IconSymbol name="xmark.circle.fill" size={32} color={colors.text} />
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Hero Image or Carousel */}
            {photos.length > 0 ? (
              photos.length >= 3 ? (
                <PhotoCarousel photos={photos} />
              ) : (
                <Image source={imageSource} style={styles.heroImage} resizeMode="cover" />
              )
            ) : (
              <Image source={imageSource} style={styles.heroImage} resizeMode="cover" />
            )}

            {/* Content Section */}
            <View style={styles.content}>
              {/* Title and Category */}
              <View style={styles.header}>
                <Text style={[styles.title, Typography.titleLarge, { color: colors.text }]}>
                  {recommendation.title}
                </Text>
                <View style={[styles.categoryBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.categoryText}>{recommendation.category}</Text>
                </View>
              </View>

              {/* Metadata Row */}
              <View style={styles.metadata}>
                {recommendation.rating != null && recommendation.rating > 0 && (
                  <>
                    <IconSymbol name="star.fill" size={16} color={BrandColors.star} />
                    <Text style={[styles.metaText, { color: colors.text }]}>
                      {recommendation.rating.toFixed(1)}
                    </Text>
                    {recommendation.activity?.reviewsCount != null && recommendation.activity.reviewsCount > 0 && (
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        ({recommendation.activity.reviewsCount.toLocaleString()})
                      </Text>
                    )}
                    <View style={styles.metaDivider} />
                  </>
                )}
                <Text style={[styles.metaText, { color: colors.text }]}>
                  {getPriceDisplay(recommendation.priceRange)}
                </Text>
                <View style={styles.metaDivider} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {recommendation.distance}
                </Text>
              </View>

              {/* Description Section */}
              {(recommendation.description || recommendation.activity?.description) && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
                  <Text style={[styles.description, { color: colors.textSecondary }]}>
                    {recommendation.description || recommendation.activity?.description}
                  </Text>
                </View>
              )}

              {/* Map Preview Section */}
              {recommendation.activity?.location && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Location
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const { latitude, longitude } = recommendation.activity!.location;
                      const url = Platform.select({
                        ios: `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`,
                        android: `google.navigation:q=${latitude},${longitude}`,
                        default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
                      });
                      Linking.openURL(url);
                    }}
                    style={styles.mapPreviewContainer}
                  >
                    <Image
                      source={{
                        uri: getStaticMapUrl({
                          latitude: recommendation.activity.location.latitude,
                          longitude: recommendation.activity.location.longitude,
                        })
                      }}
                      style={styles.mapPreview}
                      resizeMode="cover"
                    />
                    <View style={styles.mapOverlay}>
                      <IconSymbol name="map" size={20} color="#fff" />
                      <Text style={styles.mapOverlayText}>Tap for directions</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* Reviews Section (for non-event venues only) */}
              {!((recommendation as any).event_metadata) && recommendation.activity?.googlePlaceId && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Reviews
                  </Text>

                  {loadingReviews ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text style={[{ color: colors.icon }]}>Loading reviews...</Text>
                    </View>
                  ) : reviews.length > 0 ? (
                    <>
                      {/* Review Topic Bubbles */}
                      {reviewTopics.length > 0 && (
                        <View style={styles.topicBubblesContainer}>
                          {reviewTopics.map((topic, index) => (
                            <View
                              key={index}
                              style={[
                                styles.topicBubble,
                                {
                                  backgroundColor: topic.sentiment === 'positive'
                                    ? BrandColors.success + '26'
                                    : BrandColors.error + '26',
                                  borderColor: topic.sentiment === 'positive'
                                    ? BrandColors.success
                                    : BrandColors.error,
                                },
                              ]}
                            >
                              <IconSymbol
                                name={topic.sentiment === 'positive' ? 'hand.thumbsup.fill' : 'hand.thumbsdown.fill'}
                                size={12}
                                color={topic.sentiment === 'positive' ? BrandColors.success : BrandColors.error}
                              />
                              <Text
                                style={[
                                  styles.topicText,
                                  {
                                    color: topic.sentiment === 'positive' ? BrandColors.success : BrandColors.error,
                                  },
                                ]}
                              >
                                {topic.topic}
                              </Text>
                              {topic.count > 1 && (
                                <Text style={[styles.topicCount, { color: colors.icon }]}>
                                  ({topic.count})
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}

                      <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.reviewsContainer}
                    >
                      {reviews.slice(0, 5).map((review, index) => (
                        <View key={index} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          {/* Reviewer Avatar + Name */}
                          <View style={styles.reviewHeader}>
                            {review.authorAttribution.photoUri ? (
                              <Image
                                source={{ uri: review.authorAttribution.photoUri }}
                                style={styles.reviewerAvatar}
                              />
                            ) : (
                              <View style={[styles.reviewerAvatar, styles.reviewerAvatarPlaceholder, { backgroundColor: BrandColors.loopBlue }]}>
                                <Text style={styles.reviewerInitial}>
                                  {review.authorAttribution.displayName[0]}
                                </Text>
                              </View>
                            )}
                            <View style={styles.reviewerInfo}>
                              <Text style={[styles.reviewerName, { color: colors.text }]} numberOfLines={1}>
                                {review.authorAttribution.displayName}
                              </Text>
                              <Text style={[styles.reviewDate, { color: colors.icon }]}>
                                {review.relativePublishTimeDescription}
                              </Text>
                            </View>
                          </View>

                          {/* Star Rating */}
                          <View style={styles.reviewRating}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <IconSymbol
                                key={star}
                                name={star <= review.rating ? 'star.fill' : 'star'}
                                size={14}
                                color={star <= review.rating ? '#FFD700' : colors.icon}
                              />
                            ))}
                          </View>

                          {/* Review Text */}
                          <Text
                            style={[styles.reviewText, { color: colors.text }]}
                            numberOfLines={4}
                          >
                            {review.text.text}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                    </>
                  ) : (
                    <Text style={[styles.noReviewsText, { color: colors.icon }]}>
                      No reviews available
                    </Text>
                  )}
                </View>
              )}

              {/* AI Explanation */}
              <View style={styles.section}>
                <View style={styles.aiHeader}>
                  <IconSymbol name="sparkles" size={18} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Why We Recommend This
                  </Text>
                </View>
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                  {recommendation.aiExplanation}
                </Text>
              </View>

              {/* Detailed Score Breakdown */}
              {recommendation.scoreBreakdown && (
                <View style={styles.section}>
                  <DetailedScoreGraph scoreBreakdown={recommendation.scoreBreakdown} />
                </View>
              )}

              {/* AI Review Summary */}
              {recommendation.reviewSummary && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    What People Are Saying
                  </Text>
                  <View style={[styles.reviewSummary, { backgroundColor: colors.background }]}>
                    <IconSymbol name="quote.opening" size={20} color={colors.textSecondary} />
                    <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
                      {recommendation.reviewSummary}
                    </Text>
                  </View>
                </View>
              )}

              {/* Additional Details */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
                <View style={styles.detailsList}>
                  {recommendation.openNow !== undefined && (
                    <View style={styles.detailRow}>
                      <IconSymbol name="clock" size={18} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        {recommendation.openNow ? 'Open Now' : 'Currently Closed'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <IconSymbol name="location" size={18} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                      {recommendation.location}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Event Details Section (for events only) */}
              {(recommendation as any).event_metadata && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Event Details</Text>

                  {/* BIG TICKET BUTTON - PRIMARY ACTION */}
                  {(recommendation as any).event_metadata?.event_url && typeof (recommendation as any).event_metadata.event_url === 'string' && (
                    <Pressable
                      style={styles.primaryTicketButton}
                      onPress={async () => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                          console.log('🎟️ Opening event page:', (recommendation as any).event_metadata.event_url);

                          const url = (recommendation as any).event_metadata.event_url;
                          const canOpen = await Linking.canOpenURL(url);

                          if (canOpen) {
                            await Linking.openURL(url);
                            console.log('✅ Opened Ticketmaster page successfully');
                          } else {
                            console.error('❌ Cannot open URL:', url);
                            Alert.alert('Error', 'Unable to open ticket page. Please check your internet connection.');
                          }
                        } catch (error) {
                          console.error('❌ Error opening ticket page:', error);
                          Alert.alert('Error', 'Failed to open ticket page. Please try again.');
                        }
                      }}
                    >
                      <Ionicons name="ticket" size={24} color="#fff" />
                      <Text style={styles.primaryTicketButtonText}>Get Tickets</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </Pressable>
                  )}

                  {/* Event Date & Time */}
                  {(recommendation as any).event_metadata?.start_time && typeof (recommendation as any).event_metadata.start_time === 'string' && (
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.text }]}>
                        {formatEventDateTime((recommendation as any).event_metadata.start_time)}
                      </Text>
                    </View>
                  )}

                  {/* Duration */}
                  {(recommendation as any).event_metadata.duration_minutes && typeof (recommendation as any).event_metadata.duration_minutes === 'number' && (
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.text }]}>
                        {(recommendation as any).event_metadata.duration_minutes} minutes
                      </Text>
                    </View>
                  )}

                  {/* Organizer/Venue */}
                  {(recommendation as any).event_metadata.organizer && typeof (recommendation as any).event_metadata.organizer === 'string' && (
                    <View style={styles.detailRow}>
                      <Ionicons name="business-outline" size={20} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.text }]}>
                        {(recommendation as any).event_metadata.organizer}
                      </Text>
                    </View>
                  )}

                  {/* Ticket Price */}
                  {(recommendation as any).event_metadata.ticket_price &&
                   typeof (recommendation as any).event_metadata.ticket_price.min === 'number' &&
                   typeof (recommendation as any).event_metadata.ticket_price.max === 'number' && (
                    <View style={styles.detailRow}>
                      <Ionicons name="pricetag-outline" size={20} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.text }]}>
                        ${((recommendation as any).event_metadata.ticket_price.min / 100).toFixed(0)} - ${((recommendation as any).event_metadata.ticket_price.max / 100).toFixed(0)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Quick Actions */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
                <View style={styles.actionButtons}>
                  {/* Event Page Button (for events) */}
                  {(recommendation as any).event_metadata?.event_url && (
                    <Pressable
                      style={[styles.actionButton, { borderColor: '#FF4444', backgroundColor: 'rgba(255, 68, 68, 0.05)' }]}
                      onPress={async () => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const url = (recommendation as any).event_metadata.event_url;
                          await Linking.openURL(url);
                        } catch {
                          Alert.alert('Error', 'Unable to open event page');
                        }
                      }}
                    >
                      <Ionicons name="ticket-outline" size={20} color="#FF4444" />
                      <Text style={[styles.actionButtonText, { color: '#FF4444', fontWeight: '600' }]}>
                        Event Page
                      </Text>
                    </Pressable>
                  )}

                  {/* Website Button (for venue/organizer website) */}
                  {recommendation.activity?.website && (
                    <Pressable
                      style={[styles.actionButton, { borderColor: colors.icon }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Linking.openURL(recommendation.activity!.website!).catch(() =>
                          Alert.alert('Error', 'Unable to open website')
                        );
                      }}
                    >
                      <IconSymbol name="globe" size={20} color={colors.primary} />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>
                        Website
                      </Text>
                    </Pressable>
                  )}

                  {/* Phone Button */}
                  {recommendation.activity?.phone && (
                    <Pressable
                      style={[styles.actionButton, { borderColor: colors.icon }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const phoneUrl = `tel:${recommendation.activity!.phone!.replace(/\D/g, '')}`;
                        Linking.openURL(phoneUrl).catch(() =>
                          Alert.alert('Error', 'Unable to make call')
                        );
                      }}
                    >
                      <IconSymbol name="phone.fill" size={20} color={colors.primary} />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>
                        Call
                      </Text>
                    </Pressable>
                  )}

                  {/* Directions Button */}
                  {recommendation.activity?.location && (
                    <Pressable
                      style={[styles.actionButton, { borderColor: colors.icon }]}
                      onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const { latitude, longitude } = recommendation.activity!.location;
                        const placeName = encodeURIComponent(recommendation.title);

                        // Define all map options
                        const googleMapsUrl = Platform.select({
                          ios: `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`,
                          android: `google.navigation:q=${latitude},${longitude}`,
                          default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
                        })!;

                        const appleMapsUrl = `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`;
                        const wazeUrl = `waze://?ll=${latitude},${longitude}&navigate=yes`;
                        const universalMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

                        // Try Google Maps first (most popular)
                        const googleMapsInstalled = await Linking.canOpenURL(googleMapsUrl).catch(() => false);

                        if (googleMapsInstalled) {
                          Linking.openURL(googleMapsUrl);
                          return;
                        }

                        // If Google Maps not available, show options
                        const availableApps: Array<{ name: string; url: string }> = [];

                        // Check Apple Maps (iOS only)
                        if (Platform.OS === 'ios') {
                          const appleMapsInstalled = await Linking.canOpenURL(appleMapsUrl).catch(() => false);
                          if (appleMapsInstalled) {
                            availableApps.push({ name: 'Apple Maps', url: appleMapsUrl });
                          }
                        }

                        // Check Waze
                        const wazeInstalled = await Linking.canOpenURL(wazeUrl).catch(() => false);
                        if (wazeInstalled) {
                          availableApps.push({ name: 'Waze', url: wazeUrl });
                        }

                        // Always add browser option as fallback
                        availableApps.push({ name: 'Open in Browser', url: universalMapsUrl });

                        // Show picker if multiple options available
                        if (availableApps.length > 1) {
                          Alert.alert(
                            'Open Directions In',
                            'Choose your preferred maps app',
                            [
                              ...availableApps.map(app => ({
                                text: app.name,
                                onPress: () => Linking.openURL(app.url),
                              })),
                              {
                                text: 'Cancel',
                                style: 'cancel',
                              },
                            ]
                          );
                        } else if (availableApps.length === 1) {
                          // Only browser available, open directly
                          Linking.openURL(availableApps[0].url);
                        } else {
                          Alert.alert('Error', 'Unable to open directions');
                        }
                      }}
                    >
                      <IconSymbol name="map.fill" size={20} color={colors.primary} />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>
                        Directions
                      </Text>
                    </Pressable>
                  )}

                  {/* Uber Button */}
                  {recommendation.activity?.location && (
                    <Pressable
                      style={[styles.actionButton, { borderColor: colors.icon, backgroundColor: 'rgba(0, 0, 0, 0.05)' }]}
                      onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                        const { latitude, longitude } = recommendation.activity!.location;
                        const name = recommendation.title;

                        // Build Uber deep link with affiliate code
                        const uberDeepLink = `uber://?action=setPickup&dropoff[latitude]=${latitude}&dropoff[longitude]=${longitude}&dropoff[nickname]=${encodeURIComponent(name)}${
                          AFFILIATE_CONFIG.uber.enabled ? `&client_id=${AFFILIATE_CONFIG.uber.affiliateCode}` : ''
                        }`;

                        // Fallback web URL (also includes affiliate code)
                        const uberWebUrl = `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${latitude}&dropoff[longitude]=${longitude}${
                          AFFILIATE_CONFIG.uber.enabled ? `&client_id=${AFFILIATE_CONFIG.uber.affiliateCode}` : ''
                        }`;

                        try {
                          // Check if Uber app is installed
                          const canOpen = await Linking.canOpenURL(uberDeepLink);

                          if (canOpen) {
                            // Open Uber app
                            await Linking.openURL(uberDeepLink);
                          } else {
                            // Fallback to web browser
                            await Linking.openURL(uberWebUrl);
                          }
                        } catch (error) {
                          console.error('Failed to open Uber:', error);
                          Alert.alert('Error', 'Could not open Uber. Please try again.');
                        }
                      }}
                    >
                      <Ionicons name="car-outline" size={20} color="#000000" />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>
                        Uber
                      </Text>
                    </Pressable>
                  )}

                  {/* Reviews Button (NOT for events - they don't have Google reviews) */}
                  {recommendation.activity?.googlePlaceId &&
                   !(recommendation as any).event_metadata?.event_url &&
                   !(recommendation as any).event_metadata?.start_time && (
                    <Pressable
                      style={[styles.actionButton, { borderColor: colors.icon }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        // Open Google Maps to reviews for this place
                        const placeId = recommendation.activity!.googlePlaceId;
                        const reviewsUrl = `https://search.google.com/local/reviews?placeid=${placeId}`;
                        Linking.openURL(reviewsUrl).catch(() =>
                          Alert.alert('Error', 'Unable to open reviews')
                        );
                      }}
                    >
                      <IconSymbol name="star.fill" size={20} color={colors.primary} />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>
                        Reviews
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Add to Calendar Button (Fixed Bottom) */}
          <View style={[styles.footer, { backgroundColor: colors.card }]}>
            <Pressable
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAddToCalendar}
              onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
            >
              <IconSymbol name="plus.circle.fill" size={24} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add to Calendar</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    height: SCREEN_HEIGHT * 0.95,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
  },
  scrollContent: {
    paddingBottom: 100, // Space for fixed button
  },

  // IMAGES
  heroImage: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  carouselContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },

  // CONTENT
  content: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  title: {
    flex: 1,
    fontWeight: '700',
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // METADATA
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  metaText: {
    fontSize: 15,
    fontWeight: '500',
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: BrandColors.veryLightGray,
  },

  // SECTIONS
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  mapPreviewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  mapPreview: {
    width: '100%',
    height: 200,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  reviewsContainer: {
    marginTop: 12,
  },
  reviewCard: {
    width: 280,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  reviewerAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewDate: {
    fontSize: 12,
    marginTop: 2,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 13,
    lineHeight: 18,
  },
  noReviewsText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
  },
  topicBubblesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  topicBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  topicText: {
    fontSize: 13,
    fontWeight: '600',
  },
  topicCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },

  // DETAILED SCORE GRAPH
  detailedGraph: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F9FAFB',
  },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  graphTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  graphTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: BrandColors.loopBlue,
  },
  detailedBarContainer: {
    marginBottom: Spacing.sm,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailedBarLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  barScore: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  detailedBarBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  detailedBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // REVIEW SUMMARY
  reviewSummary: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },

  // DETAILS LIST
  detailsList: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },

  // ACTION BUTTONS
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    minWidth: 110,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  buyTicketsButton: {
    backgroundColor: '#FF4444',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buyTicketsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // PRIMARY TICKET BUTTON (Large, prominent)
  primaryTicketButton: {
    backgroundColor: '#FF4444',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FF6666',
  },
  primaryTicketButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // FOOTER
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    shadowColor: BrandColors.loopBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
