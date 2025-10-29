import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Activity } from '@/types/activity';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, Shadows, BrandColors } from '@/constants/brand';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface ActivityCardModernProps {
  activity: Activity;
  onAddToCalendar: (activity: Activity) => void;
  onSeeDetails: (activity: Activity) => void;
  onDismiss?: (activity: Activity) => void;
  reason?: string;
  userName?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HEIGHT = 520;
const IMAGE_HEIGHT = 300;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

export function ActivityCardModern({
  activity,
  onAddToCalendar,
  onSeeDetails,
  onDismiss,
  reason,
  userName,
}: ActivityCardModernProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const [liked, setLiked] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Animation refs
  const pan = useRef(new Animated.ValueXY()).current;
  const likeScale = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const imageOpacity = useRef(new Animated.Value(0)).current;

  // Double tap detection
  const lastTap = useRef<number | null>(null);
  const DOUBLE_TAP_DELAY = 300;

  const handleImageLoad = () => {
    setImageLoaded(true);
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (lastTap.current && now - lastTap.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      if (!liked) {
        triggerLike();
      }
    } else {
      lastTap.current = now;
    }
  };

  const triggerLike = () => {
    setLiked(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate heart
    Animated.sequence([
      Animated.spring(likeScale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.delay(400),
      Animated.timing(likeScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(cardScale, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(cardScale, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handleAddToCalendar = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAddToCalendar(activity);
  };

  const getPriceDisplay = (priceRange: number) => {
    return '$'.repeat(Math.max(1, priceRange));
  };

  const getDistanceText = (distance?: number) => {
    if (!distance) return '';
    return distance < 1 ? `${(distance * 5280).toFixed(0)} ft` : `${distance.toFixed(1)} mi`;
  };

  const getPersonalizedReason = () => {
    if (!reason) return '';
    const firstName = userName?.split(' ')[0] || 'You';
    return reason.replace(/^(Based on|Because|Since)/, `${firstName},`);
  };

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          transform: [{ scale: cardScale }],
        },
      ]}
    >
      <View style={[styles.card, { backgroundColor: colors.card }, Shadows.md]}>
        {/* Image with double-tap overlay */}
        <Pressable onPress={handleDoubleTap}>
          <View style={styles.imageContainer}>
            <Animated.Image
              source={{ uri: activity.photoUrl }}
              style={[styles.image, { opacity: imageOpacity }]}
              resizeMode="cover"
              onLoad={handleImageLoad}
            />

            {/* Skeleton placeholder */}
            {!imageLoaded && (
              <View style={[styles.imageSkeleton, { backgroundColor: colors.border }]} />
            )}

            {/* Like animation overlay */}
            <Animated.View
              style={[
                styles.likeOverlay,
                {
                  opacity: likeScale,
                  transform: [{ scale: likeScale }],
                },
              ]}
            >
              <View style={styles.likeCircle}>
                <IconSymbol name="heart.fill" size={60} color={BrandColors.like} />
              </View>
            </Animated.View>

            {/* Sponsored badge */}
            {activity.isSponsored && (
              <View style={[styles.sponsoredBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.sponsoredText}>Sponsored</Text>
              </View>
            )}

            {/* Like indicator */}
            {liked && (
              <View style={styles.likedIndicator}>
                <IconSymbol name="heart.fill" size={16} color={BrandColors.like} />
              </View>
            )}
          </View>
        </Pressable>

        {/* Content */}
        <View style={styles.content}>
          {/* Title */}
          <Text style={[styles.name, Typography.titleLarge, { color: colors.text }]} numberOfLines={2}>
            {activity.name}
          </Text>

          {/* Metadata row */}
          <View style={styles.metadata}>
            {activity.rating && (
              <View style={styles.metaItem}>
                <IconSymbol name="star.fill" size={16} color={BrandColors.star} />
                <Text style={[styles.metaText, Typography.bodyMedium, { color: colors.text }]}>
                  {activity.rating.toFixed(1)}
                </Text>
                {activity.reviewsCount && (
                  <Text style={[styles.metaTextLight, Typography.bodySmall, { color: colors.textSecondary }]}>
                    ({activity.reviewsCount.toLocaleString()})
                  </Text>
                )}
              </View>
            )}

            <View style={styles.metaDivider} />

            <View style={styles.metaItem}>
              <Text style={[styles.metaText, Typography.labelMedium, { color: colors.text }]}>
                {getPriceDisplay(activity.priceRange)}
              </Text>
            </View>

            {activity.distance && (
              <>
                <View style={styles.metaDivider} />
                <View style={styles.metaItem}>
                  <IconSymbol name="location.fill" size={14} color={colors.textSecondary} />
                  <Text style={[styles.metaText, Typography.bodySmall, { color: colors.textSecondary }]}>
                    {getDistanceText(activity.distance)}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.metaDivider} />

            <View style={[styles.categoryBadge, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.categoryText, Typography.labelSmall, { color: colors.textSecondary }]}>
                {activity.category}
              </Text>
            </View>
          </View>

          {/* AI Reason - Personalized */}
          {reason && (
            <View style={[styles.reasonContainer, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={styles.sparkleIcon}>
                <IconSymbol name="star.fill" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.reason, Typography.bodyMedium, { color: colors.text }]} numberOfLines={3}>
                {getPersonalizedReason()}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleAddToCalendar}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <IconSymbol name="calendar.badge.plus" size={20} color="#FFFFFF" />
              <Text style={[styles.primaryButtonText, Typography.labelLarge]}>Add to Calendar</Text>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSeeDetails(activity);
              }}
            >
              <Text style={[styles.secondaryButtonText, Typography.labelLarge, { color: colors.textSecondary }]}>
                See Details
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
  },
  card: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageSkeleton: {
    ...StyleSheet.absoluteFillObject,
  },
  likeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  likeCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  sponsoredBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  sponsoredText: {
    color: '#FFFFFF',
    ...Typography.labelSmall,
  },
  likedIndicator: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    padding: Spacing.md,
  },
  name: {
    marginBottom: Spacing.sm,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontWeight: '500',
  },
  metaTextLight: {
    marginLeft: 2,
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: BrandColors.veryLightGray,
    marginHorizontal: Spacing.xs,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  categoryText: {
    textTransform: 'capitalize',
  },
  reasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sparkleIcon: {
    marginTop: 2,
  },
  reason: {
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    gap: Spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
});
