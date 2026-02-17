/**
 * ExploreTile - Rich tile component for the explore grid
 *
 * Features:
 * - Bottom gradient overlay with place name, rating, price
 * - Category chip on large tiles
 * - Open Now green dot (top-right)
 * - Trending flame badge for popular places (top-left)
 * - Moment gradient border ring treatment
 * - Placeholder for missing images
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES } from '@/components/category-selector';
import type { ExploreItem } from '@/types/explore';
import { BrandColors } from '@/constants/brand';

/** Short labels for category chips on large tiles */
const SHORT_LABELS: Record<string, string> = {
  all: 'All',
  dining: 'Dining',
  coffee: 'Coffee',
  nightlife: 'Bars',
  entertainment: 'Fun',
  culture: 'Arts',
  shopping: 'Shopping',
  fitness: 'Fitness',
  outdoors: 'Outdoors',
  events: 'Events',
  family: 'Family',
  attractions: 'Sights',
  everyday: 'Everyday',
};

function getCategoryMeta(categoryId?: string) {
  if (!categoryId) return null;
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return null;
  return { label: SHORT_LABELS[categoryId] || cat.label, color: cat.color };
}

function formatPrice(priceLevel?: number): string {
  if (priceLevel == null || priceLevel === 0) return '';
  return '$'.repeat(priceLevel);
}

interface ExploreTileProps {
  item: ExploreItem;
  width: number;
  height: number;
  onPress: (item: ExploreItem) => void;
  borderColor?: string; // placeholder bg color
}

function ExploreTileInner({ item, width, height, onPress, borderColor = '#2C2C2E' }: ExploreTileProps) {
  const isLarge = item.tileSize === 'large';
  const isMoment = item.type === 'moment';
  const isTrending = item.type === 'place' && (item.rating ?? 0) >= 4.5 && (item.reviewCount ?? 0) >= 200;

  const ratingText = item.rating ? `\u2605 ${item.rating.toFixed(1)}` : '';
  const priceText = formatPrice(item.priceLevel);
  const metaText = [ratingText, priceText].filter(Boolean).join('  ');

  const catMeta = getCategoryMeta(item.categoryId);

  // Moment ring: 2px gradient border effect via padding + gradient background
  const ringPadding = isMoment ? 2 : 0;
  const innerWidth = width - ringPadding * 2;
  const innerHeight = height - ringPadding * 2;

  const tileContent = (
    <View
      style={[
        styles.innerTile,
        {
          width: innerWidth,
          height: innerHeight,
          borderRadius: isLarge ? 4 : 1,
          backgroundColor: borderColor,
        },
      ]}
    >
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={[styles.image, { borderRadius: isLarge ? 4 : 1 }]}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholder} testID="tile-placeholder">
          <Ionicons
            name={isMoment ? 'camera' : 'image-outline'}
            size={isLarge ? 32 : 24}
            color="rgba(255,255,255,0.4)"
          />
        </View>
      )}

      {/* Bottom gradient overlay */}
      {item.type === 'place' && (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={[
            styles.gradientOverlay,
            { height: isLarge ? '40%' : '50%', borderRadius: isLarge ? 4 : 1 },
          ]}
          pointerEvents="none"
        >
          <Text
            style={[styles.tileName, isLarge ? styles.tileNameLarge : styles.tileNameSmall]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {metaText.length > 0 && (
            <Text
              style={[styles.tileMeta, isLarge ? styles.tileMetaLarge : styles.tileMetaSmall]}
              numberOfLines={1}
            >
              {metaText}
            </Text>
          )}
        </LinearGradient>
      )}

      {/* Category chip - large tiles only */}
      {isLarge && catMeta && item.type === 'place' && (
        <View style={[styles.categoryChip, { backgroundColor: catMeta.color }]} testID="category-chip">
          <Text style={styles.categoryChipText}>{catMeta.label}</Text>
        </View>
      )}

      {/* Open Now dot - top right */}
      {item.openNow === true && item.type === 'place' && (
        <View style={styles.openNowDot} testID="open-now-dot" />
      )}

      {/* Trending badge - top left */}
      {isTrending && (
        <View style={styles.trendingBadge} testID="trending-badge">
          <Ionicons name="flame" size={12} color="#FF6B35" />
        </View>
      )}

      {/* Moment camera badge - top left (if not trending) */}
      {isMoment && (
        <View style={styles.momentBadge}>
          <Ionicons name="camera" size={12} color="#FFFFFF" />
        </View>
      )}
    </View>
  );

  // Wrap with gradient ring for moments
  const wrappedContent = isMoment ? (
    <LinearGradient
      colors={[BrandColors.loopBlue, BrandColors.loopGreen]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.momentRing,
        { width, height, borderRadius: isLarge ? 6 : 3 },
      ]}
      testID="moment-ring"
    >
      {tileContent}
    </LinearGradient>
  ) : (
    tileContent
  );

  return (
    <TouchableOpacity
      style={{ width, height }}
      activeOpacity={0.9}
      onPress={() => onPress(item)}
      testID={`explore-tile-${item.id}`}
    >
      {wrappedContent}
    </TouchableOpacity>
  );
}

export const ExploreTile = React.memo(ExploreTileInner);

const styles = StyleSheet.create({
  innerTile: {
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: 6,
    paddingBottom: 5,
  },
  tileName: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tileNameSmall: {
    fontSize: 11,
  },
  tileNameLarge: {
    fontSize: 14,
  },
  tileMeta: {
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  tileMetaSmall: {
    fontSize: 10,
  },
  tileMetaLarge: {
    fontSize: 12,
  },
  categoryChip: {
    position: 'absolute',
    bottom: 36,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryChipText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  openNowDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  trendingBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 3,
    borderRadius: 4,
  },
  momentBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    borderRadius: 4,
  },
  momentRing: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
