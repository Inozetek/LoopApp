/**
 * Activity Card - Ultra Minimal Design
 * Instagram/Tinder-inspired with clean aesthetics
 */

import { useState, useRef, useEffect } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Activity } from '@/types/activity';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface ActivityCardMinimalProps {
  activity: Activity;
  onAddToCalendar: (activity: Activity) => void;
  onSeeDetails: (activity: Activity) => void;
  index: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = Spacing.md;
const CARD_WIDTH = SCREEN_WIDTH - (CARD_PADDING * 2);
const IMAGE_HEIGHT = SCREEN_WIDTH * 1.25; // Taller, more immersive

export function ActivityCardMinimal({
  activity,
  onAddToCalendar,
  onSeeDetails,
  index,
}: ActivityCardMinimalProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const [imageLoaded, setImageLoaded] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Stagger animation based on index
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: index * 100,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
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
    if (priceRange === 0) return 'Free';
    return '$'.repeat(Math.max(1, priceRange));
  };

  const getDistanceText = (distance?: number) => {
    if (!distance) return null;
    return distance < 1
      ? `${(distance * 5280).toFixed(0)} ft away`
      : `${distance.toFixed(1)} mi away`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <Pressable
        onPress={() => onSeeDetails(activity)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.card },
        ]}
      >
        {/* Image Container */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: activity.photoUrl }}
            style={styles.image}
            resizeMode="cover"
            onLoad={handleImageLoad}
          />

          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
            style={styles.gradient}
          />

          {/* Image Skeleton */}
          {!imageLoaded && (
            <View style={[styles.imageSkeleton, { backgroundColor: colors.border }]} />
          )}

          {/* Sponsored Badge - Top Right */}
          {activity.isSponsored && (
            <View style={[styles.sponsoredBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
              <Text style={styles.sponsoredText}>Sponsored</Text>
            </View>
          )}

          {/* Content Overlay - Bottom */}
          <View style={styles.overlayContent}>
            {/* Category Badge */}
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{activity.category}</Text>
            </View>

            {/* Title */}
            <Text style={styles.title} numberOfLines={2}>
              {activity.name}
            </Text>

            {/* Metadata Row */}
            <View style={styles.metadata}>
              {activity.rating && (
                <View style={styles.metaItem}>
                  <IconSymbol name="star.fill" size={14} color={BrandColors.star} />
                  <Text style={styles.metaText}>
                    {activity.rating.toFixed(1)}
                  </Text>
                </View>
              )}

              <View style={styles.metaDot} />

              <View style={styles.metaItem}>
                <Text style={styles.metaText}>
                  {getPriceDisplay(activity.priceRange)}
                </Text>
              </View>

              {activity.distance && (
                <>
                  <View style={styles.metaDot} />
                  <View style={styles.metaItem}>
                    <Text style={styles.metaText}>
                      {getDistanceText(activity.distance)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.actionContainer}>
          <Pressable
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={handleAddToCalendar}
            onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <IconSymbol name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add to Calendar</Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
    paddingHorizontal: CARD_PADDING,
  },
  card: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
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
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  sponsoredBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backdropFilter: 'blur(10px)',
  },
  sponsoredText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  overlayContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
    backdropFilter: 'blur(10px)',
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  actionContainer: {
    padding: Spacing.md,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    shadowColor: BrandColors.loopBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
