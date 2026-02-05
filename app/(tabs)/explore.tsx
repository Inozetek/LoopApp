/**
 * Explore Tab - Search, browse, discover activities
 *
 * Features:
 * - Search bar with autocomplete
 * - Category browsing
 * - Trending activities grid (Instagram-style)
 * - No daily limits (unlimited browsing)
 * - Infinite scroll support
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BrandColors, BorderRadius, Typography, Shadows } from '@/constants/brand';
import { ACTIVITY_CATEGORIES, type ActivityCategory } from '@/constants/activity-categories';
import { useAuth } from '@/contexts/auth-context';
import { getCurrentLocation } from '@/services/location-service';
import { generateRecommendations, type RecommendationParams, type ScoredRecommendation } from '@/services/recommendations';
import { SeeDetailsModal } from '@/components/see-details-modal';
import SwipeableLayout from '@/components/swipeable-layout';
import { ExploreHeader } from '@/components/explore-header';
import type { Recommendation, Activity, RecommendationScore } from '@/types/activity';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = Spacing.sm;
const GRID_COLUMNS = 2;
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - Spacing.md * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

type PlaceLocation = { lat: number; lng: number };

export default function ExploreScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = ThemeColors[colorScheme];
  const { user } = useAuth();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Activities state
  const [trendingActivities, setTrendingActivities] = useState<ScoredRecommendation[]>([]);
  const [searchResults, setSearchResults] = useState<ScoredRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userLocation, setUserLocation] = useState<PlaceLocation | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [excludePlaceIds, setExcludePlaceIds] = useState<string[]>([]);

  // Modal state
  const [selectedRecommendation, setSelectedRecommendation] = useState<ScoredRecommendation | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Moments (Loop Stories) state
  // Load trending activities on mount
  useEffect(() => {
    loadTrendingActivities();
  }, [user]);

  // Load activities when category changes
  useEffect(() => {
    if (selectedCategory) {
      loadTrendingActivities(selectedCategory);
    } else {
      loadTrendingActivities();
    }
  }, [selectedCategory]);

  const loadTrendingActivities = async (category?: string, reset: boolean = true) => {
    if (!user) return;

    console.log('🎯 loadTrendingActivities called:', { category, reset, currentCount: trendingActivities.length });

    try {
      if (reset) {
        console.log('🔄 Reset mode: clearing existing data');
        setLoading(true);
        setExcludePlaceIds([]);
        setHasMore(true);
      } else {
        console.log('➕ Append mode: excludeIds count =', excludePlaceIds.length);
      }

      // Get user location
      const location = await getCurrentLocation();
      const loc: PlaceLocation = {
        lat: location.latitude,
        lng: location.longitude,
      };
      setUserLocation(loc);

      const params: RecommendationParams = {
        user: user!,
        userLocation: loc,
        maxDistance: 25, // 25 miles for explore
        maxResults: 30, // Load 30 at a time for better pagination
        discoveryMode: 'explore', // Explore mode for variety
        categories: category ? [category] : undefined,
        excludePlaceIds: reset ? [] : excludePlaceIds,
      };

      const results = await generateRecommendations(params);
      console.log(`📊 Explore: Got ${results.length} recommendations (reset: ${reset})`);
      console.log(`📊 First 3 results:`, results.slice(0, 3).map(r => ({ name: r.place?.name, score: r.score })));

      // Sort by rating for "trending"
      const sorted = [...results].sort((a, b) => {
        const ratingA = a.place?.rating || 0;
        const ratingB = b.place?.rating || 0;
        return ratingB - ratingA;
      });

      // Track place IDs to exclude in next load
      const newPlaceIds = sorted
        .map(r => r.place?.place_id)
        .filter((id): id is string => !!id);

      if (reset) {
        setTrendingActivities(sorted);
        setExcludePlaceIds(newPlaceIds);
        console.log(`✅ Initial load: ${sorted.length} activities`);
      } else {
        setTrendingActivities(prev => {
          const updated = [...prev, ...sorted];
          setExcludePlaceIds(prevIds => [...prevIds, ...newPlaceIds]);
          console.log(`✅ Loaded more: +${sorted.length} activities (total: ${updated.length})`);
          return updated;
        });
      }

      // Check if we have more to load
      // Check if we got at least 80% of maxResults (24/30), indicating more content available
      // Also cap at 300 total to prevent infinite loading
      const currentTotal = reset ? sorted.length : trendingActivities.length + sorted.length;
      const hasMoreContent = sorted.length >= (params.maxResults * 0.8) && currentTotal < 300;
      setHasMore(hasMoreContent);
      console.log(`🔄 Has more: ${hasMoreContent} (got ${sorted.length}, total: ${currentTotal}/300)`);
    } catch (error) {
      console.error('❌ Error loading trending activities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load more activities (infinite scroll)
  const loadMoreActivities = async () => {
    if (loadingMore || !hasMore || loading || searchQuery.length >= 2) {
      console.log('⏸️ Skipping load more:', { loadingMore, hasMore, loading, searchLength: searchQuery.length });
      return;
    }

    console.log('🔄 Loading more activities...');
    try {
      setLoadingMore(true);
      await loadTrendingActivities(selectedCategory || undefined, false);
    } catch (error) {
      console.error('❌ Error loading more activities:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTrendingActivities(selectedCategory || undefined);
    setRefreshing(false);
  }, [selectedCategory, user]);

  // Handle search with debounce
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);

    // Clear previous debounce
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (text.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Debounce search
    searchDebounceRef.current = setTimeout(async () => {
      if (!user || !userLocation) return;

      try {
        const params: RecommendationParams = {
          user: user!,
          userLocation,
          maxDistance: 50, // Wider search area
          maxResults: 20,
          discoveryMode: 'explore',
        };

        const results = await generateRecommendations(params);

        // Filter by search query (simple text match)
        const filtered = results.filter(r => {
          const name = r.place?.name?.toLowerCase() || '';
          const types = r.place?.types?.join(' ').toLowerCase() || '';
          const query = text.toLowerCase();
          return name.includes(query) || types.includes(query);
        });

        setSearchResults(filtered);
      } catch (error) {
        console.error('❌ Error searching:', error);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, [user, userLocation]);

  // Handle category selection
  const handleCategoryPress = useCallback((categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(prev => prev === categoryId ? null : categoryId);
  }, []);

  // Helper to format place type as category
  const formatCategory = useCallback((types: string[] | undefined) => {
    if (!types || types.length === 0) return 'Activity';
    // Format first type: remove underscores, capitalize
    const type = types.find(t => !['point_of_interest', 'establishment'].includes(t)) || types[0];
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }, []);

  // Helper to get photo URL from place
  const getPhotoUrl = useCallback((place: ScoredRecommendation['place'], maxWidth: number = 400) => {
    if (!place?.photos?.[0]?.photo_reference) return null;
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`;
  }, []);

  // Convert ScoredRecommendation to Recommendation format for modal
  const convertToRecommendation = useCallback((scored: ScoredRecommendation): Recommendation => {
    const place = scored.place;
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

    // Get photo URLs
    const photos = place?.photos?.map(p =>
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${apiKey}`
    ) || [];

    // Create Activity object
    const activity: Activity = {
      id: place?.place_id || '',
      name: place?.name || 'Unknown',
      category: formatCategory(place?.types),
      location: {
        latitude: place?.geometry?.location?.lat || 0,
        longitude: place?.geometry?.location?.lng || 0,
        address: place?.formatted_address || place?.vicinity || '',
      },
      rating: place?.rating || 0,
      priceRange: place?.price_level || 0,
      photoUrl: photos[0] || undefined,
      googlePlaceId: place?.place_id,
      phone: place?.formatted_phone_number,
      website: place?.website,
    };

    // Convert score breakdown
    const scoreBreakdown: RecommendationScore = {
      baseScore: scored.scoreBreakdown?.baseScore || 0,
      locationScore: scored.scoreBreakdown?.locationScore || 0,
      timeScore: scored.scoreBreakdown?.timeScore || 0,
      feedbackScore: scored.scoreBreakdown?.feedbackScore || 0,
      collaborativeScore: scored.scoreBreakdown?.collaborativeScore || 0,
      sponsorBoost: scored.scoreBreakdown?.sponsoredBoost || 0,
      finalScore: scored.score || 0,
    };

    return {
      id: place?.place_id || `rec-${Date.now()}`,
      title: place?.name || 'Unknown',
      category: formatCategory(place?.types),
      location: place?.formatted_address || place?.vicinity || '',
      distance: '', // Will be calculated if needed
      priceRange: place?.price_level || 0,
      rating: place?.rating || 0,
      imageUrl: photos[0] || '',
      photos: photos,
      aiExplanation: scored.scoreBreakdown ? 'Matched based on your preferences' : '',
      description: place?.description,
      openNow: place?.opening_hours?.open_now,
      isSponsored: false,
      score: scored.score,
      scoreBreakdown,
      businessHours: place?.opening_hours,
      activity,
    };
  }, [formatCategory]);

  // Handle activity press
  const handleActivityPress = useCallback((recommendation: ScoredRecommendation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRecommendation(recommendation);
    setShowDetailsModal(true);
  }, []);

  // Display activities (search results or trending)
  const displayActivities = searchQuery.length >= 2 ? searchResults : trendingActivities;

  // Handle end reached for infinite scroll
  const handleEndReached = useCallback(() => {
    console.log('📍 End reached:', { loading, hasMore, loadingMore, searchLength: searchQuery.length, selectedCategory });
    if (!loading && !loadingMore && hasMore && searchQuery.length < 2) {
      console.log('✅ Triggering load more...');
      loadMoreActivities();
    }
  }, [loading, hasMore, searchQuery.length, loadingMore, selectedCategory, loadMoreActivities]);

  // Render category item
  const renderCategoryItem = ({ item }: { item: ActivityCategory }) => {
    const isSelected = selectedCategory === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.categoryItem,
          {
            backgroundColor: isSelected ? BrandColors.loopBlue : colors.cardBackground,
            borderColor: isSelected ? BrandColors.loopBlue : colors.border,
          },
        ]}
        onPress={() => handleCategoryPress(item.id)}
        activeOpacity={0.7}
      >
        <Text style={styles.categoryEmoji}>{item.icon}</Text>
        <Text
          style={[
            styles.categoryLabel,
            { color: isSelected ? '#FFFFFF' : colors.text },
          ]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render grid item for FlatList
  const renderGridItem = useCallback(({ item }: { item: ScoredRecommendation }) => {
    const photoUrl = getPhotoUrl(item.place);
    const rating = item.place?.rating;
    const priceLevel = item.place?.price_level;

    return (
      <TouchableOpacity
        style={[styles.gridItem, { backgroundColor: colors.cardBackground }, Shadows.sm]}
        activeOpacity={0.8}
        onPress={() => handleActivityPress(item)}
      >
        <View style={[styles.gridItemImage, { backgroundColor: colors.border }]}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.gridItemImageContent}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
          )}

          {/* Rating badge */}
          {rating && rating > 0 && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        <View style={styles.gridItemContent}>
          <Text style={[styles.gridItemTitle, { color: colors.text }]} numberOfLines={2}>
            {item.place?.name || 'Unknown Place'}
          </Text>
          <View style={styles.gridItemMeta}>
            <Text style={[styles.gridItemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {formatCategory(item.place?.types)}
            </Text>
            {priceLevel !== undefined && priceLevel > 0 && (
              <Text style={[styles.gridItemPrice, { color: colors.textSecondary }]}>
                {'$'.repeat(priceLevel)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [colors, handleActivityPress, getPhotoUrl, formatCategory]);

  // Render footer (loading more indicator)
  const renderFooter = useCallback(() => {
    if (loadingMore) {
      return (
        <View style={styles.loadingMoreContainer}>
          <ActivityIndicator size="small" color={BrandColors.loopBlue} />
          <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>
            Loading more...
          </Text>
        </View>
      );
    }

    if (hasMore && searchQuery.length < 2) {
      return (
        <View style={styles.loadingMoreContainer}>
          <TouchableOpacity
            style={[styles.loadMoreButton, { backgroundColor: BrandColors.loopBlue }]}
            onPress={loadMoreActivities}
            activeOpacity={0.7}
          >
            <Text style={styles.loadMoreButtonText}>Load More</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return <View style={{ height: 100 }} />;
  }, [loadingMore, hasMore, searchQuery.length, colors, loadMoreActivities]);

  // List header component (categories + section title)
  const ListHeader = useCallback(() => (
    <>
      {/* Categories Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse by Category</Text>
        <FlatList
          data={ACTIVITY_CATEGORIES}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      {/* Results Section Title */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {searchQuery.length >= 2
              ? `Results for "${searchQuery}"`
              : selectedCategory
                ? ACTIVITY_CATEGORIES.find(c => c.id === selectedCategory)?.name || 'Category'
                : 'Trending Near You'}
          </Text>
          {displayActivities.length > 0 && (
            <Text style={[{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }]}>
              Showing {displayActivities.length} activities {hasMore && !searchQuery ? '• More available' : ''}
            </Text>
          )}
        </View>
        {displayActivities.length > 0 && (
          <Text style={[styles.countBadge, { color: colors.textSecondary }]}>
            {displayActivities.length}{hasMore && !searchQuery ? '+' : ''}
          </Text>
        )}
      </View>
    </>
  ), [colors, searchQuery, selectedCategory, displayActivities.length, hasMore, renderCategoryItem]);

  return (
    <SwipeableLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Explore Header */}
        <ExploreHeader
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          placeholder="Search activities, places, events..."
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BrandColors.loopBlue} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Finding activities...
            </Text>
          </View>
        ) : displayActivities.length === 0 ? (
          <>
            <ListHeader />
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery.length >= 2
                  ? 'No results found. Try a different search.'
                  : 'No activities found in this area.'}
              </Text>
            </View>
          </>
        ) : (
          <FlatList
            data={displayActivities}
            renderItem={renderGridItem}
            keyExtractor={(item, index) => item.place?.place_id || `activity-${index}`}
            numColumns={GRID_COLUMNS}
            scrollEventThrottle={16}
            columnWrapperStyle={styles.gridRow}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={renderFooter}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={BrandColors.loopBlue}
              />
            }
          />
        )}

        {/* Details Modal */}
        {selectedRecommendation && (
          <SeeDetailsModal
            visible={showDetailsModal}
            recommendation={convertToRecommendation(selectedRecommendation)}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedRecommendation(null);
            }}
            onAddToCalendar={() => {
              // TODO: Implement add to calendar
              setShowDetailsModal(false);
              setSelectedRecommendation(null);
            }}
          />
        )}

      </View>
    </SwipeableLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  countBadge: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: Spacing.md,
  },
  categoriesList: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Grid
  gridContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: GRID_ITEM_WIDTH,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  gridItemImage: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  gridItemImageContent: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  gridItemContent: {
    padding: Spacing.sm,
  },
  gridItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  gridItemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  gridItemSubtitle: {
    fontSize: 12,
    flex: 1,
  },
  gridItemPrice: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Loading & Empty
  loadingContainer: {
    padding: Spacing.xl * 2,
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    padding: Spacing.xl * 2,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  loadingMoreText: {
    fontSize: 14,
  },
  loadMoreButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginVertical: Spacing.md,
  },
  loadMoreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Stats card
  statsCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
});
