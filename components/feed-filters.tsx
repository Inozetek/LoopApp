/**
 * Feed Filters Component
 * Allows users to filter recommendations by time, distance, and price
 */

import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';

export interface FeedFilters {
  timeOfDay: 'any' | 'morning' | 'afternoon' | 'evening' | 'night';
  maxDistance: number; // in miles
  priceRange: 'any' | 1 | 2 | 3 | 4;
}

interface FeedFiltersProps {
  filters: FeedFilters;
  onFiltersChange: (filters: FeedFilters) => void;
  onInteraction?: () => void; // Called on any touch/scroll activity
}

export function FeedFiltersBar({ filters, onFiltersChange, onInteraction }: FeedFiltersProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const handleTimeChange = (time: FeedFilters['timeOfDay']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFiltersChange({ ...filters, timeOfDay: time });
  };

  const handleDistanceChange = (distance: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFiltersChange({ ...filters, maxDistance: distance });
  };

  const handlePriceChange = (price: FeedFilters['priceRange']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFiltersChange({ ...filters, priceRange: price });
  };

  const getTimeIcon = (time: FeedFilters['timeOfDay']) => {
    const icons: Record<FeedFilters['timeOfDay'], string> = {
      any: 'clock.fill',
      morning: 'sunrise.fill',
      afternoon: 'sun.max.fill',
      evening: 'sunset.fill',
      night: 'moon.stars.fill',
    };
    return icons[time];
  };

  const getTimeLabel = (time: FeedFilters['timeOfDay']) => {
    const labels: Record<FeedFilters['timeOfDay'], string> = {
      any: 'Any Time',
      morning: 'Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      night: 'Night',
    };
    return labels[time];
  };

  const getDistanceLabel = (distance: number) => {
    if (distance >= 100) return 'Any';
    return `${distance} mi`;
  };

  const getPriceLabel = (price: FeedFilters['priceRange']) => {
    if (price === 'any') return 'Any $';
    return '$'.repeat(price as number);
  };

  return (
    <View style={styles.container} testID="feed-filters">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onTouchStart={() => onInteraction?.()}
        onScroll={() => onInteraction?.()}
        scrollEventThrottle={100}
      >
        {/* TIME FILTER */}
        <View style={styles.filterGroup}>
          <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Time</Text>
          <View style={styles.filterButtons}>
            {(['any', 'morning', 'afternoon', 'evening', 'night'] as const).map((time) => (
              <Pressable
                key={time}
                onPress={() => handleTimeChange(time)}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor:
                      filters.timeOfDay === time
                        ? BrandColors.loopBlue
                        : colors.cardBackground,
                  },
                ]}
              >
                <IconSymbol
                  name={getTimeIcon(time)}
                  size={16}
                  color={filters.timeOfDay === time ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterButtonText,
                    {
                      color:
                        filters.timeOfDay === time ? '#FFFFFF' : colors.text,
                    },
                  ]}
                >
                  {getTimeLabel(time)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* DISTANCE FILTER */}
        <View style={styles.filterGroup}>
          <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Distance</Text>
          <View style={styles.filterButtons}>
            {[1, 3, 5, 10, 100].map((distance) => (
              <Pressable
                key={distance}
                onPress={() => handleDistanceChange(distance)}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor:
                      filters.maxDistance === distance
                        ? BrandColors.loopBlue
                        : colors.cardBackground,
                  },
                ]}
              >
                <IconSymbol
                  name="location.fill"
                  size={16}
                  color={filters.maxDistance === distance ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterButtonText,
                    {
                      color:
                        filters.maxDistance === distance ? '#FFFFFF' : colors.text,
                    },
                  ]}
                >
                  {getDistanceLabel(distance)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* PRICE FILTER */}
        <View style={styles.filterGroup}>
          <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Price</Text>
          <View style={styles.filterButtons}>
            {(['any', 1, 2, 3, 4] as const).map((price) => (
              <Pressable
                key={price}
                onPress={() => handlePriceChange(price)}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor:
                      filters.priceRange === price
                        ? BrandColors.loopBlue
                        : colors.cardBackground,
                  },
                ]}
              >
                <IconSymbol
                  name="dollarsign.circle.fill"
                  size={16}
                  color={filters.priceRange === price ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterButtonText,
                    {
                      color:
                        filters.priceRange === price ? '#FFFFFF' : colors.text,
                    },
                  ]}
                >
                  {getPriceLabel(price)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.md,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.lg,
  },
  filterGroup: {
    gap: Spacing.xs,
  },
  filterLabel: {
    ...Typography.caption,
    fontFamily: 'Urbanist-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  filterButtonText: {
    ...Typography.caption,
    fontFamily: 'Urbanist-Medium',
  },
});
