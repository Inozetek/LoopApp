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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Recommendation } from '@/types/activity';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { IconSymbol } from '@/components/ui/icon-symbol';

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
    { label: 'Interest Match', value: scoreBreakdown.baseScore, max: 40, color: '#3b82f6' },
    { label: 'Location', value: scoreBreakdown.locationScore, max: 20, color: '#10b981' },
    { label: 'Timing', value: scoreBreakdown.timeScore, max: 15, color: '#f59e0b' },
    { label: 'Past Feedback', value: scoreBreakdown.feedbackScore, max: 15, color: '#8b5cf6' },
    { label: 'Similar Users', value: scoreBreakdown.collaborativeScore, max: 10, color: '#ec4899' },
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

              {/* Quick Actions */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
                <View style={styles.actionButtons}>
                  {/* Website Button */}
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

                  {/* Reviews Button */}
                  {recommendation.activity?.googlePlaceId && (
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
    backgroundColor: '#999',
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
    color: '#3b82f6',
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
  reviewText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
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
