/**
 * Group Planning Modal
 *
 * Allows users to:
 * - Select friends for group activity
 * - Add custom tags/constraints
 * - See AI-suggested activities based on group preferences
 * - Send invitations to selected friends
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { BrandColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import { handleError } from '@/utils/error-handler';

interface Friend {
  id: string;
  name: string;
  email: string;
  profile_picture_url: string | null;
  loop_score: number;
}

interface GroupPlanningModalProps {
  visible: boolean;
  onClose: () => void;
  friends: Friend[];
  userId: string;
}

const AVAILABLE_TAGS = [
  'Budget-Friendly',
  'Indoor',
  'Outdoor',
  'Evening',
  'Weekend',
  'Family-Friendly',
  'Dog-Friendly',
  'Live Music',
  'Food & Drink',
  'Active',
  'Relaxing',
  'Cultural',
];

export function GroupPlanningModal({
  visible,
  onClose,
  friends,
  userId,
}: GroupPlanningModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!visible) {
      // Reset state when modal closes
      setSelectedFriends([]);
      setSelectedTags([]);
      setCustomTag('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [visible]);

  const toggleFriend = (friendId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const toggleTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    if (!customTag.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags((prev) => [...prev, customTag.trim()]);
    setCustomTag('');
  };

  const removeCustomTag = (tag: string) => {
    if (!AVAILABLE_TAGS.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    }
  };

  const handleFindActivities = async () => {
    if (selectedFriends.length === 0) {
      Alert.alert('No Friends Selected', 'Please select at least one friend for the group activity');
      return;
    }

    if (selectedFriends.length > 5) {
      Alert.alert('Too Many Friends', 'Group planning supports up to 5 friends for MVP. Select fewer friends.');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // For MVP, show placeholder suggestions
      // Phase 2: Call actual group planning service
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockSuggestions = [
        {
          id: '1',
          name: 'Klyde Warren Park',
          category: 'Outdoor',
          description: 'Great outdoor space perfect for groups',
          distance: 2.3,
          rating: 4.7,
          priceRange: 1,
          photoUrl: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=800',
        },
        {
          id: '2',
          name: 'Reunion Tower',
          category: 'Sightseeing',
          description: 'Iconic Dallas landmark with amazing views',
          distance: 1.8,
          rating: 4.5,
          priceRange: 2,
          photoUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800',
        },
        {
          id: '3',
          name: 'Deep Ellum',
          category: 'Entertainment',
          description: 'Vibrant arts district with food and music',
          distance: 3.1,
          rating: 4.6,
          priceRange: 2,
          photoUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
        },
      ];

      setSuggestions(mockSuggestions);
      setShowSuggestions(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error finding group activities:', error);
      handleError(error, 'finding group activities', handleFindActivities);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectActivity = async (activity: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Create group plan
      const { data: planData, error: planError } = await supabase
        .from('group_plans')
        .insert({
          creator_id: userId,
          activity_id: null, // Will link to activities table in Phase 2
          title: activity.name,
          description: activity.description,
          suggested_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          duration_minutes: 120,
          meeting_location: `POINT(${-96.797} ${32.7767})`, // Dallas coordinates
          meeting_address: activity.name,
          constraint_tags: selectedTags,
          status: 'proposed',
        } as any)
        .select()
        .single();

      if (planError) throw planError;

      const groupPlan = planData as any;

      // Add participants
      const participants = selectedFriends.map((friendId) => ({
        plan_id: groupPlan.id,
        user_id: friendId,
        rsvp_status: 'invited',
        invited_at: new Date().toISOString(),
      }));

      const { error: participantsError } = await supabase
        .from('plan_participants')
        .insert(participants as any);

      if (participantsError) throw participantsError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Group Plan Created! 🎉',
        `Invitations sent to ${selectedFriends.length} friend(s) for "${activity.name}"\n\nFull group planning features coming in Phase 2!`,
        [
          {
            text: 'Great!',
            onPress: () => {
              onClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating group plan:', error);
      handleError(error, 'creating group plan');
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPriceDisplay = (priceRange: number) => {
    return '$'.repeat(Math.max(1, priceRange));
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Plan Group Activity</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {!showSuggestions ? (
              <>
                {/* Select Friends */}
                <View style={[styles.card, { backgroundColor: isDark ? '#1f2123' : '#ffffff' }]}>
                  <Text style={[Typography.titleLarge, { color: colors.text, marginBottom: 8 }]}>
                    Select Friends
                  </Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon, marginBottom: 12 }]}>
                    Choose 1-5 friends to invite
                  </Text>

                  <View style={styles.friendsList}>
                    {friends.map((friend) => (
                      <TouchableOpacity
                        key={friend.id}
                        onPress={() => toggleFriend(friend.id)}
                        style={[
                          styles.friendChip,
                          selectedFriends.includes(friend.id) && styles.friendChipSelected,
                          {
                            backgroundColor: selectedFriends.includes(friend.id)
                              ? BrandColors.loopBlue
                              : isDark
                              ? '#2f3133'
                              : '#f5f5f5',
                            borderColor: selectedFriends.includes(friend.id)
                              ? BrandColors.loopBlue
                              : colors.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.friendAvatar,
                            { backgroundColor: selectedFriends.includes(friend.id) ? '#ffffff' : BrandColors.loopBlue },
                          ]}
                        >
                          <Text
                            style={[
                              styles.friendAvatarText,
                              {
                                color: selectedFriends.includes(friend.id)
                                  ? BrandColors.loopBlue
                                  : '#ffffff',
                              },
                            ]}
                          >
                            {getInitials(friend.name)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            Typography.bodyMedium,
                            {
                              color: selectedFriends.includes(friend.id) ? '#ffffff' : colors.text,
                            },
                          ]}
                        >
                          {friend.name.split(' ')[0]}
                        </Text>
                        {selectedFriends.includes(friend.id) && (
                          <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>

                  {selectedFriends.length > 0 && (
                    <Text style={[Typography.labelMedium, { color: BrandColors.loopBlue, marginTop: 8 }]}>
                      {selectedFriends.length} friend(s) selected
                    </Text>
                  )}
                </View>

                {/* Tags/Constraints */}
                <View style={[styles.card, { backgroundColor: isDark ? '#1f2123' : '#ffffff' }]}>
                  <Text style={[Typography.titleLarge, { color: colors.text, marginBottom: 8 }]}>
                    Activity Preferences
                  </Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon, marginBottom: 12 }]}>
                    Select tags to filter suggestions (optional)
                  </Text>

                  <View style={styles.tagsGrid}>
                    {AVAILABLE_TAGS.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => toggleTag(tag)}
                        style={[
                          styles.tagChip,
                          selectedTags.includes(tag) && styles.tagChipSelected,
                          {
                            backgroundColor: selectedTags.includes(tag)
                              ? BrandColors.loopGreen
                              : isDark
                              ? '#2f3133'
                              : '#f5f5f5',
                            borderColor: selectedTags.includes(tag)
                              ? BrandColors.loopGreen
                              : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            Typography.bodySmall,
                            {
                              color: selectedTags.includes(tag) ? '#ffffff' : colors.text,
                            },
                          ]}
                        >
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Custom tags */}
                  {selectedTags.filter((t) => !AVAILABLE_TAGS.includes(t)).length > 0 && (
                    <View style={styles.customTagsContainer}>
                      {selectedTags
                        .filter((t) => !AVAILABLE_TAGS.includes(t))
                        .map((tag) => (
                          <View
                            key={tag}
                            style={[
                              styles.customTag,
                              { backgroundColor: BrandColors.loopBlue + '20' },
                            ]}
                          >
                            <Text style={[Typography.bodySmall, { color: BrandColors.loopBlue }]}>
                              {tag}
                            </Text>
                            <TouchableOpacity onPress={() => removeCustomTag(tag)}>
                              <Ionicons name="close-circle" size={18} color={BrandColors.loopBlue} />
                            </TouchableOpacity>
                          </View>
                        ))}
                    </View>
                  )}

                  {/* Add custom tag */}
                  <View style={styles.customTagInput}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: isDark ? '#2f3133' : '#f5f5f5',
                          borderColor: colors.border,
                          color: colors.text,
                          flex: 1,
                        },
                      ]}
                      value={customTag}
                      onChangeText={setCustomTag}
                      placeholder="Add custom tag..."
                      placeholderTextColor={colors.icon}
                      maxLength={30}
                      onSubmitEditing={addCustomTag}
                    />
                    <TouchableOpacity
                      onPress={addCustomTag}
                      style={[styles.addTagButton, { backgroundColor: BrandColors.loopBlue }]}
                      disabled={!customTag.trim()}
                    >
                      <Ionicons name="add" size={24} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              /* Suggestions */
              <View style={[styles.card, { backgroundColor: isDark ? '#1f2123' : '#ffffff' }]}>
                <Text style={[Typography.titleLarge, { color: colors.text, marginBottom: 8 }]}>
                  Suggested Activities
                </Text>
                <Text style={[Typography.bodySmall, { color: colors.icon, marginBottom: 16 }]}>
                  Based on your group's preferences and location
                </Text>

                {suggestions.map((activity) => (
                  <TouchableOpacity
                    key={activity.id}
                    onPress={() => handleSelectActivity(activity)}
                    style={[styles.suggestionCard, { backgroundColor: isDark ? '#2f3133' : '#f8f9fa' }]}
                  >
                    <View style={styles.suggestionInfo}>
                      <Text style={[Typography.titleMedium, { color: colors.text }]}>
                        {activity.name}
                      </Text>
                      <Text style={[Typography.bodySmall, { color: colors.icon, marginTop: 4 }]}>
                        {activity.description}
                      </Text>
                      <View style={styles.suggestionMeta}>
                        <View style={styles.metaItem}>
                          <Ionicons name="star" size={14} color={BrandColors.star} />
                          <Text style={[Typography.bodySmall, { color: colors.text, marginLeft: 4 }]}>
                            {activity.rating}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Text style={[Typography.bodySmall, { color: colors.text }]}>
                            {getPriceDisplay(activity.priceRange)}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="location" size={14} color={colors.icon} />
                          <Text style={[Typography.bodySmall, { color: colors.icon, marginLeft: 4 }]}>
                            {activity.distance} mi
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color={colors.icon} />
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  onPress={() => setShowSuggestions(false)}
                  style={styles.backButton}
                >
                  <Ionicons name="arrow-back" size={20} color={BrandColors.loopBlue} />
                  <Text style={[Typography.labelMedium, { color: BrandColors.loopBlue, marginLeft: 8 }]}>
                    Change Selection
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Find Activities Button */}
          {!showSuggestions && (
            <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={handleFindActivities}
                disabled={loading || selectedFriends.length === 0}
                style={[
                  styles.findButton,
                  {
                    backgroundColor: BrandColors.loopBlue,
                    opacity: loading || selectedFriends.length === 0 ? 0.5 : 1,
                  },
                ]}
              >
                <Ionicons name="search" size={20} color="#ffffff" />
                <Text style={styles.findButtonText}>
                  {loading ? 'Finding Activities...' : 'Find Group Activities'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  friendsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  friendChipSelected: {
    transform: [{ scale: 1.02 }],
  },
  friendAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  tagChipSelected: {
    transform: [{ scale: 1.02 }],
  },
  customTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.md,
  },
  customTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
  },
  customTagInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  addTagButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
  },
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    ...Shadows.md,
  },
  findButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
});
