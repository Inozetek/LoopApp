/**
 * Activity Card - Instagram-Style Image-First Design
 * Beautiful visual feed with hero images and minimal circular CTA
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Image,
  Dimensions,
  FlatList,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Activity, Recommendation } from '@/types/activity';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - (Spacing.md * 2);
const IMAGE_HEIGHT = 400; // 60% of typical card

/**
 * Instagram-Style Photo Carousel Component
 * Horizontal scrollable photos with dot indicators
 */
interface PhotoCarouselProps {
  photos: string[];
  imageError: boolean;
  onImageError: () => void;
}

function PhotoCarousel({ photos, imageError, onImageError }: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<FlatList>(null);

  const onScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        ref={scrollViewRef}
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
            onError={onImageError}
          />
        )}
        keyExtractor={(item, index) => `photo-${index}`}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Instagram-style dot indicators */}
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
    </View>
  );
}

/**
 * Stacked Score Bar Component
 * Shows Interest, Location, and Timing scores in ONE segmented bar
 */
interface StackedScoreBarProps {
  scoreBreakdown: {
    baseScore: number;
    locationScore: number;
    timeScore: number;
  };
}

function StackedScoreBar({ scoreBreakdown }: StackedScoreBarProps) {
  const totalPossible = 40 + 20 + 15; // 75 max
  const interestPercent = (scoreBreakdown.baseScore / totalPossible) * 100;
  const locationPercent = (scoreBreakdown.locationScore / totalPossible) * 100;
  const timePercent = (scoreBreakdown.timeScore / totalPossible) * 100;

  return (
    <View style={styles.stackedBar}>
      {/* Single bar with colored segments */}
      <View style={styles.stackedBarContainer}>
        {/* Interest segment (blue) */}
        <View
          style={[
            styles.stackedBarSegment,
            {
              width: `${interestPercent}%`,
              backgroundColor: '#3b82f6',
            }
          ]}
        />
        {/* Location segment (green) */}
        <View
          style={[
            styles.stackedBarSegment,
            {
              width: `${locationPercent}%`,
              backgroundColor: '#10b981',
            }
          ]}
        />
        {/* Timing segment (orange) */}
        <View
          style={[
            styles.stackedBarSegment,
            {
              width: `${timePercent}%`,
              backgroundColor: '#f59e0b',
            }
          ]}
        />
      </View>

      {/* Legend */}
      <View style={styles.stackedBarLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
          <Text style={styles.legendText}>Interest</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.legendText}>Location</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.legendText}>Timing</Text>
        </View>
      </View>
    </View>
  );
}

interface ActivityCardIntelligentProps {
  recommendation: Recommendation;
  onAddToCalendar: () => void;
  onSeeDetails: () => void;
  index: number;
}

export function ActivityCardIntelligent({
  recommendation,
  onAddToCalendar,
  onSeeDetails,
  index,
}: ActivityCardIntelligentProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  // Use flat Recommendation structure
  const score = recommendation.scoreBreakdown || {
    baseScore: 0,
    locationScore: 0,
    timeScore: 0,
    feedbackScore: 0,
    collaborativeScore: 0,
    sponsoredBoost: 0,
    finalScore: recommendation.score || 0,
  };

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: index * 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getPriceDisplay = (priceRange?: number) => {
    if (!priceRange || priceRange === 0) return 'Free';
    return '$'.repeat(Math.max(1, priceRange));
  };

  const getDistanceText = (distanceStr?: string) => {
    if (!distanceStr) return 'Nearby';
    // distanceStr is already formatted as "2.7 mi" from the feed screen
    return distanceStr;
  };

  // Score breakdown for AI explanation (simplified)
  const getAIExplanation = () => {
    const reasons = [];
    if (score.baseScore >= 30) reasons.push('Matches your interests');
    if (score.locationScore >= 15) reasons.push('Very close by');
    if (score.timeScore >= 12) reasons.push('Perfect timing');

    if (reasons.length === 0) {
      return recommendation.aiExplanation || 'Recommended for you';
    }

    return reasons.join(' • ');
  };

  // Fallback image if no imageUrl provided
  const imageSource = !imageError && recommendation.imageUrl
    ? { uri: recommendation.imageUrl }
    : require('@/assets/images/loop-logo6.png'); // Default fallback

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Pressable
        onPress={onSeeDetails}
        onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        style={[styles.card, { backgroundColor: colors.card }]}
      >
        {/* HERO IMAGE (60% of card) - Carousel if 3+ photos, single image otherwise */}
        <View style={styles.imageContainer}>
          {recommendation.photos && recommendation.photos.length >= 3 ? (
            // Instagram-style carousel for 3+ photos
            <PhotoCarousel
              photos={recommendation.photos}
              imageError={imageError}
              onImageError={() => setImageError(true)}
            />
          ) : (
            // Single image (default)
            <Image
              source={imageSource}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          )}

          {/* Gradient overlay for better badge/text visibility */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)']}
            style={styles.imageGradient}
          />

          {/* BADGES OVERLAY ON IMAGE */}
          <View style={styles.badgeContainer}>
            {/* Open Now Badge */}
            {recommendation.openNow && (
              <View style={styles.openNowBadge}>
                <View style={styles.greenDot} />
                <Text style={styles.openNowText}>Open Now</Text>
              </View>
            )}

            {/* Sponsored Badge */}
            {recommendation.isSponsored && (
              <View style={styles.sponsoredBadge}>
                <Text style={styles.sponsoredText}>Sponsored</Text>
              </View>
            )}
          </View>

          {/* Category Badge (bottom left of image) */}
          <View style={styles.categoryBadgeOverlay}>
            <View style={[styles.categoryBadge, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}>
              <Text style={styles.categoryText}>{recommendation.category}</Text>
            </View>
          </View>
        </View>

        {/* CONTENT SECTION (30% of card) */}
        <View style={styles.content}>
          {/* Title */}
          <Text style={[styles.title, Typography.titleLarge, { color: colors.text }]} numberOfLines={2}>
            {recommendation.title}
          </Text>

          {/* Metadata Row */}
          <View style={styles.metadata}>
            {recommendation.rating != null && recommendation.rating > 0 && (
              <>
                <IconSymbol name="star.fill" size={14} color={BrandColors.star} />
                <Text style={[styles.metaText, { color: colors.text }]}>
                  {recommendation.rating.toFixed(1)}
                </Text>
                <View style={styles.metaDivider} />
              </>
            )}
            <Text style={[styles.metaText, { color: colors.text }]}>
              {getPriceDisplay(recommendation.priceRange)}
            </Text>
            <View style={styles.metaDivider} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {getDistanceText(recommendation.distance)}
            </Text>
          </View>

          {/* AI Explanation (One Line) */}
          <View style={styles.aiExplanation}>
            <IconSymbol name="sparkles" size={14} color={colors.primary} />
            <Text style={[styles.aiText, { color: colors.textSecondary }]} numberOfLines={2}>
              {getAIExplanation()}
            </Text>
          </View>

          {/* Stacked Score Bar */}
          {score && (
            <StackedScoreBar scoreBreakdown={score} />
          )}
        </View>

        {/* AI MATCH SCORE TILE (Top right of card) */}
        {recommendation.score && (
          <View style={[
            styles.matchScoreTile,
            {
              backgroundColor:
                recommendation.score >= 85 ? 'rgba(52, 211, 153, 0.12)' : // Mint tint (85-100%)
                recommendation.score >= 75 ? 'rgba(96, 165, 250, 0.12)' : // Sky tint (75-85%)
                recommendation.score >= 60 ? 'rgba(167, 139, 250, 0.12)' : // Lavender tint (60-75%)
                recommendation.score >= 35 ? 'rgba(251, 191, 36, 0.12)' : // Golden tint (35-60%)
                'rgba(251, 113, 133, 0.12)' // Rose tint (20-35%)
            }
          ]}>
            <Text style={[
              styles.matchScoreNumber,
              {
                color:
                  recommendation.score >= 85 ? '#34d399' : // Mint
                  recommendation.score >= 75 ? '#60a5fa' : // Sky
                  recommendation.score >= 60 ? '#a78bfa' : // Lavender
                  recommendation.score >= 35 ? '#fbbf24' : // Golden
                  '#fb7185' // Rose
              }
            ]}>
              {Math.round(recommendation.score)}
            </Text>
            <Text style={[
              styles.matchScoreLabel,
              {
                color:
                  recommendation.score >= 85 ? '#34d399' : // Mint
                  recommendation.score >= 75 ? '#60a5fa' : // Sky
                  recommendation.score >= 60 ? '#a78bfa' : // Lavender
                  recommendation.score >= 35 ? '#fbbf24' : // Golden
                  '#fb7185' // Rose
              }
            ]}>
              MATCH
            </Text>
          </View>
        )}

        {/* CIRCULAR CTA BUTTON (10% - bottom right corner) */}
        <Pressable
          style={[styles.circularButton, { backgroundColor: colors.primary }]}
          onPress={onAddToCalendar}
          onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
        >
          <IconSymbol name="plus.circle.fill" size={30} color="#FFFFFF" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },

  // IMAGE SECTION (60%)
  imageContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },

  // BADGES ON IMAGE
  badgeContainer: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'column',
    gap: Spacing.xs,
  },
  openNowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.95)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  openNowText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  sponsoredBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  sponsoredText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryBadgeOverlay: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // CONTENT SECTION (30%)
  content: {
    padding: Spacing.md,
    paddingTop: Spacing.sm, // Less top padding since tile takes space
    paddingBottom: Spacing.lg, // Extra space for circular button
    paddingRight: 84, // Prevent text from overlapping tile (60px + 16px + 8px buffer)
    minHeight: 90, // Ensure minimum height to prevent crowding with tile
  },
  title: {
    marginBottom: Spacing.xs,
    fontWeight: '700',
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  metaDivider: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#999',
  },
  aiExplanation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginBottom: Spacing.sm, // Extra safety margin to avoid button overlap
  },
  aiText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  // AI MATCH SCORE TILE (Soft tinted background style - matches screenshots)
  matchScoreTile: {
    position: 'absolute',
    top: IMAGE_HEIGHT + Spacing.sm,
    right: Spacing.md,
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  matchScoreNumber: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  matchScoreLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: -2,
    opacity: 0.9,
  },

  // CIRCULAR CTA BUTTON (10%)
  circularButton: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.loopBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // INSTAGRAM-STYLE CAROUSEL
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

  // STACKED SCORE BAR
  stackedBar: {
    marginTop: Spacing.sm,
  },
  stackedBarContainer: {
    flexDirection: 'row',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  stackedBarSegment: {
    height: '100%',
  },
  stackedBarLegend: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
});
