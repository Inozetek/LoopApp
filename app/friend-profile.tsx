/**
 * Friend Profile Screen
 *
 * Full friend profile with Loop stats and memories.
 * Features:
 * - Large avatar and profile info
 * - Stats row: Loop Score, friends count, algo match %
 * - Memories grid (Snapchat-style from loop_moments table)
 * - Recently liked places section
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { ThemeColors, Spacing, BorderRadius, BrandColors, Shadows } from '@/constants/brand';
import { supabase } from '@/lib/supabase';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_SPACING = 2;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - GRID_SPACING * 4) / 3;

interface FriendProfile {
  id: string;
  name: string;
  profilePictureUrl?: string;
  loopScore: number;
  friendsCount: number;
  activitiesCompleted: number;
  placesLiked: number;
  memberSince: string;
  algoMatch: number; // 0-100 percentage
  isFriend: boolean;
}

interface Moment {
  id: string;
  photoUrl: string;
  thumbnailUrl?: string;
  placeName: string;
  caption?: string;
  createdAt: string;
  likesCount: number;
}

interface LikedPlace {
  placeId: string;
  placeName: string;
  placeCategory?: string;
  likedAt: string;
}

// Demo user flag
const DEMO_USER_ID = 'demo-user-123';

export default function FriendProfileScreen() {
  const { userId, userName } = useLocalSearchParams<{ userId: string; userName: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const { user } = useAuth();

  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [likedPlaces, setLikedPlaces] = useState<LikedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load profile data
  useEffect(() => {
    if (userId) {
      loadProfileData();
    }
  }, [userId]);

  const loadProfileData = async () => {
    try {
      setLoading(true);

      // Check if demo mode
      if (user?.id === DEMO_USER_ID || !userId) {
        setProfile(getMockProfile(userId || 'mock', userName || 'Friend'));
        setMoments(getMockMoments());
        setLikedPlaces(getMockLikedPlaces());
        setLoading(false);
        return;
      }

      // Fetch profile data in parallel
      const [profileResult, momentsResult, likesResult, friendshipResult] = await Promise.all([
        fetchUserProfile(userId),
        fetchUserMoments(userId),
        fetchUserLikedPlaces(userId),
        checkFriendship(user!.id, userId),
      ]);

      // Calculate algo match if both users have interests
      const algoMatch = await calculateAlgoMatch(user!.id, userId);

      setProfile({
        ...profileResult,
        algoMatch,
        isFriend: friendshipResult,
      });
      setMoments(momentsResult);
      setLikedPlaces(likesResult);
    } catch (error) {
      console.error('Error loading profile:', error);
      // Fallback to mock data
      setProfile(getMockProfile(userId || 'mock', userName || 'Friend'));
      setMoments(getMockMoments());
      setLikedPlaces(getMockLikedPlaces());
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
  };

  const handleMomentPress = useCallback((moment: Moment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Open moment detail modal
  }, []);

  const handlePlacePress = useCallback((place: LikedPlace) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Navigate to place details or search for it
  }, []);

  const handleFollowPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: Implement follow/unfollow
  }, []);

  const formatMemberSince = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatLikedAt = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCategoryIcon = (category?: string): keyof typeof Ionicons.glyphMap => {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('restaurant') || cat.includes('food')) return 'restaurant';
    if (cat.includes('coffee') || cat.includes('cafe')) return 'cafe';
    if (cat.includes('bar') || cat.includes('drink')) return 'wine';
    if (cat.includes('music') || cat.includes('concert')) return 'musical-notes';
    if (cat.includes('gym') || cat.includes('fitness')) return 'fitness';
    if (cat.includes('park') || cat.includes('outdoor')) return 'leaf';
    if (cat.includes('shop')) return 'cart';
    return 'location';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: userName || 'Profile',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.loopBlue} />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: 'Profile',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>
            Profile not found
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: profile.name,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={BrandColors.loopBlue}
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: profile.profilePictureUrl || 'https://i.pravatar.cc/200' }}
            style={styles.avatar}
          />
          <Text style={[styles.name, { color: colors.text }]}>
            {profile.name}
          </Text>

          {/* Follow Button */}
          {!profile.isFriend && (
            <Pressable
              style={[styles.followButton, { backgroundColor: BrandColors.loopBlue }]}
              onPress={handleFollowPress}
            >
              <Ionicons name="person-add" size={16} color="#FFFFFF" />
              <Text style={styles.followButtonText}>Follow</Text>
            </Pressable>
          )}
        </View>

        {/* Stats Row */}
        <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {profile.loopScore}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Loop Score
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {profile.friendsCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Friends
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: BrandColors.loopBlue }]}>
              {profile.algoMatch}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Algo Match
            </Text>
          </View>
        </View>

        {/* Details Section */}
        <View style={[styles.detailsSection, { backgroundColor: colors.card }]}>
          <View style={styles.detailRow}>
            <Ionicons name="checkmark-circle" size={20} color={BrandColors.success} />
            <Text style={[styles.detailText, { color: colors.text }]}>
              {profile.activitiesCompleted} activities completed
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="heart" size={20} color={BrandColors.like} />
            <Text style={[styles.detailText, { color: colors.text }]}>
              {profile.placesLiked} places liked
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={20} color={BrandColors.loopBlue} />
            <Text style={[styles.detailText, { color: colors.text }]}>
              Member since {formatMemberSince(profile.memberSince)}
            </Text>
          </View>
        </View>

        {/* Memories Section */}
        {moments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="camera" size={20} color={colors.text} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Memories
              </Text>
            </View>
            <View style={styles.momentsGrid}>
              {moments.slice(0, 9).map((moment, index) => (
                <Pressable
                  key={moment.id}
                  style={styles.momentItem}
                  onPress={() => handleMomentPress(moment)}
                >
                  <Image
                    source={{ uri: moment.thumbnailUrl || moment.photoUrl }}
                    style={styles.momentImage}
                  />
                  {index === 8 && moments.length > 9 && (
                    <View style={styles.moreOverlay}>
                      <Text style={styles.moreText}>+{moments.length - 9}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Recently Liked Section */}
        {likedPlaces.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart" size={20} color={BrandColors.like} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Recently Liked
              </Text>
            </View>
            {likedPlaces.slice(0, 5).map((place) => (
              <Pressable
                key={place.placeId}
                style={[styles.placeRow, { backgroundColor: colors.card }]}
                onPress={() => handlePlacePress(place)}
              >
                <View style={[styles.placeIcon, { backgroundColor: colors.background }]}>
                  <Ionicons
                    name={getCategoryIcon(place.placeCategory)}
                    size={20}
                    color={colors.text}
                  />
                </View>
                <View style={styles.placeInfo}>
                  <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={1}>
                    {place.placeName}
                  </Text>
                  <Text style={[styles.placeCategory, { color: colors.textSecondary }]}>
                    {place.placeCategory || 'Place'} • Liked {formatLikedAt(place.likedAt)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

async function fetchUserProfile(userId: string): Promise<Omit<FriendProfile, 'algoMatch' | 'isFriend'>> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, profile_picture_url, loop_score, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error('User not found');
  }

  // Get friends count
  const { count: friendsCount } = await supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'accepted');

  // Get activities completed
  const { count: activitiesCount } = await supabase
    .from('calendar_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');

  // Get places liked
  const { count: likesCount } = await supabase
    .from('activity_likes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return {
    id: data.id,
    name: data.name,
    profilePictureUrl: data.profile_picture_url,
    loopScore: data.loop_score || 0,
    friendsCount: friendsCount || 0,
    activitiesCompleted: activitiesCount || 0,
    placesLiked: likesCount || 0,
    memberSince: data.created_at,
  };
}

async function fetchUserMoments(userId: string): Promise<Moment[]> {
  const { data, error } = await supabase
    .from('moments')
    .select('id, photo_url, thumbnail_url, place_name, caption, created_at, likes_count')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('visibility', ['friends', 'everyone'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return data.map((m: any) => ({
    id: m.id,
    photoUrl: m.photo_url,
    thumbnailUrl: m.thumbnail_url,
    placeName: m.place_name,
    caption: m.caption,
    createdAt: m.created_at,
    likesCount: m.likes_count,
  }));
}

async function fetchUserLikedPlaces(userId: string): Promise<LikedPlace[]> {
  const { data, error } = await supabase
    .from('activity_likes')
    .select('place_id, place_name, place_category, liked_at')
    .eq('user_id', userId)
    .eq('is_sensitive_category', false)
    .in('visibility', ['friends', 'public'])
    .order('liked_at', { ascending: false })
    .limit(10);

  if (error || !data) return [];

  return data.map((l: any) => ({
    placeId: l.place_id,
    placeName: l.place_name,
    placeCategory: l.place_category,
    likedAt: l.liked_at,
  }));
}

async function checkFriendship(currentUserId: string, friendUserId: string): Promise<boolean> {
  const { data } = await supabase
    .from('friendships')
    .select('id')
    .eq('user_id', currentUserId)
    .eq('friend_id', friendUserId)
    .eq('status', 'accepted')
    .single();

  return !!data;
}

async function calculateAlgoMatch(currentUserId: string, friendUserId: string): Promise<number> {
  try {
    // Get both users' AI profiles
    const { data: users } = await supabase
      .from('users')
      .select('id, ai_profile, interests')
      .in('id', [currentUserId, friendUserId]);

    if (!users || users.length !== 2) return 0;

    const currentUser = users.find((u: any) => u.id === currentUserId);
    const friendUser = users.find((u: any) => u.id === friendUserId);

    if (!currentUser || !friendUser) return 0;

    // Calculate overlap in interests/favorite_categories
    const currentInterests = new Set([
      ...(currentUser.interests || []),
      ...(currentUser.ai_profile?.favorite_categories || []),
    ]);
    const friendInterests = new Set([
      ...(friendUser.interests || []),
      ...(friendUser.ai_profile?.favorite_categories || []),
    ]);

    if (currentInterests.size === 0 || friendInterests.size === 0) {
      return Math.floor(Math.random() * 30) + 50; // Random 50-80% if no data
    }

    let overlap = 0;
    currentInterests.forEach(interest => {
      if (friendInterests.has(interest)) overlap++;
    });

    const totalUnique = new Set([...currentInterests, ...friendInterests]).size;
    const matchPercent = Math.round((overlap / totalUnique) * 100);

    return Math.min(99, Math.max(20, matchPercent)); // Clamp to 20-99%
  } catch {
    return Math.floor(Math.random() * 30) + 50; // Fallback to random
  }
}

// ============================================================================
// MOCK DATA
// ============================================================================

function getMockProfile(userId: string, name: string): FriendProfile {
  const hash = userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return {
    id: userId,
    name,
    profilePictureUrl: `https://i.pravatar.cc/200?u=${userId}`,
    loopScore: (hash % 500) + 300,
    friendsCount: (hash % 200) + 50,
    activitiesCompleted: (hash % 100) + 20,
    placesLiked: (hash % 80) + 10,
    memberSince: new Date(Date.now() - (hash % 365) * 24 * 60 * 60 * 1000).toISOString(),
    algoMatch: (hash % 40) + 55,
    isFriend: hash % 2 === 0,
  };
}

function getMockMoments(): Moment[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: `moment-${i}`,
    photoUrl: `https://picsum.photos/400/400?random=${i}`,
    thumbnailUrl: `https://picsum.photos/200/200?random=${i}`,
    placeName: ['Coffee Shop', 'Italian Restaurant', 'Park', 'Concert Venue', 'Gym'][i % 5],
    caption: i % 3 === 0 ? 'Had an amazing time!' : undefined,
    createdAt: new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000).toISOString(),
    likesCount: Math.floor(Math.random() * 50) + 5,
  }));
}

function getMockLikedPlaces(): LikedPlace[] {
  return [
    { placeId: 'place-1', placeName: 'The Daily Grind Coffee', placeCategory: 'coffee', likedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    { placeId: 'place-2', placeName: 'Bella Italia', placeCategory: 'restaurant', likedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
    { placeId: 'place-3', placeName: 'Central Park', placeCategory: 'outdoor', likedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { placeId: 'place-4', placeName: 'The Jazz Club', placeCategory: 'live_music', likedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
    { placeId: 'place-5', placeName: 'Fitness First', placeCategory: 'fitness', likedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
  ];
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  errorText: {
    fontSize: 16,
  },

  // Profile Header
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E5E5',
    marginBottom: Spacing.md,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
  },

  // Details Section
  detailsSection: {
    margin: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  detailText: {
    fontSize: 15,
  },

  // Section
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },

  // Moments Grid
  momentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_SPACING,
  },
  momentItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  momentImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E5E5',
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },

  // Place Row
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '600',
  },
  placeCategory: {
    fontSize: 13,
    marginTop: 2,
  },

  bottomPadding: {
    height: Spacing.xl * 2,
  },
});
