/**
 * Explore Tab - Search, browse, discover activities
 *
 * UX REDESIGN (v5.0) - Rich Tile Grid:
 * - Search bar with category filter chips
 * - Instagram-style grid with gradient overlays, badges, ratings
 * - Category filtering via horizontal chip bar
 * - Search suggestions panel (recent + trending)
 * - Infinite scroll with expanding distance tiers
 *
 * Differentiation from Feed:
 * - Feed = AI-personalized cards, limited daily recommendations, vertical scroll
 * - Explore = Browse all categories, unlimited, visual grid discovery
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BrandColors } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { getCurrentLocation } from '@/services/location-service';
import { generateRecommendations, type RecommendationParams, type ScoredRecommendation } from '@/services/recommendations';
import { SeeDetailsModal } from '@/components/see-details-modal';
import SwipeableLayout from '@/components/swipeable-layout';
import { ExploreHeader } from '@/components/explore-header';
import { ExploreTile } from '@/components/explore-tile';
import { SearchSuggestionsPanel } from '@/components/search-suggestions-panel';
import type { Recommendation, Activity, RecommendationScore } from '@/types/activity';
import type { ExploreItem, ExploreRow } from '@/types/explore';
import {
  DISTANCE_TIERS,
  fetchExploreBatch,
  fetchExploreMoments,
  interleaveContent,
  groupIntoRows,
  recommendationToExploreItem,
} from '@/services/explore-service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 3;
const GRID_COLUMNS = 3;
const SMALL_TILE_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
const LARGE_TILE_WIDTH = SMALL_TILE_SIZE * 2 + GRID_GAP; // Spans 2 columns

type PlaceLocation = { lat: number; lng: number };

export default function ExploreScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = ThemeColors[colorScheme];
  const { user } = useAuth();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState('all');
  const selectedCategoryRef = useRef('all');

  // Synchronous state tracking (prevents race conditions)
  const isLoadingMoreRef = useRef<boolean>(false);
  const lastLoadMoreTime = useRef<number>(0);
  const hasMoreRef = useRef<boolean>(true);
  const excludePlaceIdsRef = useRef<string[]>([]);
  const distanceTierRef = useRef<number>(0);

  // Explore items state
  const [exploreRows, setExploreRows] = useState<ExploreRow[]>([]);
  const [allItems, setAllItems] = useState<ExploreItem[]>([]);
  const [moments, setMoments] = useState<ExploreItem[]>([]);
  const [searchResults, setSearchResults] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userLocation, setUserLocation] = useState<PlaceLocation | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [distanceTierIndex, setDistanceTierIndex] = useState(0);

  // Modal state
  const [selectedRecommendation, setSelectedRecommendation] = useState<ScoredRecommendation | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Keep refs in sync
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { distanceTierRef.current = distanceTierIndex; }, [distanceTierIndex]);
  useEffect(() => { selectedCategoryRef.current = selectedCategory; }, [selectedCategory]);

  // Trending items for search suggestions (top 6 by rating from allItems)
  const trendingItems = useMemo(() => {
    return allItems
      .filter((i) => i.type === 'place' && i.imageUrl)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 6);
  }, [allItems]);

  // Initial load
  useEffect(() => {
    if (user) loadInitialContent();
  }, [user]);

  async function loadInitialContent(categoryFilter?: string) {
    if (!user) return;
    setLoading(true);

    try {
      // Get user location
      const location = await getCurrentLocation();
      const loc: PlaceLocation = { lat: location.latitude, lng: location.longitude };
      setUserLocation(loc);

      const filterCat = categoryFilter ?? selectedCategoryRef.current;
      const catParam = filterCat !== 'all' ? filterCat : undefined;

      // Fetch moments and places in parallel
      const [momentItems, placeBatch] = await Promise.all([
        fetchExploreMoments({ userId: user.id }),
        fetchExploreBatch({
          user,
          userLocation: loc,
          distanceTier: 0,
          excludePlaceIds: [],
          batchSize: 30,
          categoryFilter: catParam,
        }),
      ]);

      setMoments(momentItems);

      // Track exclude IDs
      const placeIds = placeBatch.items
        .map((item) => item.id)
        .filter((id) => id);
      excludePlaceIdsRef.current = placeIds;

      // Interleave moments into places
      const mixed = interleaveContent(placeBatch.items, momentItems);

      // Group into rows
      const rows = groupIntoRows(mixed);

      setAllItems(mixed);
      setExploreRows(rows);
      setHasMore(placeBatch.hasMore);
      hasMoreRef.current = placeBatch.hasMore;
      setDistanceTierIndex(placeBatch.nextDistanceTier);
      distanceTierRef.current = placeBatch.nextDistanceTier;
    } catch (error) {
      console.error('Error loading explore content:', error);
    } finally {
      setLoading(false);
    }
  }

  // Category change handler
  const handleCategoryChange = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId);
    selectedCategoryRef.current = categoryId;
    // Reset grid state and reload
    excludePlaceIdsRef.current = [];
    hasMoreRef.current = true;
    distanceTierRef.current = 0;
    isLoadingMoreRef.current = false;
    setDistanceTierIndex(0);
    setHasMore(true);
    setAllItems([]);
    setExploreRows([]);
    loadInitialContent(categoryId);
  }, [user]);

  // Load more (infinite scroll)
  const loadMoreContent = async () => {
    console.log('[Explore] loadMoreContent called', {
      isLoadingMore: isLoadingMoreRef.current,
      hasMore: hasMoreRef.current,
      loading,
      searchActive: searchQuery.length >= 2,
      hasUser: !!user,
      hasLocation: !!userLocation,
      distanceTier: distanceTierRef.current,
    });

    if (isLoadingMoreRef.current) {
      console.log('[Explore] Blocked: already loading');
      return;
    }
    if (!hasMoreRef.current) {
      console.log('[Explore] Blocked: no more content');
      return;
    }
    if (loading) {
      console.log('[Explore] Blocked: initial loading');
      return;
    }
    if (searchQuery.length >= 2) {
      console.log('[Explore] Blocked: search active');
      return;
    }
    if (!user || !userLocation) {
      console.log('[Explore] Blocked: no user or location');
      return;
    }

    const now = Date.now();
    if (now - lastLoadMoreTime.current < 1000) {
      console.log('[Explore] Blocked: throttled (less than 1s since last load)');
      return;
    }

    isLoadingMoreRef.current = true;
    lastLoadMoreTime.current = now;
    setLoadingMore(true);

    try {
      const catParam = selectedCategoryRef.current !== 'all' ? selectedCategoryRef.current : undefined;
      console.log('[Explore] Fetching batch at tier', distanceTierRef.current);
      const batch = await fetchExploreBatch({
        user,
        userLocation,
        distanceTier: distanceTierRef.current,
        excludePlaceIds: excludePlaceIdsRef.current,
        batchSize: 30,
        categoryFilter: catParam,
      });

      console.log('[Explore] Batch fetched:', {
        itemCount: batch.items.length,
        hasMore: batch.hasMore,
        nextTier: batch.nextDistanceTier,
        firstItemWithImage: batch.items.find(i => i.imageUrl)?.title || 'none',
      });

      // Update exclude IDs
      const newIds = batch.items.map((item) => item.id).filter((id) => id);
      excludePlaceIdsRef.current = [...excludePlaceIdsRef.current, ...newIds];

      // Determine unshown moments
      const shownMomentIds = new Set(allItems.filter((i) => i.type === 'moment').map((i) => i.id));
      const unshownMoments = moments.filter((m) => !shownMomentIds.has(m.id));

      // Interleave remaining moments
      const mixed = interleaveContent(batch.items, unshownMoments);

      // Append to existing items
      const updatedItems = [...allItems, ...mixed];
      setAllItems(updatedItems);

      // Re-group all rows
      const rows = groupIntoRows(updatedItems);
      setExploreRows(rows);

      // Update state
      setHasMore(batch.hasMore);
      hasMoreRef.current = batch.hasMore;
      setDistanceTierIndex(batch.nextDistanceTier);
      distanceTierRef.current = batch.nextDistanceTier;
    } catch (error) {
      console.error('Error loading more explore content:', error);
    } finally {
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  };

  // Refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    excludePlaceIdsRef.current = [];
    hasMoreRef.current = true;
    distanceTierRef.current = 0;
    isLoadingMoreRef.current = false;
    setDistanceTierIndex(0);
    setHasMore(true);
    setAllItems([]);
    setExploreRows([]);
    await loadInitialContent();
    setRefreshing(false);
  }, [user]);

  // Add to recent searches (deduped, max 5)
  const addRecentSearch = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s !== query);
      return [query, ...filtered].slice(0, 5);
    });
  }, []);

  // Search with debounce
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (text.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      if (!user || !userLocation) return;
      try {
        const params: RecommendationParams = {
          user,
          userLocation,
          maxDistance: 50,
          maxResults: 20,
          discoveryMode: 'explore',
        };
        const results = await generateRecommendations(params);
        const filtered = results.filter((r) => {
          const name = r.place?.name?.toLowerCase() || '';
          const types = r.place?.types?.join(' ').toLowerCase() || '';
          const query = text.toLowerCase();
          return name.includes(query) || types.includes(query);
        });
        // Convert to ExploreItems for rich tile rendering
        setSearchResults(filtered.map(recommendationToExploreItem));
        // Save to recent searches
        addRecentSearch(text);
      } catch (error) {
        console.error('Error searching:', error);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, [user, userLocation, addRecentSearch]);

  // Helper to format category
  const formatCategory = useCallback((types: string[] | undefined) => {
    if (!types || types.length === 0) return 'Activity';
    const type = types.find((t) => !['point_of_interest', 'establishment'].includes(t)) || types[0];
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }, []);

  // Convert ScoredRecommendation to Recommendation for modal
  const convertToRecommendation = useCallback((scored: ScoredRecommendation): Recommendation => {
    const place = scored.place;
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

    // Handle all API photo formats
    const photos = place?.photos?.map((p: any) => {
      const photoRef = p.photo_reference;
      if (!photoRef) return '';
      if (photoRef.startsWith('http://') || photoRef.startsWith('https://')) return photoRef;
      if (photoRef.startsWith('places/')) {
        return `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=800&key=${apiKey}`;
      }
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`;
    }).filter(Boolean) || [];

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
      distance: '',
      priceRange: place?.price_level || 0,
      rating: place?.rating || 0,
      imageUrl: photos[0] || '',
      photos,
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

  // Handle item press (from ExploreTile or search)
  const handleItemPress = useCallback((item: ExploreItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.type === 'place' && item.recommendation) {
      setSelectedRecommendation(item.recommendation);
      setShowDetailsModal(true);
    }
  }, []);

  // End reached handler - uses refs to avoid stale closure issues
  const handleEndReached = useCallback(() => {
    console.log('[Explore] onEndReached triggered', {
      isLoadingMore: isLoadingMoreRef.current,
      hasMore: hasMoreRef.current,
      searchActive: searchQuery.length >= 2,
    });

    if (isLoadingMoreRef.current) return;
    if (!hasMoreRef.current) return;
    if (searchQuery.length >= 2) return;

    console.log('[Explore] Loading more content...');
    loadMoreContent();
  }, [searchQuery]);

  // Scroll event fallback for infinite scroll (backup trigger)
  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;

    if (isCloseToBottom && !isLoadingMoreRef.current && hasMoreRef.current && searchQuery.length < 2) {
      console.log('[Explore] Scroll fallback triggered - loading more');
      loadMoreContent();
    }
  }, [searchQuery]);

  // Render a row group using ExploreTile
  const renderRow = ({ item: row }: { item: ExploreRow }) => {
    if (row.layout === 'three-small') {
      return (
        <View style={styles.rowThreeSmall}>
          {row.items.map((item) => (
            <ExploreTile
              key={item.id}
              item={item}
              width={SMALL_TILE_SIZE}
              height={SMALL_TILE_SIZE}
              onPress={handleItemPress}
              borderColor={colors.border}
            />
          ))}
        </View>
      );
    }

    if (row.layout === 'large-left') {
      return (
        <View style={styles.rowMixed}>
          {row.items[0] && (
            <ExploreTile
              item={row.items[0]}
              width={LARGE_TILE_WIDTH}
              height={SMALL_TILE_SIZE * 1.5}
              onPress={handleItemPress}
              borderColor={colors.border}
            />
          )}
          {row.items[1] && (
            <View style={styles.smallTileStack}>
              <ExploreTile
                item={row.items[1]}
                width={SMALL_TILE_SIZE}
                height={SMALL_TILE_SIZE}
                onPress={handleItemPress}
                borderColor={colors.border}
              />
            </View>
          )}
        </View>
      );
    }

    // large-right
    return (
      <View style={styles.rowMixed}>
        {row.items[0] && (
          <View style={styles.smallTileStack}>
            <ExploreTile
              item={row.items[0]}
              width={SMALL_TILE_SIZE}
              height={SMALL_TILE_SIZE}
              onPress={handleItemPress}
              borderColor={colors.border}
            />
          </View>
        )}
        {row.items[1] && (
          <ExploreTile
            item={row.items[1]}
            width={LARGE_TILE_WIDTH}
            height={SMALL_TILE_SIZE * 1.5}
            onPress={handleItemPress}
            borderColor={colors.border}
          />
        )}
      </View>
    );
  };

  // Render search result tile (flat 3-column grid)
  const renderSearchGridItem = useCallback(({ item }: { item: ExploreItem }) => {
    return (
      <ExploreTile
        item={{ ...item, tileSize: 'small' }}
        width={SMALL_TILE_SIZE}
        height={SMALL_TILE_SIZE}
        onPress={handleItemPress}
        borderColor={colors.border}
      />
    );
  }, [colors, handleItemPress]);

  // Footer
  const renderFooter = useCallback(() => {
    if (loadingMore) {
      return (
        <View style={styles.loadingMoreContainer}>
          <ActivityIndicator size="small" color={BrandColors.loopBlue} />
          <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>
            Expanding search to {DISTANCE_TIERS[distanceTierIndex] || 100} miles...
          </Text>
        </View>
      );
    }
    return <View style={{ height: 100 }} />;
  }, [loadingMore, colors, distanceTierIndex]);

  // List header - minimal spacing only
  const ListHeader = useCallback(() => (
    <View style={{ height: Spacing.xs }} />
  ), []);

  // Decide what to show
  const isSearchActive = searchQuery.length >= 2;
  const showSuggestions = isSearchFocused && searchQuery.length < 2;

  return (
    <SwipeableLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ExploreHeader
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          placeholder="Search activities, places, events..."
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
          onSearchFocus={() => setIsSearchFocused(true)}
          onSearchBlur={() => setIsSearchFocused(false)}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BrandColors.loopBlue} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Finding activities...
            </Text>
          </View>
        ) : showSuggestions ? (
          // Search focused, empty query: show suggestions
          <SearchSuggestionsPanel
            recentSearches={recentSearches}
            trendingItems={trendingItems}
            onRecentSearchPress={(query) => {
              handleSearch(query);
            }}
            onClearRecent={() => setRecentSearches([])}
            onTrendingPress={handleItemPress}
            tileSize={SMALL_TILE_SIZE}
          />
        ) : isSearchActive ? (
          // Search mode: flat 3-column grid with rich tiles
          searchResults.length === 0 ? (
            <>
              <ListHeader />
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {isSearching ? 'Searching...' : 'No results found. Try a different search.'}
                </Text>
              </View>
            </>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderSearchGridItem}
              keyExtractor={(item) => item.id}
              numColumns={3}
              columnWrapperStyle={styles.searchColumnWrapper}
              ListHeaderComponent={ListHeader}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
            />
          )
        ) : exploreRows.length === 0 ? (
          <>
            <ListHeader />
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No activities found in this area.
              </Text>
            </View>
          </>
        ) : (
          // Explore mode: mixed content row-based grid
          <FlatList
            data={exploreRows}
            renderItem={renderRow}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={renderFooter}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            onScroll={handleScroll}
            scrollEventThrottle={400}
            onScrollBeginDrag={() => console.log('[Explore] User started scrolling')}
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
            onAddToCalendar={async () => {
              if (!user || !selectedRecommendation) return;
              try {
                const rec = convertToRecommendation(selectedRecommendation);
                const place = selectedRecommendation.place;
                const lat = place?.geometry?.location?.lat || 0;
                const lng = place?.geometry?.location?.lng || 0;
                const startTime = new Date();
                startTime.setHours(startTime.getHours() + 1, 0, 0, 0);
                const endTime = new Date(startTime);
                endTime.setHours(endTime.getHours() + 1);

                const { error } = await supabase.from('calendar_events').insert({
                  user_id: user.id,
                  title: rec.title,
                  category: rec.category || 'other',
                  location: `POINT(${lng} ${lat})`,
                  address: place?.formatted_address || place?.vicinity || '',
                  start_time: startTime.toISOString(),
                  end_time: endTime.toISOString(),
                  status: 'scheduled',
                  source: 'recommendation',
                  activity_id: null,
                } as any);

                if (error) throw error;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Added!', `${rec.title} added to your calendar.`);
              } catch (err) {
                console.error('Error adding to calendar:', err);
                Alert.alert('Error', 'Failed to add to calendar.');
              }
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
  gridContent: {
    paddingBottom: 100,
  },
  // Row layouts
  rowThreeSmall: {
    flexDirection: 'row',
    marginBottom: GRID_GAP,
    gap: GRID_GAP,
  },
  rowMixed: {
    flexDirection: 'row',
    marginBottom: GRID_GAP,
    gap: GRID_GAP,
  },
  smallTileStack: {
    justifyContent: 'flex-start',
  },
  // Search grid column wrapper
  searchColumnWrapper: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
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
});
