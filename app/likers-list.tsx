/**
 * Likers List Screen
 *
 * Instagram-style list of users who liked a place.
 * Features:
 * - Friends section at top (sorted by like date)
 * - Others section below
 * - Search functionality
 * - Tap row to navigate to friend profile
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { ThemeColors, Spacing, BorderRadius, BrandColors, Typography } from '@/constants/brand';
import { getLikersList, type LikerProfile } from '@/services/likes-service';
import { sendFriendRequest } from '@/services/friends-service';

export default function LikersListScreen() {
  const { placeId, placeName } = useLocalSearchParams<{ placeId: string; placeName: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const { user } = useAuth();

  const [likers, setLikers] = useState<LikerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  // Load initial data
  useEffect(() => {
    if (placeId && user?.id) {
      loadLikers();
    }
  }, [placeId, user?.id]);

  const loadLikers = async (reset = true) => {
    if (!placeId || !user?.id) return;

    try {
      if (reset) {
        setLoading(true);
      }

      const result = await getLikersList(user.id, placeId, 0, 50);
      setLikers(result.likers);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error loading likers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLikers(true);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore || !placeId || !user?.id) return;

    try {
      setLoadingMore(true);
      const result = await getLikersList(user.id, placeId, likers.length, 50);
      setLikers(prev => [...prev, ...result.likers]);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error loading more likers:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Filter likers by search query
  const filteredLikers = useMemo(() => {
    if (!searchQuery.trim()) return likers;
    const query = searchQuery.toLowerCase();
    return likers.filter(liker =>
      liker.name.toLowerCase().includes(query)
    );
  }, [likers, searchQuery]);

  // Split into friends and others
  const { friends, others } = useMemo(() => {
    const friendsList = filteredLikers.filter(l => l.isFriend || l.isCurrentUser);
    const othersList = filteredLikers.filter(l => !l.isFriend && !l.isCurrentUser);
    return { friends: friendsList, others: othersList };
  }, [filteredLikers]);

  const handleUserPress = useCallback((liker: LikerProfile) => {
    if (liker.isCurrentUser) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/friend-profile',
      params: { userId: liker.userId, userName: liker.name },
    });
  }, [router]);

  const formatLikedAt = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderLiker = useCallback(({ item }: { item: LikerProfile }) => (
    <Pressable
      style={[styles.likerRow, { backgroundColor: colors.card }]}
      onPress={() => handleUserPress(item)}
      disabled={item.isCurrentUser}
    >
      <Image
        source={{ uri: item.profilePictureUrl || 'https://i.pravatar.cc/100' }}
        style={styles.avatar}
      />
      <View style={styles.likerInfo}>
        <Text style={[styles.likerName, { color: colors.text }]}>
          {item.name}
          {item.isCurrentUser && (
            <Text style={{ color: colors.textSecondary }}> (you)</Text>
          )}
        </Text>
        <Text style={[styles.likerTime, { color: colors.textSecondary }]}>
          Liked {formatLikedAt(item.likedAt)}
        </Text>
      </View>
      {!item.isCurrentUser && (
        <View style={styles.actionArea}>
          {item.isFriend ? (
            <View style={[styles.friendBadge, { backgroundColor: colors.background }]}>
              <Text style={[styles.friendBadgeText, { color: colors.textSecondary }]}>
                Friends
              </Text>
            </View>
          ) : (
            <Pressable
              style={[styles.followButton, {
                backgroundColor: followingIds.has(item.userId) ? colors.background : BrandColors.loopBlue,
                borderWidth: followingIds.has(item.userId) ? 1 : 0,
                borderColor: colors.border,
              }]}
              onPress={async () => {
                if (!user?.id || followingIds.has(item.userId)) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                try {
                  await sendFriendRequest(user.id, item.userId);
                  setFollowingIds(prev => new Set(prev).add(item.userId));
                } catch (error) {
                  console.error('Error following user:', error);
                }
              }}
              disabled={followingIds.has(item.userId)}
            >
              <Text style={[styles.followButtonText, {
                color: followingIds.has(item.userId) ? colors.textSecondary : '#FFFFFF',
              }]}>
                {followingIds.has(item.userId) ? 'Requested' : 'Follow'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  ), [colors, handleUserPress]);

  const renderSectionHeader = useCallback((title: string, count: number) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {title.toUpperCase()} ({count})
      </Text>
    </View>
  ), [colors]);

  const renderListContent = () => {
    const sections: React.ReactNode[] = [];

    if (friends.length > 0) {
      sections.push(
        <View key="friends-section">
          {renderSectionHeader('Friends', friends.length)}
          {friends.map(friend => (
            <View key={friend.userId}>
              {renderLiker({ item: friend })}
            </View>
          ))}
        </View>
      );
    }

    if (others.length > 0) {
      sections.push(
        <View key="others-section">
          {renderSectionHeader('Others', others.length)}
          {others.map(other => (
            <View key={other.userId}>
              {renderLiker({ item: other })}
            </View>
          ))}
        </View>
      );
    }

    return sections;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: 'Likes',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.loopBlue} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Likes',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerBackTitle: 'Back',
        }}
      />

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search"
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Place Name Header */}
      <View style={styles.placeHeader}>
        <Text style={[styles.placeNameLabel, { color: colors.textSecondary }]}>
          People who liked
        </Text>
        <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={2}>
          {placeName || 'this place'}
        </Text>
      </View>

      {/* Likers List */}
      {filteredLikers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {searchQuery ? 'No results found' : 'No likes yet'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {searchQuery
              ? `No one matching "${searchQuery}"`
              : 'Be the first to like this place!'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={[1]} // Single item to trigger render
          renderItem={() => <>{renderListContent()}</>}
          keyExtractor={() => 'content'}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={BrandColors.loopBlue}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color={BrandColors.loopBlue} />
              </View>
            ) : null
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 16,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },

  // Place Header
  placeHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  placeNameLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  placeName: {
    fontSize: 18,
    fontWeight: '600',
  },

  // List
  listContent: {
    paddingBottom: Spacing.xl * 2,
  },

  // Section Header
  sectionHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Liker Row
  likerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E5E5',
  },
  likerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  likerName: {
    fontSize: 15,
    fontWeight: '600',
  },
  likerTime: {
    fontSize: 13,
    marginTop: 2,
  },
  actionArea: {
    marginLeft: Spacing.md,
  },
  friendBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  friendBadgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  followButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },

  // Loading More
  loadingMoreContainer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});
