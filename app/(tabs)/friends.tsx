import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { BrandColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { ProfileSettingsModal } from '@/components/profile-settings-modal';
import { GroupPlanningModal } from '@/components/group-planning-modal';
import { FriendCardSkeleton } from '@/components/skeleton-loader';
import { SuccessAnimation } from '@/components/success-animation';
import { SwipeableLayout } from './swipeable-layout';

interface Friend {
  id: string;
  name: string;
  email: string;
  profile_picture_url: string | null;
  loop_score: number;
  status: 'accepted' | 'pending' | 'blocked';
  can_view_loop: boolean;
  created_at: string;
}

interface FriendRequest {
  id: string;
  user_id: string;
  friend_id: string;
  friend_name: string;
  friend_email: string;
  friend_picture: string | null;
  status: 'pending';
  created_at: string;
}

export default function FriendsScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showGroupPlanning, setShowGroupPlanning] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  useEffect(() => {
    loadFriends();
    loadFriendRequests();
  }, []);

  const loadFriends = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // DEMO MODE: Return mock friends for demo user
      if (user.id === 'demo-user-123') {
        const mockFriends: Friend[] = [
          {
            id: 'friend-1',
            name: 'Sarah Johnson',
            email: 'sarah@example.com',
            profile_picture_url: null,
            loop_score: 245,
            status: 'accepted',
            can_view_loop: true,
            created_at: new Date().toISOString(),
          },
          {
            id: 'friend-2',
            name: 'Mike Chen',
            email: 'mike@example.com',
            profile_picture_url: null,
            loop_score: 189,
            status: 'accepted',
            can_view_loop: true,
            created_at: new Date().toISOString(),
          },
          {
            id: 'friend-3',
            name: 'Emma Davis',
            email: 'emma@example.com',
            profile_picture_url: null,
            loop_score: 312,
            status: 'accepted',
            can_view_loop: true,
            created_at: new Date().toISOString(),
          },
        ];
        setFriends(mockFriends);
        setLoading(false);
        return;
      }

      // Get accepted friendships
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          friend_id,
          can_view_loop,
          created_at,
          users!friendships_friend_id_fkey (
            id,
            name,
            email,
            profile_picture_url,
            loop_score
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to Friend type
      const friendsList: Friend[] = (data || []).map((f: any) => ({
        id: f.id,
        name: f.users.name,
        email: f.users.email,
        profile_picture_url: f.users.profile_picture_url,
        loop_score: f.users.loop_score || 0,
        status: 'accepted' as const,
        can_view_loop: f.can_view_loop,
        created_at: f.created_at,
      }));

      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFriendRequests = async () => {
    if (!user) return;

    try {
      // DEMO MODE: No friend requests for demo user
      if (user.id === 'demo-user-123') {
        setFriendRequests([]);
        return;
      }

      // Get pending friend requests sent TO this user
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          user_id,
          friend_id,
          status,
          created_at,
          users!friendships_user_id_fkey (
            id,
            name,
            email,
            profile_picture_url
          )
        `)
        .eq('friend_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const requests: FriendRequest[] = (data || []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        friend_id: r.friend_id,
        friend_name: r.users.name,
        friend_email: r.users.email,
        friend_picture: r.users.profile_picture_url,
        status: 'pending' as const,
        created_at: r.created_at,
      }));

      setFriendRequests(requests);
    } catch (error) {
      console.error('Error loading friend requests:', error);
    }
  };

  const searchForUser = async () => {
    if (!user || !searchEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (searchEmail.toLowerCase() === user.email.toLowerCase()) {
      Alert.alert('Error', "You can't add yourself as a friend!");
      return;
    }

    setSearching(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Search for user by email
      const { data: foundUserData, error } = await supabase
        .from('users')
        .select('id, name, email, profile_picture_url')
        .eq('email', searchEmail.toLowerCase())
        .single();

      if (error || !foundUserData) {
        Alert.alert('Not Found', 'No user found with that email address');
        return;
      }

      const foundUser = foundUserData as any;

      // Check if already friends or request pending
      const { data: existingFriendship } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${foundUser.id}),and(user_id.eq.${foundUser.id},friend_id.eq.${user.id})`)
        .single();

      if (existingFriendship) {
        const friendship = existingFriendship as any;
        if (friendship.status === 'accepted') {
          Alert.alert('Already Friends', `You're already friends with ${foundUser.name}`);
        } else if (friendship.status === 'pending') {
          Alert.alert('Request Pending', `A friend request is already pending with ${foundUser.name}`);
        }
        return;
      }

      // Send friend request
      await sendFriendRequest(foundUser.id, foundUser.name);
    } catch (error) {
      console.error('Error searching for user:', error);
      Alert.alert('Error', 'Failed to search for user');
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (friendId: string, friendName: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('friendships').insert({
        user_id: user.id,
        friend_id: friendId,
        status: 'pending' as const,
        can_view_loop: true,
        can_invite_to_activities: true,
      } as any);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Show success animation
      setShowSuccessAnimation(true);
      setShowAddFriendModal(false);
      setSearchEmail('');

      // Show alert after animation
      setTimeout(() => {
        Alert.alert('Request Sent!', `Friend request sent to ${friendName}`);
      }, 1500);
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const acceptFriendRequest = async (requestId: string, friendName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Update the friendship status to accepted
      const { error } = await (supabase
        .from('friendships') as any)
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Show success animation
      setShowSuccessAnimation(true);

      // Reload friends and requests
      loadFriends();
      loadFriendRequests();

      // Show alert after animation
      setTimeout(() => {
        Alert.alert('Friend Added!', `You're now friends with ${friendName}`);
      }, 1500);
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const declineFriendRequest = async (requestId: string, friendName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Delete the friendship request
      const { error } = await supabase.from('friendships').delete().eq('id', requestId);

      if (error) throw error;

      Alert.alert('Request Declined', `Declined friend request from ${friendName}`);
      loadFriendRequests();
    } catch (error) {
      console.error('Error declining friend request:', error);
      Alert.alert('Error', 'Failed to decline friend request');
    }
  };

  const viewFriendLoop = (friend: Friend) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!friend.can_view_loop) {
      Alert.alert('Private', `${friend.name} hasn't shared their Loop with you yet`);
      return;
    }

    // For MVP, show simple info alert
    // Phase 2: Navigate to friend's Loop screen
    Alert.alert(
      `${friend.name}'s Loop`,
      `Loop Score: ${friend.loop_score}\n\nFull Loop view coming in Phase 2!\n\nWill show:\n• Today's activities\n• Upcoming events\n• Activity history\n• Shared interests`,
      [{ text: 'OK' }]
    );
  };

  const openAddFriendModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowAddFriendModal(true);
  };

  const closeAddFriendModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAddFriendModal(false);
    setSearchEmail('');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderFriendRequest = ({ item }: { item: FriendRequest }) => (
    <View
      style={[
        styles.requestCard,
        {
          backgroundColor: isDark ? '#1f2123' : '#ffffff',
          borderColor: BrandColors.loopBlue + '40',
        },
      ]}
    >
      <View style={styles.requestHeader}>
        {item.friend_picture ? (
          <Image source={{ uri: item.friend_picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: BrandColors.loopBlue }]}>
            <Text style={styles.avatarText}>{getInitials(item.friend_name)}</Text>
          </View>
        )}
        <View style={styles.requestInfo}>
          <Text style={[Typography.titleMedium, { color: Colors[colorScheme ?? 'light'].text }]}>
            {item.friend_name}
          </Text>
          <Text style={[Typography.bodySmall, { color: Colors[colorScheme ?? 'light'].icon }]}>
            {item.friend_email}
          </Text>
        </View>
      </View>

      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: BrandColors.loopGreen }]}
          onPress={() => acceptFriendRequest(item.id, item.friend_name)}
        >
          <Ionicons name="checkmark" size={20} color="#ffffff" />
          <Text style={[Typography.labelMedium, { color: '#ffffff', marginLeft: 4 }]}>Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.declineButton, { borderColor: Colors[colorScheme ?? 'light'].icon }]}
          onPress={() => declineFriendRequest(item.id, item.friend_name)}
        >
          <Ionicons name="close" size={20} color={Colors[colorScheme ?? 'light'].icon} />
          <Text style={[Typography.labelMedium, { color: Colors[colorScheme ?? 'light'].icon, marginLeft: 4 }]}>
            Decline
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFriend = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={[styles.friendCard, { backgroundColor: isDark ? '#1f2123' : '#ffffff' }]}
      onPress={() => viewFriendLoop(item)}
    >
      <View style={styles.friendHeader}>
        {item.profile_picture_url ? (
          <Image source={{ uri: item.profile_picture_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: BrandColors.loopBlue }]}>
            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
          </View>
        )}

        <View style={styles.friendInfo}>
          <Text style={[Typography.titleMedium, { color: Colors[colorScheme ?? 'light'].text }]}>
            {item.name}
          </Text>
          <Text style={[Typography.bodySmall, { color: Colors[colorScheme ?? 'light'].icon }]}>
            {item.email}
          </Text>
        </View>

        <View style={styles.loopScoreContainer}>
          <Ionicons name="flash" size={20} color={BrandColors.star} />
          <Text style={[Typography.titleMedium, { color: BrandColors.star, marginLeft: 4 }]}>
            {item.loop_score}
          </Text>
        </View>
      </View>

      {item.can_view_loop && (
        <View style={styles.viewLoopButton}>
          <Ionicons name="eye-outline" size={16} color={BrandColors.loopBlue} />
          <Text style={[Typography.bodySmall, { color: BrandColors.loopBlue, marginLeft: 4 }]}>
            View Loop
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SwipeableLayout>
      <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, Typography.headlineLarge, { color: Colors[colorScheme ?? 'light'].text }]}>
          Friends
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.headerButton} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowProfileSettings(true);
          }}>
            <Ionicons name="settings-outline" size={26} color={Colors[colorScheme ?? 'light'].icon} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={openAddFriendModal}>
            <Ionicons name="person-add" size={28} color={BrandColors.loopBlue} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Friend Requests Section */}
        {friendRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="mail-outline" size={20} color={BrandColors.loopBlue} />
              <Text style={[Typography.titleMedium, { color: Colors[colorScheme ?? 'light'].text, marginLeft: 8 }]}>
                Friend Requests
              </Text>
              <View style={[styles.badge, { backgroundColor: BrandColors.loopBlue }]}>
                <Text style={[Typography.bodySmall, { color: '#ffffff' }]}>{friendRequests.length}</Text>
              </View>
            </View>

            {friendRequests.map((request) => (
              <View key={request.id}>{renderFriendRequest({ item: request })}</View>
            ))}
          </View>
        )}

        {/* Friends List Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={20} color={Colors[colorScheme ?? 'light'].text} />
            <Text style={[Typography.titleMedium, { color: Colors[colorScheme ?? 'light'].text, marginLeft: 8 }]}>
              My Friends
            </Text>
            {friends.length > 0 && (
              <Text style={[Typography.bodySmall, { color: Colors[colorScheme ?? 'light'].icon, marginLeft: 8 }]}>
                ({friends.length})
              </Text>
            )}
          </View>

          {loading ? (
            // Show skeleton loaders while loading
            <>
              <FriendCardSkeleton />
              <FriendCardSkeleton />
              <FriendCardSkeleton />
              <FriendCardSkeleton />
            </>
          ) : friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={Colors[colorScheme ?? 'light'].icon} />
              <Text style={[Typography.bodyLarge, styles.emptyText, { color: Colors[colorScheme ?? 'light'].icon }]}>
                No friends yet
              </Text>
              <Text style={[Typography.bodyMedium, { color: Colors[colorScheme ?? 'light'].icon, textAlign: 'center' }]}>
                Tap the + button to add friends
              </Text>
            </View>
          ) : (
            friends.map((friend) => <View key={friend.id}>{renderFriend({ item: friend })}</View>)
          )}
        </View>

        {/* Loop Score Leaderboard (if friends exist) */}
        {friends.length > 0 && (
          <View style={[styles.leaderboardSection, { backgroundColor: isDark ? '#1f2123' : '#f8f9fa' }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trophy" size={20} color={BrandColors.star} />
              <Text style={[Typography.titleMedium, { color: Colors[colorScheme ?? 'light'].text, marginLeft: 8 }]}>
                Top Loop Scores
              </Text>
            </View>

            {[...friends]
              .sort((a, b) => b.loop_score - a.loop_score)
              .slice(0, 5)
              .map((friend, index) => (
                <View key={friend.id} style={styles.leaderboardItem}>
                  <Text style={[Typography.titleSmall, { color: Colors[colorScheme ?? 'light'].icon, width: 24 }]}>
                    #{index + 1}
                  </Text>
                  <Text style={[Typography.bodyMedium, { color: Colors[colorScheme ?? 'light'].text, flex: 1 }]}>
                    {friend.name}
                  </Text>
                  <View style={styles.scoreChip}>
                    <Ionicons name="flash" size={16} color={BrandColors.star} />
                    <Text style={[Typography.labelMedium, { color: BrandColors.star, marginLeft: 4 }]}>
                      {friend.loop_score}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      {/* Add Friend Modal */}
      <Modal visible={showAddFriendModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1f2123' : '#ffffff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[Typography.headlineMedium, { color: Colors[colorScheme ?? 'light'].text }]}>
                Add Friend
              </Text>
              <TouchableOpacity onPress={closeAddFriendModal}>
                <Ionicons name="close" size={28} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[Typography.labelLarge, styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Email Address
              </Text>
              <TextInput
                style={[
                  styles.input,
                  Typography.bodyLarge,
                  {
                    backgroundColor: isDark ? '#2f3133' : '#f5f5f5',
                    color: Colors[colorScheme ?? 'light'].text,
                  },
                ]}
                value={searchEmail}
                onChangeText={setSearchEmail}
                placeholder="friend@example.com"
                placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.searchButton, { backgroundColor: BrandColors.loopBlue }]}
                onPress={searchForUser}
                disabled={searching}
              >
                {searching ? (
                  <Text style={[Typography.labelLarge, { color: '#ffffff' }]}>Searching...</Text>
                ) : (
                  <>
                    <Ionicons name="search" size={20} color="#ffffff" />
                    <Text style={[Typography.labelLarge, { color: '#ffffff', marginLeft: 8 }]}>Find Friend</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.helpText}>
                <Ionicons name="information-circle-outline" size={16} color={Colors[colorScheme ?? 'light'].icon} />
                <Text style={[Typography.bodySmall, { color: Colors[colorScheme ?? 'light'].icon, marginLeft: 8 }]}>
                  Enter your friend's email address to send them a friend request
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Action Button for Group Planning */}
      {friends.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: BrandColors.loopGreen }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowGroupPlanning(true);
          }}
        >
          <Ionicons name="people" size={28} color="#ffffff" />
          <Text style={[Typography.labelMedium, { color: '#ffffff', marginLeft: 8 }]}>
            Plan Activity
          </Text>
        </TouchableOpacity>
      )}

      {/* Profile Settings Modal */}
      {user && (
        <ProfileSettingsModal
          visible={showProfileSettings}
          onClose={() => {
            setShowProfileSettings(false);
            loadFriends(); // Reload in case name changed
          }}
          userId={user.id}
          userName={user.name || user.email?.split('@')[0] || 'User'}
          userEmail={user.email || ''}
          userLoopScore={user.loop_score || 0}
        />
      )}

      {/* Group Planning Modal */}
      {user && (
        <GroupPlanningModal
          visible={showGroupPlanning}
          onClose={() => setShowGroupPlanning(false)}
          friends={friends}
          userId={user.id}
        />
      )}

      {/* Success Animation */}
      <SuccessAnimation
        visible={showSuccessAnimation}
        onComplete={() => setShowSuccessAnimation(false)}
        icon="checkmark-circle"
        color={BrandColors.loopGreen}
      />
      </View>
    </SwipeableLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + 40,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: Spacing.sm,
  },
  addButton: {
    padding: Spacing.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  requestCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    ...Shadows.md,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: Spacing.md,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    ...Typography.titleMedium,
    color: '#ffffff',
  },
  requestInfo: {
    flex: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  friendCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendInfo: {
    flex: 1,
  },
  loopScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.star + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  viewLoopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  emptyText: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  leaderboardSection: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.star + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  modalBody: {
    paddingHorizontal: Spacing.lg,
  },
  inputLabel: {
    marginBottom: Spacing.sm,
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  helpText: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: Spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 28,
    ...Shadows.lg,
    elevation: 6,
  },
});
