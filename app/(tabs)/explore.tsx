/**
 * Explore Tab - Search, browse, discover activities
 *
 * UX REDESIGN (v4.0) - Mixed Content Grid:
 * - Search bar with autocomplete at top
 * - Instagram-style grid mixing places and moments
 * - Visual variety: 3-small rows + large-left/right rows
 * - Infinite scroll with expanding distance tiers
 * - No hard item cap - distance tiers naturally throttle
 *
 * Differentiation from Feed:
 * - Feed = AI-personalized cards, limited daily recommendations, vertical scroll
 * - Explore = Browse all categories, unlimited, visual grid discovery
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  RefreshControl,
  Image,
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
import type { Recommendation, Activity, RecommendationScore } from '@/types/activity';
import type { ExploreItem, ExploreRow } from '@/types/explore';
import {
  DISTANCE_TIERS,
  fetchExploreBatch,
  fetchExploreMoments,
  interleaveContent,
  groupIntoRows,
} from '@/services/explore-service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
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
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [searchResults, setSearchResults] = useState<ScoredRecommendation[]>([]);
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

  // Initial load
  useEffect(() => {
    if (user) loadInitialContent();
  }, [user]);

  async function loadInitialContent() {
    if (!user) return;
    setLoading(true);

    try {
      // Get user location
      const location = await getCurrentLocation();
      const loc: PlaceLocation = { lat: location.latitude, lng: location.longitude };
      setUserLocation(loc);

      // Fetch moments and places in parallel
      const [momentItems, placeBatch] = await Promise.all([
        fetchExploreMoments({ userId: user.id }),
        fetchExploreBatch({
          user,
          userLocation: loc,
          distanceTier: 0,
          excludePlaceIds: [],
          batchSize: 30,
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

  // Load more (infinite scroll)
  const loadMoreContent = async () => {
    if (isLoadingMoreRef.current) return;
    if (!hasMoreRef.current) return;
    if (loading) return;
    if (searchQuery.length >= 2) return;
    if (!user || !userLocation) return;

    const now = Date.now();
    if (now - lastLoadMoreTime.current < 1000) return;

    isLoadingMoreRef.current = true;
    lastLoadMoreTime.current = now;
    setLoadingMore(true);

    try {
      const batch = await fetchExploreBatch({
        user,
        userLocation,
        distanceTier: distanceTierRef.current,
        excludePlaceIds: excludePlaceIdsRef.current,
        batchSize: 30,
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
        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching:', error);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, [user, userLocation]);

  // Helper to format category
  const formatCategory = useCallback((types: string[] | undefined) => {
    if (!types || types.length === 0) return 'Activity';
    const type = types.find((t) => !['point_of_interest', 'establishment'].includes(t)) || types[0];
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }, []);

  // Helper to get photo URL
  const getPhotoUrl = useCallback((place: ScoredRecommendation['place'], maxWidth: number = 400) => {
    if (!place?.photos?.[0]?.photo_reference) return null;
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`;
  }, []);

  // Convert ScoredRecommendation to Recommendation for modal
  const convertToRecommendation = useCallback((scored: ScoredRecommendation): Recommendation => {
    const place = scored.place;
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
    const photos = place?.photos?.map((p: any) =>
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${apiKey}`
    ) || [];

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

  // Handle item press
  const handleItemPress = useCallback((item: ExploreItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.type === 'place' && item.recommendation) {
      setSelectedRecommendation(item.recommendation);
      setShowDetailsModal(true);
    }
    // Moment tap: could open moment viewer in future
  }, []);

  // Handle search result press
  const handleSearchResultPress = useCallback((rec: ScoredRecommendation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRecommendation(rec);
    setShowDetailsModal(true);
  }, []);

  // End reached handler
  const handleEndReached = useCallback(() => {
    if (!isLoadingMoreRef.current && hasMoreRef.current && searchQuery.length < 2) {
      loadMoreContent();
    }
  }, [searchQuery.length]);

  // Render a single tile
  const renderTile = (item: ExploreItem, isLarge: boolean) => {
    const tileWidth = isLarge ? LARGE_TILE_WIDTH : SMALL_TILE_SIZE;
    const tileHeight = isLarge ? SMALL_TILE_SIZE * 1.5 : SMALL_TILE_SIZE;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.tile, { width: tileWidth, height: tileHeight }]}
        activeOpacity={0.9}
        onPress={() => handleItemPress(item)}
      >
        <View style={[styles.tileImage, { backgroundColor: colors.border }]}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.tileImageContent}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.tilePlaceholder}>
              <Ionicons
                name={item.type === 'moment' ? 'camera' : 'image-outline'}
                size={isLarge ? 32 : 24}
                color={colors.textSecondary}
              />
            </View>
          )}

          {/* Rating badge (top right) - places only */}
          {item.type === 'place' && item.rating && item.rating >= 4.0 && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={10} color="#FFD700" />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
            </View>
          )}

          {/* Moment indicator (top left) */}
          {item.type === 'moment' && (
            <View style={styles.momentBadge}>
              <Ionicons name="camera" size={12} color="#FFFFFF" />
            </View>
          )}

          {/* Category badge (large tiles only) */}
          {isLarge && item.subtitle && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.subtitle}</Text>
            </View>
          )}

          {/* Name overlay (large tiles only) */}
          {isLarge && (
            <View style={styles.nameOverlay}>
              <Text style={styles.nameText} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render a row group
  const renderRow = ({ item: row }: { item: ExploreRow }) => {
    if (row.layout === 'three-small') {
      return (
        <View style={styles.rowThreeSmall}>
          {row.items.map((item) => renderTile(item, false))}
        </View>
      );
    }

    if (row.layout === 'large-left') {
      return (
        <View style={styles.rowMixed}>
          {row.items[0] && renderTile(row.items[0], true)}
          {row.items[1] && (
            <View style={styles.smallTileStack}>
              {renderTile(row.items[1], false)}
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
            {renderTile(row.items[0], false)}
          </View>
        )}
        {row.items[1] && renderTile(row.items[1], true)}
      </View>
    );
  };

  // Render search result grid item (flat 3-column grid for search)
  const renderSearchGridItem = useCallback(({ item }: { item: ScoredRecommendation }) => {
    const photoUrl = getPhotoUrl(item.place, 300);
    const rating = item.place?.rating;

    return (
      <TouchableOpacity
        style={styles.searchGridItem}
        activeOpacity={0.9}
        onPress={() => handleSearchResultPress(item)}
      >
        <View style={[styles.tileImage, { backgroundColor: colors.border }]}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.tileImageContent} resizeMode="cover" />
          ) : (
            <View style={styles.tilePlaceholder}>
              <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
            </View>
          )}
          {rating && rating >= 4.0 && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={10} color="#FFD700" />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [colors, handleSearchResultPress, getPhotoUrl]);

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

  // List header
  const ListHeader = useCallback(() => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {searchQuery.length >= 2 ? `Results for "${searchQuery}"` : 'Trending Near You'}
      </Text>
      {allItems.length > 0 && !searchQuery && (
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          {allItems.filter((i) => i.type === 'place').length} places
          {moments.length > 0 ? ` + ${moments.length} moments` : ''}
        </Text>
      )}
    </View>
  ), [colors, searchQuery, allItems.length, moments.length]);

  // Decide what to show: search results or explore rows
  const isSearchActive = searchQuery.length >= 2;

  return (
    <SwipeableLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        ) : isSearchActive ? (
          // Search mode: flat 3-column grid
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
              keyExtractor={(item, index) => item.place?.place_id || `search-${index}`}
              numColumns={3}
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
    paddingBottom: Spacing.xl,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 4,
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

  // Tile
  tile: {
    overflow: 'hidden',
  },
  tileImage: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  tileImageContent: {
    width: '100%',
    height: '100%',
  },
  tilePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Badges
  ratingBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  momentBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    borderRadius: 4,
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 32,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  nameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Search grid (flat 3-column)
  searchGridItem: {
    width: SMALL_TILE_SIZE,
    height: SMALL_TILE_SIZE,
    marginRight: GRID_GAP,
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
