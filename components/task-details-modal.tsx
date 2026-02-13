/**
 * Task Details Modal - Rich view for calendar tasks
 * Opens from the loop map "View Details" button
 * Shows comprehensive task info including photos, reviews, and share options
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
  Linking,
  Alert,
  Platform,
  TouchableOpacity,
  FlatList,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors, CategoryColors } from '@/constants/brand';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getStaticMapUrl } from '@/utils/maps';
import { AFFILIATE_CONFIG } from '@/constants/affiliate-config';
import { getPlaceReviews, type PlaceReview } from '@/services/google-places';
import { extractReviewTopics, type ReviewTopic } from '@/utils/review-topics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const IMAGE_HEIGHT = 300;

// Category configuration (matches calendar.tsx)
const CATEGORIES = [
  { id: 'dining', label: 'Dining', icon: 'restaurant', color: CategoryColors.dining },
  { id: 'entertainment', label: 'Entertainment', icon: 'musical-notes', color: CategoryColors.entertainment },
  { id: 'fitness', label: 'Fitness', icon: 'fitness', color: CategoryColors.fitness },
  { id: 'social', label: 'Social', icon: 'people', color: CategoryColors.social },
  { id: 'work', label: 'Work', icon: 'briefcase', color: CategoryColors.work },
  { id: 'personal', label: 'Personal', icon: 'person', color: CategoryColors.personal },
  { id: 'travel', label: 'Travel', icon: 'airplane', color: CategoryColors.travel },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: CategoryColors.other },
];

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  category: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  activity_id?: string;
}

interface VenueDetails {
  name?: string;
  rating?: number;
  reviewsCount?: number;
  website?: string;
  phone?: string;
  openNow?: boolean;
  photos?: string[];
  priceRange?: number;
  googlePlaceId?: string;
  description?: string;
  types?: string[];
}

interface TaskDetailsModalProps {
  visible: boolean;
  task: CalendarEvent | null;
  venueDetails?: VenueDetails | null;
  onClose: () => void;
  onEdit: () => void;
  onMarkComplete: () => void;
  onDelete: () => void;
}

/**
 * Get relative time string for a date
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  // Use calendar-day comparison for "Tomorrow" logic
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const calendarDayDiff = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffMins < 0) {
    if (diffMins > -60) return `${Math.abs(diffMins)} min ago`;
    if (diffHours > -24) return `${Math.abs(diffHours)} hours ago`;
    if (calendarDayDiff > -7) return `${Math.abs(calendarDayDiff)} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (diffMins < 60) return `in ${diffMins} min`;
  if (diffHours < 24) return `in ${diffHours} hours`;
  if (calendarDayDiff === 1) return 'Tomorrow';
  if (calendarDayDiff < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format time range
 */
function formatTimeRange(start: string, end: string): { timeStr: string; relative: string } {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const timeStr = `${startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })} - ${endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;

  const relative = getRelativeTime(startDate);

  return { timeStr, relative };
}

/**
 * Get price display string
 */
function getPriceDisplay(priceRange?: number): string {
  if (!priceRange || priceRange === 0) return 'Free';
  return '$'.repeat(Math.max(1, priceRange));
}

/**
 * Photo Carousel Component
 */
function PhotoCarousel({ photos }: { photos: string[] }) {
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
        keyExtractor={(item, index) => `task-photo-${index}`}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

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

export function TaskDetailsModal({
  visible,
  task,
  venueDetails,
  onClose,
  onEdit,
  onMarkComplete,
  onDelete,
}: TaskDetailsModalProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Reviews state
  const [reviews, setReviews] = useState<PlaceReview[]>([]);
  const [reviewTopics, setReviewTopics] = useState<ReviewTopic[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Description expansion
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Fetch reviews when modal opens and we have a googlePlaceId
  useEffect(() => {
    const googlePlaceId = venueDetails?.googlePlaceId;

    if (visible && googlePlaceId) {
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
      setReviews([]);
      setReviewTopics([]);
    }
  }, [visible, venueDetails?.googlePlaceId]);

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

  if (!task) return null;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    onEdit();
  };

  const handleMarkComplete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    onMarkComplete();
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onClose();
            onDelete();
          },
        },
      ]
    );
  };

  // Share task invite
  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const startDate = new Date(task.start_time);
    const dateStr = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    const venueName = venueDetails?.name || task.title;
    const message = `Join me for "${task.title}" at ${venueName}!\n\n📅 ${dateStr}\n⏰ ${timeStr}\n📍 ${task.address}\n\nOpen in Loop to add this to your calendar!`;

    // Deep link URL for the task invite
    const deepLink = `loop://task-invite/${task.id}`;

    try {
      await Share.share({
        message: message,
        url: deepLink, // iOS will show this separately
        title: `Join me: ${task.title}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Get category info
  const categoryInfo = CATEGORIES.find(c => c.id === task.category) || CATEGORIES[7];
  const categoryColor = categoryInfo.color;

  // Time formatting
  const { timeStr, relative } = formatTimeRange(task.start_time, task.end_time);

  // Check if task has ended
  const hasEnded = new Date(task.end_time) < new Date();
  const isCompleted = task.status === 'completed';

  // Photos for carousel
  const photos = venueDetails?.photos && venueDetails.photos.length > 0
    ? venueDetails.photos
    : [];

  // Static map URL
  const staticMapUrl = getStaticMapUrl({
    latitude: task.location.latitude,
    longitude: task.location.longitude,
    zoom: 15,
  });

  // Venue name (from details or task title)
  const venueName = venueDetails?.name || null;

  // Description (from venue or task)
  const description = venueDetails?.description || task.description;

  // Open directions
  const openDirections = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { latitude, longitude } = task.location;

    const googleMapsUrl = Platform.select({
      ios: `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    })!;

    const appleMapsUrl = `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`;
    const wazeUrl = `waze://?ll=${latitude},${longitude}&navigate=yes`;
    const universalMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

    const googleMapsInstalled = await Linking.canOpenURL(googleMapsUrl).catch(() => false);

    if (googleMapsInstalled) {
      Linking.openURL(googleMapsUrl);
      return;
    }

    const availableApps: Array<{ name: string; url: string }> = [];

    if (Platform.OS === 'ios') {
      const appleMapsInstalled = await Linking.canOpenURL(appleMapsUrl).catch(() => false);
      if (appleMapsInstalled) {
        availableApps.push({ name: 'Apple Maps', url: appleMapsUrl });
      }
    }

    const wazeInstalled = await Linking.canOpenURL(wazeUrl).catch(() => false);
    if (wazeInstalled) {
      availableApps.push({ name: 'Waze', url: wazeUrl });
    }

    availableApps.push({ name: 'Open in Browser', url: universalMapsUrl });

    if (availableApps.length > 1) {
      Alert.alert(
        'Open Directions In',
        'Choose your preferred maps app',
        [
          ...availableApps.map(app => ({
            text: app.name,
            onPress: () => Linking.openURL(app.url),
          })),
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else if (availableApps.length === 1) {
      Linking.openURL(availableApps[0].url);
    }
  };

  // Open Uber
  const openUber = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { latitude, longitude } = task.location;

    const uberDeepLink = `uber://?action=setPickup&dropoff[latitude]=${latitude}&dropoff[longitude]=${longitude}&dropoff[nickname]=${encodeURIComponent(venueName || task.title)}${
      AFFILIATE_CONFIG.uber.enabled ? `&client_id=${AFFILIATE_CONFIG.uber.affiliateCode}` : ''
    }`;

    const uberWebUrl = `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${latitude}&dropoff[longitude]=${longitude}${
      AFFILIATE_CONFIG.uber.enabled ? `&client_id=${AFFILIATE_CONFIG.uber.affiliateCode}` : ''
    }`;

    try {
      const canOpen = await Linking.canOpenURL(uberDeepLink);
      if (canOpen) {
        await Linking.openURL(uberDeepLink);
      } else {
        await Linking.openURL(uberWebUrl);
      }
    } catch (error) {
      console.error('Failed to open Uber:', error);
      Alert.alert('Error', 'Could not open Uber. Please try again.');
    }
  };

  // Call phone
  const callPhone = () => {
    if (!venueDetails?.phone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const phoneUrl = `tel:${venueDetails.phone.replace(/\D/g, '')}`;
    Linking.openURL(phoneUrl).catch(() =>
      Alert.alert('Error', 'Unable to make call')
    );
  };

  // Open website
  const openWebsite = () => {
    if (!venueDetails?.website) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(venueDetails.website).catch(() =>
      Alert.alert('Error', 'Unable to open website')
    );
  };

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

          {/* Share Button */}
          <Pressable style={styles.shareButton} onPress={handleShare}>
            <View style={styles.shareButtonInner}>
              <Ionicons name="share-outline" size={20} color="#fff" />
            </View>
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Hero Section - Photo Carousel or Static Map */}
            {photos.length >= 3 ? (
              <PhotoCarousel photos={photos} />
            ) : photos.length > 0 ? (
              <Image
                source={{ uri: photos[0] }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            ) : staticMapUrl ? (
              <TouchableOpacity onPress={openDirections} activeOpacity={0.9}>
                <Image
                  source={{ uri: staticMapUrl }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
                <View style={styles.mapOverlay}>
                  <IconSymbol name="map" size={20} color="#fff" />
                  <Text style={styles.mapOverlayText}>Tap for directions</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder, { backgroundColor: categoryColor }]}>
                <Ionicons name={categoryInfo.icon as any} size={64} color="rgba(255,255,255,0.8)" />
              </View>
            )}

            {/* Content Section */}
            <View style={styles.content}>
              {/* Title and Category */}
              <View style={styles.header}>
                <Text style={[styles.title, Typography.titleLarge, { color: colors.text }]}>
                  {task.title}
                </Text>
                <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
                  <Text style={styles.categoryText}>{categoryInfo.label}</Text>
                </View>
              </View>

              {/* Venue Name (if different from title) */}
              {venueName && venueName !== task.title && (
                <View style={styles.venueNameRow}>
                  <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.venueName, { color: colors.textSecondary }]}>
                    at {venueName}
                  </Text>
                </View>
              )}

              {/* Metadata Row (Rating, Price, Time) */}
              <View style={styles.metadata}>
                {venueDetails?.rating != null && venueDetails.rating > 0 && (
                  <>
                    <IconSymbol name="star.fill" size={16} color={BrandColors.star} />
                    <Text style={[styles.metaText, { color: colors.text }]}>
                      {venueDetails.rating.toFixed(1)}
                    </Text>
                    {venueDetails.reviewsCount != null && venueDetails.reviewsCount > 0 && (
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        ({venueDetails.reviewsCount.toLocaleString()})
                      </Text>
                    )}
                    <View style={styles.metaDivider} />
                  </>
                )}
                {venueDetails?.priceRange != null && (
                  <>
                    <Text style={[styles.metaText, { color: colors.text }]}>
                      {getPriceDisplay(venueDetails.priceRange)}
                    </Text>
                    <View style={styles.metaDivider} />
                  </>
                )}
                {venueDetails?.openNow !== undefined && (
                  <>
                    <Text
                      style={[
                        styles.metaText,
                        { color: venueDetails.openNow ? BrandColors.success : BrandColors.error },
                      ]}
                    >
                      {venueDetails.openNow ? 'Open Now' : 'Closed'}
                    </Text>
                    <View style={styles.metaDivider} />
                  </>
                )}
              </View>

              {/* Time Row */}
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.timeText, { color: colors.text }]}>{timeStr}</Text>
                <View style={[styles.relativeBadge, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.relativeText, { color: BrandColors.loopBlue }]}>{relative}</Text>
                </View>
              </View>

              {/* Status Badge (if completed) */}
              {isCompleted && (
                <View style={[styles.statusBadge, { backgroundColor: BrandColors.success }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.statusText}>Completed</Text>
                </View>
              )}

              {/* Description Section */}
              {description && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
                  <Text
                    style={[styles.descriptionText, { color: colors.textSecondary }]}
                    numberOfLines={descriptionExpanded ? undefined : 3}
                  >
                    {description}
                  </Text>
                  {description.length > 150 && (
                    <TouchableOpacity onPress={() => setDescriptionExpanded(!descriptionExpanded)}>
                      <Text style={[styles.showMoreText, { color: BrandColors.loopBlue }]}>
                        {descriptionExpanded ? 'Show less' : 'Show more'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Location Section */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>
                <TouchableOpacity onPress={openDirections} style={styles.locationRow}>
                  <Ionicons name="location" size={20} color={categoryColor} />
                  <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                    {task.address}
                  </Text>
                </TouchableOpacity>

                {/* Map Preview (if we have photos in hero, show map here) */}
                {photos.length > 0 && staticMapUrl && (
                  <TouchableOpacity onPress={openDirections} style={styles.mapPreviewContainer}>
                    <Image
                      source={{ uri: staticMapUrl }}
                      style={styles.mapPreview}
                      resizeMode="cover"
                    />
                    <View style={styles.mapOverlay}>
                      <IconSymbol name="map" size={20} color="#fff" />
                      <Text style={styles.mapOverlayText}>Tap for directions</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* Reviews Section (if we have a googlePlaceId) */}
              {venueDetails?.googlePlaceId && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Reviews</Text>

                  {loadingReviews ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={BrandColors.loopBlue} />
                      <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Loading reviews...
                      </Text>
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

                      {/* Review Cards */}
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
                                  color={star <= review.rating ? BrandColors.star : colors.icon}
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

              {/* Quick Actions Row */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
                <View style={styles.actionsRow}>
                  {/* Directions */}
                  <TouchableOpacity
                    style={[styles.actionButton, { borderColor: colors.border }]}
                    onPress={openDirections}
                  >
                    <Ionicons name="navigate" size={20} color={BrandColors.loopBlue} />
                    <Text style={[styles.actionButtonText, { color: colors.text }]}>Directions</Text>
                  </TouchableOpacity>

                  {/* Uber */}
                  <TouchableOpacity
                    style={[styles.actionButton, { borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.03)' }]}
                    onPress={openUber}
                  >
                    <Ionicons name="car" size={20} color="#000" />
                    <Text style={[styles.actionButtonText, { color: colors.text }]}>Uber</Text>
                  </TouchableOpacity>

                  {/* Website (if available) */}
                  {venueDetails?.website && (
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: colors.border }]}
                      onPress={openWebsite}
                    >
                      <Ionicons name="globe" size={20} color={BrandColors.loopBlue} />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>Website</Text>
                    </TouchableOpacity>
                  )}

                  {/* Phone (if available) */}
                  {venueDetails?.phone && (
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: colors.border }]}
                      onPress={callPhone}
                    >
                      <Ionicons name="call" size={20} color={BrandColors.loopGreen} />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>Call</Text>
                    </TouchableOpacity>
                  )}

                  {/* Share */}
                  <TouchableOpacity
                    style={[styles.actionButton, { borderColor: BrandColors.loopBlue, backgroundColor: `${BrandColors.loopBlue}0D` }]}
                    onPress={handleShare}
                  >
                    <Ionicons name="share-social" size={20} color={BrandColors.loopBlue} />
                    <Text style={[styles.actionButtonText, { color: BrandColors.loopBlue }]}>Invite</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions (Fixed at bottom) */}
          <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            {/* Delete Button */}
            <TouchableOpacity
              style={[styles.deleteButtonFooter, { borderColor: BrandColors.error }]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color={BrandColors.error} />
            </TouchableOpacity>

            {/* Edit Button */}
            <TouchableOpacity
              style={[styles.editButton, { borderColor: BrandColors.loopBlue }]}
              onPress={handleEdit}
            >
              <Ionicons name="create-outline" size={20} color={BrandColors.loopBlue} />
              <Text style={[styles.editButtonText, { color: BrandColors.loopBlue }]}>Edit</Text>
            </TouchableOpacity>

            {/* Mark Complete Button (only show if ended and not completed) */}
            {hasEnded && !isCompleted && (
              <TouchableOpacity
                style={[styles.completeButton, { backgroundColor: BrandColors.success }]}
                onPress={handleMarkComplete}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.completeButtonText}>Complete</Text>
              </TouchableOpacity>
            )}

            {/* Completed label */}
            {isCompleted && (
              <View style={[styles.completedLabel, { backgroundColor: `${BrandColors.success}1A` }]}>
                <Ionicons name="checkmark-circle" size={20} color={BrandColors.success} />
                <Text style={[styles.completedLabelText, { color: BrandColors.success }]}>Done</Text>
              </View>
            )}
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
  shareButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md + 44,
    zIndex: 10,
  },
  shareButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // Hero Section
  heroImage: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  heroPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
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

  // Content Section
  content: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
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
  venueNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  venueName: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Metadata Row
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
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

  // Time Row
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '500',
  },
  relativeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  relativeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
    marginBottom: Spacing.md,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Section Styles
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  addressText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  mapPreviewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  mapPreview: {
    width: '100%',
    height: 150,
  },

  // Reviews Section
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 14,
  },
  topicBubblesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
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
  reviewsContainer: {
    marginTop: 4,
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
  },

  // Quick Actions
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    minWidth: 100,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  deleteButtonFooter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    shadowColor: BrandColors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  completedLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  completedLabelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
