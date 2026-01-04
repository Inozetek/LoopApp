/**
 * Activity Card - Instagram-Style Image-First Design
 * Beautiful visual feed with hero images and minimal circular CTA
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
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
    const index = Math.round(offsetX / CARD_WIDTH);
    setCurrentIndex(index);
  };

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        ref={scrollViewRef}
        data={photos}
        horizontal
        pagingEnabled={false}
        snapToInterval={CARD_WIDTH}
        decelerationRate="fast"
        snapToAlignment="start"
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
          length: CARD_WIDTH,
          offset: CARD_WIDTH * index,
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
 * Shows all 6 scoring components in ONE segmented bar with proper percentage distribution
 * Based on CLAUDE.md algorithm: Base (40), Location (20), Time (15), Feedback (15), Collaborative (10)
 */
interface StackedScoreBarProps {
  scoreBreakdown: {
    baseScore: number;
    locationScore: number;
    timeScore: number;
    feedbackScore: number;
    collaborativeScore: number;
    sponsorBoost: number;
  };
}

function StackedScoreBar({ scoreBreakdown }: StackedScoreBarProps) {
  // Calculate total ACTUAL score (sum of all components that have points)
  const totalActualScore =
    scoreBreakdown.baseScore +
    scoreBreakdown.locationScore +
    scoreBreakdown.timeScore +
    scoreBreakdown.feedbackScore +
    scoreBreakdown.collaborativeScore;

  // Calculate percentage of ACTUAL total for each component (fills 100% width)
  const basePercent = totalActualScore > 0 ? (scoreBreakdown.baseScore / totalActualScore) * 100 : 0;
  const locationPercent = totalActualScore > 0 ? (scoreBreakdown.locationScore / totalActualScore) * 100 : 0;
  const timePercent = totalActualScore > 0 ? (scoreBreakdown.timeScore / totalActualScore) * 100 : 0;
  const feedbackPercent = totalActualScore > 0 ? (scoreBreakdown.feedbackScore / totalActualScore) * 100 : 0;
  const collaborativePercent = totalActualScore > 0 ? (scoreBreakdown.collaborativeScore / totalActualScore) * 100 : 0;

  return (
    <View style={styles.stackedBar}>
      {/* Single bar with colored segments */}
      <View style={styles.stackedBarContainer}>
        {/* Interest/Base segment (blue) - 40 points max */}
        {basePercent > 0 && (
          <View
            style={[
              styles.stackedBarSegment,
              {
                width: `${basePercent}%`,
                backgroundColor: '#3b82f6', // Blue
              }
            ]}
          />
        )}

        {/* Location segment (green) - 20 points max */}
        {locationPercent > 0 && (
          <View
            style={[
              styles.stackedBarSegment,
              {
                width: `${locationPercent}%`,
                backgroundColor: '#10b981', // Green
              }
            ]}
          />
        )}

        {/* Timing segment (orange) - 15 points max */}
        {timePercent > 0 && (
          <View
            style={[
              styles.stackedBarSegment,
              {
                width: `${timePercent}%`,
                backgroundColor: '#f59e0b', // Orange
              }
            ]}
          />
        )}

        {/* Feedback segment (purple) - 15 points max */}
        {feedbackPercent > 0 && (
          <View
            style={[
              styles.stackedBarSegment,
              {
                width: `${feedbackPercent}%`,
                backgroundColor: '#a78bfa', // Purple
              }
            ]}
          />
        )}

        {/* Collaborative segment (pink) - 10 points max */}
        {collaborativePercent > 0 && (
          <View
            style={[
              styles.stackedBarSegment,
              {
                width: `${collaborativePercent}%`,
                backgroundColor: '#ec4899', // Pink
              }
            ]}
          />
        )}
      </View>

      {/* Compact Legend - Only show components with >0 score */}
      <View style={styles.stackedBarLegend}>
        {basePercent > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.legendText}>Interest</Text>
          </View>
        )}
        {locationPercent > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.legendText}>Location</Text>
          </View>
        )}
        {timePercent > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.legendText}>Time</Text>
          </View>
        )}
        {feedbackPercent > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#a78bfa' }]} />
            <Text style={styles.legendText}>Feedback</Text>
          </View>
        )}
        {collaborativePercent > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ec4899' }]} />
            <Text style={styles.legendText}>Social</Text>
          </View>
        )}
      </View>
    </View>
  );
}

interface ActivityCardIntelligentProps {
  recommendation: Recommendation;
  onAddToCalendar: () => void;
  onSeeDetails: () => void;
  onNotInterested?: () => void;
  index: number;
  isRemoving?: boolean; // Trigger slide-out animation when added to calendar
}

function ActivityCardIntelligentComponent({
  recommendation,
  onAddToCalendar,
  onSeeDetails,
  onNotInterested,
  index,
  isRemoving = false,
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
    sponsorBoost: 0, // Fixed typo: was sponsoredBoost
    finalScore: recommendation.score || 0,
  };

  // Animation - entrance
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Animation - exit (slide left toward calendar when added)
  const exitSlideAnim = useRef(new Animated.Value(0)).current;
  const exitFadeAnim = useRef(new Animated.Value(1)).current;

  const [imageError, setImageError] = useState(false);

  // Entrance animation
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

  // Exit animation - slide left toward Calendar tab when added to calendar
  useEffect(() => {
    if (isRemoving) {
      Animated.parallel([
        Animated.timing(exitSlideAnim, {
          toValue: -SCREEN_WIDTH * 1.2, // Slide left (toward Calendar tab) - slightly beyond screen for smooth exit
          duration: 800, // Fast and snappy - no perceived delay
          useNativeDriver: true,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Smooth ease-in-out curve
        }),
        Animated.timing(exitFadeAnim, {
          toValue: 0,
          duration: 800, // Match slide duration for perfect sync
          useNativeDriver: true,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Same easing for fluid motion
        }),
      ]).start();
    }
  }, [isRemoving]);

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
    : require('@/assets/images/empty-wallet-fallback.jpg'); // Empty wallet meme for missing images

  // Determine border color based on score (visual hierarchy)
  const finalScore = score.finalScore || recommendation.score || 0;
  const getBorderColor = () => {
    if (finalScore >= 60) {
      return BrandColors.loopGreen; // Top Match - green border
    } else {
      return colors.border; // All other recommendations - subtle gray
    }
  };

  const isTopMatch = finalScore >= 60;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: isRemoving ? exitFadeAnim : fadeAnim,
          transform: [
            { translateY: slideAnim },
            { translateX: exitSlideAnim }, // Slide left when being removed
          ],
        },
      ]}
    >
      <View style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderWidth: 2,
          borderColor: getBorderColor(),
        }
      ]}>
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
            // Single image (default) - wrapped in Pressable
            <Pressable
              onPress={onSeeDetails}
              onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              style={styles.imagePressable}
            >
              <Image
                source={imageSource}
                style={styles.image}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            </Pressable>
          )}

          {/* Gradient overlay for better badge/text visibility */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)']}
            style={styles.imageGradient}
            pointerEvents="none"
          />

          {/* THREE-DOT MENU BUTTON (Top Left) */}
          {onNotInterested && (
            <Pressable
              style={styles.menuButton}
              onPress={onNotInterested}
              onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <IconSymbol name="ellipsis.circle.fill" size={28} color="rgba(255, 255, 255, 0.9)" />
            </Pressable>
          )}

          {/* BADGES OVERLAY ON IMAGE */}
          <View style={styles.badgeContainer} pointerEvents="box-none">
            {/* Top Match Badge (Score >= 60) */}
            {isTopMatch && (
              <View style={styles.topMatchBadge}>
                <Text style={styles.topMatchText}>🎯 Top Match</Text>
              </View>
            )}

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
          <View style={styles.categoryBadgeOverlay} pointerEvents="box-none">
            <View style={[styles.categoryBadge, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}>
              <Text style={styles.categoryText}>{recommendation.category}</Text>
            </View>
          </View>
        </View>

        {/* CONTENT SECTION (30% of card) - clickable to open details */}
        <Pressable
          style={styles.content}
          onPress={onSeeDetails}
          onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        >
          {/* Title */}
          <Text style={[styles.title, Typography.titleLarge, { color: colors.text }]} numberOfLines={2}>
            {recommendation.title}
          </Text>

          {/* Metadata Row */}
          <View style={styles.metadata}>
            {/* Rating stars */}
            {recommendation.rating > 0 && (
              <>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {[...Array(5)].map((_, i) => (
                    <IconSymbol
                      key={i}
                      name={i < Math.floor(recommendation.rating) ? 'star.fill' : 'star'}
                      size={12}
                      color="#FFA500"
                    />
                  ))}
                </View>
                <Text style={[styles.metaText, { color: colors.textSecondary, fontSize: 12 }]}>
                  ({recommendation.activity?.reviewsCount || 0})
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
        </Pressable>

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
          disabled={isRemoving}
        >
          <IconSymbol name="plus.circle.fill" size={30} color="#FFFFFF" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

// Memoize component to prevent unnecessary re-renders during filter animations
export const ActivityCardIntelligent = React.memo(
  ActivityCardIntelligentComponent,
  (prevProps, nextProps) => {
    // Only re-render if recommendation ID, index, or removing state changes
    // Handlers are assumed stable (will be memoized in parent)
    return prevProps.recommendation.id === nextProps.recommendation.id &&
           prevProps.index === nextProps.index &&
           prevProps.isRemoving === nextProps.isRemoving;
  }
);

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
  imagePressable: {
    width: '100%',
    height: '100%',
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

  // THREE-DOT MENU BUTTON
  menuButton: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // BADGES ON IMAGE
  badgeContainer: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'column',
    gap: Spacing.xs,
  },
  topMatchBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.95)', // Green background for top matches
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  topMatchText: {
    color: '#fff',
    fontSize: 11, // Small badge text
    fontWeight: '700',
    letterSpacing: 0.3,
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
    width: 48,
    height: 48,
    borderRadius: 24,
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
    width: CARD_WIDTH,
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
