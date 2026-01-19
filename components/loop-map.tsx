/**
 * Loop Map Component (Snapchat-style)
 *
 * Shows friends on a map with:
 * - Avatar markers at their current locations
 * - Badge showing # of tasks scheduled for today
 * - Tap to view their daily Loop
 * - Privacy controls (friends can hide location)
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { supabase } from '@/lib/supabase';
import { getDayRoutingSummary } from '@/services/loop-routing';

interface Friend {
  id: string;
  name: string;
  profile_picture_url?: string;
  current_location?: {
    latitude: number;
    longitude: number;
  };
  privacy_settings: {
    share_location: boolean;
  };
  tasksToday: number; // Number of tasks scheduled for today
}

interface LoopMapProps {
  userId: string;
  onFriendPress?: (friendId: string) => void;
}

export default function LoopMap({ userId, onFriendPress }: LoopMapProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    loadFriendsData();
    const interval = setInterval(loadFriendsData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [userId]);

  const loadFriendsData = async () => {
    try {
      // Get user's location
      const { data: currentUser } = await supabase
        .from('users')
        .select('current_location, home_location')
        .eq('id', userId)
        .single();

      if (currentUser?.current_location) {
        setUserLocation(currentUser.current_location);
      } else if (currentUser?.home_location) {
        setUserLocation(currentUser.home_location);
      }

      // Get accepted friendships
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (friendshipsError || !friendships) {
        console.error('Error fetching friendships:', friendshipsError);
        setLoading(false);
        return;
      }

      const friendIds = friendships.map((f: { friend_id: string }) => f.friend_id);

      if (friendIds.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      // Get friend details
      const { data: friendsData, error: friendsError } = await supabase
        .from('users')
        .select(
          'id, name, profile_picture_url, current_location, privacy_settings'
        )
        .in('id', friendIds);

      if (friendsError || !friendsData) {
        console.error('Error fetching friends:', friendsError);
        setLoading(false);
        return;
      }

      // Get task counts for each friend
      const friendsWithTasks: Friend[] = await Promise.all(
        friendsData.map(async (friend: { id: string; name: string | null; profile_picture_url: string | null; current_location: unknown; privacy_settings: { share_location?: boolean } | null }) => {
          // Only show friends who share their location
          if (!friend.privacy_settings?.share_location) {
            return null;
          }

          // Get today's task count
          const summary = await getDayRoutingSummary(friend.id, new Date());

          return {
            id: friend.id,
            name: friend.name,
            profile_picture_url: friend.profile_picture_url,
            current_location: friend.current_location,
            privacy_settings: friend.privacy_settings,
            tasksToday: summary.totalEvents,
          };
        })
      );

      // Filter out null values (friends who don't share location)
      setFriends(friendsWithTasks.filter((f) => f !== null) as Friend[]);
      setLoading(false);
    } catch (error) {
      console.error('Error loading friends data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading Loop Map...</Text>
      </View>
    );
  }

  if (!userLocation) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Location not available. Please enable location services.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* Friend markers */}
        {friends.map((friend) => {
          if (!friend.current_location) return null;

          return (
            <Marker
              key={friend.id}
              coordinate={{
                latitude: friend.current_location.latitude,
                longitude: friend.current_location.longitude,
              }}
              onPress={() => onFriendPress?.(friend.id)}
            >
              <View style={styles.markerContainer}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  {friend.profile_picture_url ? (
                    <Image
                      source={{ uri: friend.profile_picture_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarText}>
                        {friend.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  {/* Task count badge */}
                  {friend.tasksToday > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{friend.tasksToday}</Text>
                    </View>
                  )}
                </View>

                {/* Name label */}
                <View style={styles.nameLabel}>
                  <Text style={styles.nameText}>{friend.name}</Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendBadge}>
            <Text style={styles.legendBadgeText}>3</Text>
          </View>
          <Text style={styles.legendText}>= Tasks scheduled today</Text>
        </View>
      </View>

      {/* Refresh button */}
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={loadFriendsData}
      >
        <Text style={styles.refreshIcon}>🔄</Text>
      </TouchableOpacity>

      {/* Friends count */}
      <View style={styles.friendsCount}>
        <Text style={styles.friendsCountText}>
          {friends.length} {friends.length === 1 ? 'friend' : 'friends'} visible
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  markerContainer: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#007AFF',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  nameLabel: {
    marginTop: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  nameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  legend: {
    position: 'absolute',
    top: 60,
    left: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  legendBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  legendText: {
    fontSize: 13,
    color: '#000',
  },
  refreshButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  refreshIcon: {
    fontSize: 20,
  },
  friendsCount: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  friendsCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
