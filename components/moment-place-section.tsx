/**
 * Moment Place Section Component
 *
 * Shows user-generated moments for a specific place.
 * Used in place details modal/screen.
 *
 * Features:
 * - "X Loop users visited" header
 * - Horizontal scroll of moment thumbnails
 * - "See all" link if many moments
 * - Empty state when no moments
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BrandColors, Spacing } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Moment, PlaceMomentsResult } from '@/types/moment';
import { getPlaceMoments, getMockFriendMoments } from '@/services/moments-service';

const THUMBNAIL_SIZE = 80;
const THUMBNAIL_GAP = 8;

interface MomentPlaceSectionProps {
  placeId: string;
  placeName: string;
  onViewMoment?: (moment: Moment) => void;
  onViewAll?: () => void;
  maxDisplay?: number;
}

/**
 * Moment thumbnail item
 */
function MomentThumbnail({
  moment,
  onPress,
}: {
  moment: Moment;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity
      style={styles.thumbnail}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.8}
    >
      <Image source={{ uri: moment.photoUrl }} style={styles.thumbnailImage} />
      {/* User avatar overlay */}
      {moment.user && (
        <View style={styles.thumbnailUserContainer}>
          {moment.user.profilePictureUrl ? (
            <Image
              source={{ uri: moment.user.profilePictureUrl }}
              style={styles.thumbnailUserAvatar}
            />
          ) : (
            <View style={[styles.thumbnailUserPlaceholder, { backgroundColor: colors.border }]}>
              <Text style={styles.thumbnailUserInitial}>
                {moment.user.name.charAt(0)}
              </Text>
            </View>
          )}
        </View>
      )}
      {/* Like count overlay */}
      {moment.likesCount > 0 && (
        <View style={styles.likeOverlay}>
          <Ionicons name="heart" size={12} color="white" />
          <Text style={styles.likeCount}>{moment.likesCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * Empty state when no moments
 */
function EmptyState({ placeName }: { placeName: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.emptyContainer, { backgroundColor: colors.card }]}>
      <Ionicons name="camera-outline" size={32} color={colors.icon} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No moments yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.icon }]}>
        Be the first to share a moment at {placeName}!
      </Text>
    </View>
  );
}

/**
 * Main MomentPlaceSection component
 */
export function MomentPlaceSection({
  placeId,
  placeName,
  onViewMoment,
  onViewAll,
  maxDisplay = 10,
}: MomentPlaceSectionProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [moments, setMoments] = useState<Moment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Fetch place moments
  useEffect(() => {
    let mounted = true;

    async function fetchMoments() {
      setIsLoading(true);
      setHasError(false);

      try {
        const result = await getPlaceMoments(placeId, maxDisplay + 1, 0);

        if (mounted) {
          setMoments(result.moments.slice(0, maxDisplay));
          setTotalCount(result.totalCount);
        }
      } catch (error) {
        console.error('Failed to fetch place moments:', error);
        if (mounted) {
          setHasError(true);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchMoments();

    return () => {
      mounted = false;
    };
  }, [placeId, maxDisplay]);

  const handleViewMoment = useCallback(
    (moment: Moment) => {
      onViewMoment?.(moment);
    },
    [onViewMoment]
  );

  const handleViewAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onViewAll?.();
  }, [onViewAll]);

  const renderItem = useCallback(
    ({ item }: { item: Moment }) => (
      <MomentThumbnail moment={item} onPress={() => handleViewMoment(item)} />
    ),
    [handleViewMoment]
  );

  const keyExtractor = useCallback((item: Moment) => item.id, []);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={BrandColors.loopBlue} />
        </View>
      </View>
    );
  }

  // Error state - just don't show the section
  if (hasError) {
    return null;
  }

  // Empty state
  if (moments.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState placeName={placeName} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="people" size={18} color={BrandColors.loopBlue} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {totalCount} {totalCount === 1 ? 'Loop user' : 'Loop users'} visited
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.icon }]}>
              See what they shared
            </Text>
          </View>
        </View>

        {totalCount > maxDisplay && onViewAll && (
          <TouchableOpacity onPress={handleViewAll} style={styles.seeAllButton}>
            <Text style={[styles.seeAllText, { color: BrandColors.loopBlue }]}>See all</Text>
            <Ionicons name="chevron-forward" size={16} color={BrandColors.loopBlue} />
          </TouchableOpacity>
        )}
      </View>

      {/* Moments horizontal scroll */}
      <FlatList
        horizontal
        data={moments}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        snapToInterval={THUMBNAIL_SIZE + THUMBNAIL_GAP}
        decelerationRate="fast"
      />

      {/* Social proof badges */}
      {moments.length >= 3 && (
        <View style={styles.socialProof}>
          <LinearGradient
            colors={[`${BrandColors.loopBlue}15`, `${BrandColors.loopGreen}15`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.socialProofGradient}
          >
            <Ionicons name="flame" size={14} color={BrandColors.loopBlue} />
            <Text style={[styles.socialProofText, { color: BrandColors.loopBlue }]}>
              Popular with Loop users
            </Text>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.md,
  },
  loadingContainer: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${BrandColors.loopBlue}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    gap: THUMBNAIL_GAP,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailUserContainer: {
    position: 'absolute',
    top: 4,
    left: 4,
  },
  thumbnailUserAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  thumbnailUserPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailUserInitial: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  likeOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  likeCount: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  emptyContainer: {
    padding: Spacing.lg,
    borderRadius: 12,
    marginHorizontal: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  socialProof: {
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  socialProofGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  socialProofText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
