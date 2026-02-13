/**
 * Friend Group Management Modal
 * Create / edit friend groups with member selection and privacy controls
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BrandColors, Typography, Spacing, BorderRadius } from '@/constants/brand';
import {
  FriendGroup,
  FriendGroupPrivacy,
  createFriendGroup,
  updateFriendGroup,
  deleteFriendGroup,
  addMemberToGroup,
  removeMemberFromGroup,
  updateGroupPrivacy,
} from '@/services/friend-groups-service';

interface Friend {
  id: string;
  name: string;
  email: string;
  profile_picture_url: string | null;
}

interface FriendGroupManagementModalProps {
  visible: boolean;
  onClose: () => void;
  group: FriendGroup | null; // null = creating new
  friends: Friend[];
  userId: string;
  onSaved: () => void;
}

const EMOJI_OPTIONS = ['🏃', '🍕', '🎮', '🎵', '🏋️', '🌲', '🎉', '☕', '🎬', '💼', '✈️', '🐕'];

export function FriendGroupManagementModal({
  visible,
  onClose,
  group,
  friends,
  userId,
  onSaved,
}: FriendGroupManagementModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [privacy, setPrivacy] = useState<Omit<FriendGroupPrivacy, 'id' | 'group_id'>>({
    can_see_my_loop: true,
    i_can_see_their_loop: true,
    include_in_group_recs: true,
    include_in_one_on_one_recs: true,
    auto_share_calendar: false,
  });
  const [saving, setSaving] = useState(false);

  const isEditing = !!group;

  // Populate state when editing
  useEffect(() => {
    if (group) {
      setName(group.name);
      setEmoji(group.emoji);
      setSelectedMembers(new Set(group.members.map((m) => m.friend_user_id)));
      setPrivacy({
        can_see_my_loop: group.privacy.can_see_my_loop,
        i_can_see_their_loop: group.privacy.i_can_see_their_loop,
        include_in_group_recs: group.privacy.include_in_group_recs,
        include_in_one_on_one_recs: group.privacy.include_in_one_on_one_recs,
        auto_share_calendar: group.privacy.auto_share_calendar,
      });
    } else {
      setName('');
      setEmoji(null);
      setSelectedMembers(new Set());
      setPrivacy({
        can_see_my_loop: true,
        i_can_see_their_loop: true,
        include_in_group_recs: true,
        include_in_one_on_one_recs: true,
        auto_share_calendar: false,
      });
    }
  }, [group, visible]);

  const toggleMember = (friendId: string) => {
    const next = new Set(selectedMembers);
    if (next.has(friendId)) {
      next.delete(friendId);
    } else {
      next.add(friendId);
    }
    setSelectedMembers(next);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (isEditing && group) {
        // Update group name/emoji
        await updateFriendGroup(group.id, { name: name.trim(), emoji: emoji || undefined });

        // Sync members: add new, remove old
        const existingIds = new Set(group.members.map((m) => m.friend_user_id));
        const toAdd = [...selectedMembers].filter((id) => !existingIds.has(id));
        const toRemove = [...existingIds].filter((id) => !selectedMembers.has(id));

        for (const friendId of toAdd) {
          await addMemberToGroup(group.id, friendId, userId);
        }
        for (const friendId of toRemove) {
          await removeMemberFromGroup(group.id, friendId);
        }

        // Update privacy
        await updateGroupPrivacy(group.id, privacy);
      } else {
        // Create new group
        const newGroup = await createFriendGroup(userId, name.trim(), emoji || undefined);

        // Add members
        for (const friendId of selectedMembers) {
          await addMemberToGroup(newGroup.id, friendId, userId);
        }

        // Update privacy (defaults were set on create, but update if user changed them)
        await updateGroupPrivacy(newGroup.id, privacy);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Error saving group:', error);
      Alert.alert('Error', error.message || 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!group) return;

    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${group.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFriendGroup(group.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onSaved();
              onClose();
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('Error', 'Failed to delete group');
            }
          },
        },
      ]
    );
  };

  const getInitials = (n: string) =>
    n.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const PrivacyToggle = ({
    label,
    value,
    field,
  }: {
    label: string;
    value: boolean;
    field: keyof typeof privacy;
  }) => (
    <View style={[styles.privacyRow, { borderColor: colors.icon + '20' }]}>
      <Text style={[styles.privacyLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(val) => setPrivacy((p) => ({ ...p, [field]: val }))}
        trackColor={{ true: BrandColors.loopBlue }}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: isDark ? '#1f2123' : '#ffffff' }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.icon + '20' }]}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.icon} />
            </TouchableOpacity>
            <Text style={[Typography.headlineMedium, { color: colors.text }]}>
              {isEditing ? 'Edit Group' : 'New Group'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[Typography.labelLarge, { color: saving ? colors.icon : BrandColors.loopBlue }]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
              style={[
                styles.nameInput,
                {
                  backgroundColor: isDark ? '#2f3133' : '#f5f5f5',
                  color: colors.text,
                },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Hiking Crew"
              placeholderTextColor={colors.icon}
              maxLength={100}
            />

            {/* Emoji Picker */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[
                    styles.emojiOption,
                    emoji === e && { backgroundColor: BrandColors.loopBlue + '30', borderColor: BrandColors.loopBlue },
                  ]}
                  onPress={() => setEmoji(emoji === e ? null : e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Members */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Members ({selectedMembers.size})
            </Text>
            {friends.map((friend) => {
              const selected = selectedMembers.has(friend.id);
              return (
                <TouchableOpacity
                  key={friend.id}
                  style={[
                    styles.memberRow,
                    { borderColor: selected ? BrandColors.loopBlue : colors.icon + '20' },
                  ]}
                  onPress={() => toggleMember(friend.id)}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: BrandColors.loopBlue + '20' }]}>
                    <Text style={[Typography.labelMedium, { color: BrandColors.loopBlue }]}>
                      {getInitials(friend.name)}
                    </Text>
                  </View>
                  <Text style={[Typography.bodyMedium, { color: colors.text, flex: 1 }]}>
                    {friend.name}
                  </Text>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={selected ? BrandColors.loopBlue : colors.icon}
                  />
                </TouchableOpacity>
              );
            })}

            {/* Privacy Controls */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: Spacing.lg }]}>
              Privacy Controls
            </Text>
            <PrivacyToggle
              label="Members can see my Loop"
              value={privacy.can_see_my_loop}
              field="can_see_my_loop"
            />
            <PrivacyToggle
              label="I can see their Loops"
              value={privacy.i_can_see_their_loop}
              field="i_can_see_their_loop"
            />
            <PrivacyToggle
              label="Include in group activity suggestions"
              value={privacy.include_in_group_recs}
              field="include_in_group_recs"
            />
            <PrivacyToggle
              label="Include in 1-on-1 suggestions"
              value={privacy.include_in_one_on_one_recs}
              field="include_in_one_on_one_recs"
            />
            <PrivacyToggle
              label="Auto-share calendar events"
              value={privacy.auto_share_calendar}
              field="auto_share_calendar"
            />

            {/* Delete Group */}
            {isEditing && (
              <TouchableOpacity
                style={[styles.deleteButton, { borderColor: BrandColors.error }]}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={20} color={BrandColors.error} />
                <Text style={[Typography.labelLarge, { color: BrandColors.error, marginLeft: 8 }]}>
                  Delete Group
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 60 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  nameInput: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.sm,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  emojiText: { fontSize: 22 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  privacyLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: Spacing.sm,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
  },
});
