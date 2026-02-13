/**
 * Profile Screen
 *
 * Allows users to view and edit their profile information:
 * - Profile picture upload
 * - Name, email, phone
 * - Selected interests
 * - Account settings
 *
 * UX ENHANCEMENT (v2.0) - TikTok-Style Updates:
 * - Grouped interests by category (Food & Dining, Entertainment, etc.)
 * - Improved profile picture upload experience with better visual feedback
 * - Consistent phone field visual treatment
 */

import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ProfileHeader } from '@/components/profile-header';
import ProfileStatsBar, { TraitPills, type FeedbackStats } from '@/components/profile-stats-bar';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { getUserFeedbackStats } from '@/services/feedback-service';
import SwipeableLayout from '@/components/swipeable-layout';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { ONBOARDING_INTERESTS, INTEREST_GROUPS } from '@/constants/activity-categories';
import { generatePersonalitySummary, type PersonalityInput } from '@/utils/personality-generator';

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const { user, updateUserProfile } = useAuth();

  // Form state
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture_url || '');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    (user?.interests as string[]) || []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats>({
    totalFeedback: 0,
    thumbsUpCount: 0,
    thumbsDownCount: 0,
    satisfactionRate: 0,
  });

  useEffect(() => {
    if (user?.id) {
      getUserFeedbackStats(user.id).then(setFeedbackStats).catch(() => {});
    }
  }, [user?.id]);

  // Track whether edits have been made
  const initialName = user?.name || '';
  const initialPhone = user?.phone || '';
  const initialPicture = user?.profile_picture_url || '';
  const initialInterests = (user?.interests as string[]) || [];

  const hasChanges = useMemo(() => {
    if (name !== initialName) return true;
    if (phone !== initialPhone) return true;
    if (profilePicture !== initialPicture) return true;
    if (selectedInterests.length !== initialInterests.length) return true;
    if (selectedInterests.some((i) => !initialInterests.includes(i))) return true;
    return false;
  }, [name, phone, profilePicture, selectedInterests, initialName, initialPhone, initialPicture, initialInterests]);

  // Personality summary
  const personality = useMemo(() => {
    const input: PersonalityInput = {
      interests: (user?.interests as string[]) || [],
      aiProfile: (user?.ai_profile as any) || null,
      feedbackCount: feedbackStats.totalFeedback,
      streakDays: user?.streak_days ?? 0,
      loopScore: user?.loop_score ?? 0,
    };
    return generatePersonalitySummary(input);
  }, [user?.interests, user?.ai_profile, feedbackStats.totalFeedback, user?.streak_days, user?.loop_score]);

  // Handle profile picture upload
  const handleProfilePictureUpload = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos to upload a profile picture.');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Upload to Supabase Storage
        const photo = result.assets[0];
        const fileExt = photo.uri.split('.').pop();
        const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
        const filePath = `profile-pictures/${fileName}`;

        // Convert to blob for upload
        const response = await fetch(photo.uri);
        const blob = await response.blob();

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('user-uploads')
          .upload(filePath, blob, {
            contentType: `image/${fileExt}`,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(filePath);

        setProfilePicture(urlData.publicUrl);
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Upload Failed', 'Unable to upload profile picture. Please try again.');
    }
  };

  // Toggle interest selection
  const toggleInterest = (interest: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  // Save profile changes
  const handleSave = async () => {
    if (!user) return;

    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }

    if (selectedInterests.length === 0) {
      Alert.alert('Interests Required', 'Please select at least one interest.');
      return;
    }

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
          profile_picture_url: profilePicture || null,
          interests: selectedInterests,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update auth context
      await updateUserProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        profile_picture_url: profilePicture || null,
        interests: selectedInterests,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Profile updated successfully!');

      // Navigate back to feed
      router.back();
    } catch (error) {
      console.error('Error saving profile:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Save Failed', 'Unable to save profile changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SwipeableLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ProfileHeader
          username={user?.email?.split('@')[0] || user?.name || 'Profile'}
          onMenuPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(tabs)/settings');
          }}
          onUsernamePress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(
              user?.name || 'Account',
              user?.email || '',
              [
                { text: 'Edit Profile', onPress: () => {} },
                { text: 'Switch Account', style: 'default' },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
        />

        <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handleProfilePictureUpload}
        >
          {profilePicture ? (
            <Image
              source={{ uri: profilePicture }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.card }]}>
              <Ionicons name="person" size={40} color={colors.textSecondary} />
            </View>
          )}
          <View style={[styles.cameraBadge, { backgroundColor: BrandColors.loopBlue }]}>
            <Ionicons name="camera" size={14} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Name + personality subtitle */}
        <Text style={[styles.profileName, { color: colors.text }]}>
          {user?.name || 'Your Name'}
        </Text>
        <Text style={[styles.profileSubtitle, { color: colors.textSecondary }]}>
          {personality.subtitle}
        </Text>

        {/* Stats bar + trait pills */}
        <ProfileStatsBar
          loopScore={user?.loop_score ?? 0}
          streakDays={user?.streak_days ?? 0}
          feedbackStats={feedbackStats}
        />
        <TraitPills traits={personality.traits} />

        <View style={{ height: Spacing.lg }} />

        {/* Personal Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>
          </View>

          {/* Name */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Name *</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: colors.card,
                color: colors.text,
                borderColor: colors.border,
              }]}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Email (read-only) */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Email</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: colors.card,
                color: colors.textSecondary,
                borderColor: colors.border,
              }]}
              value={user?.email || ''}
              editable={false}
            />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Email cannot be changed
            </Text>
          </View>

          {/* Phone */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Phone (optional)</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: colors.card,
                color: colors.text,
                borderColor: colors.border,
              }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
            />
          </View>

          {/* Locations Link */}
          <TouchableOpacity
            style={[styles.locationsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/locations');
            }}
          >
            <View style={[styles.locationsIconContainer, { backgroundColor: BrandColors.loopGreen + '20' }]}>
              <Ionicons name="location" size={24} color={BrandColors.loopGreen} />
            </View>
            <View style={styles.locationsContent}>
              <Text style={[styles.locationsTitle, { color: colors.text }]}>My Locations</Text>
              <Text style={[styles.locationsSubtitle, { color: colors.textSecondary }]}>
                {user?.home_address ? 'Home & work addresses set' : 'Set home and work addresses'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Interests Section - TikTok-Style Grouped Categories */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Your Interests ({selectedInterests.length})
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary, marginBottom: Spacing.md }]}>
            Select interests to get personalized recommendations
          </Text>

          {/* Group interests by type (Food, Entertainment, etc.) */}
          {(() => {
            // Define category groupings manually based on interest types
            const categoryGroups: { name: string; icon: string; interests: string[] }[] = [
              {
                name: 'Food & Dining',
                icon: '🍽️',
                interests: ['Dining', 'Coffee & Cafes', 'Bars & Nightlife', 'Desserts & Treats'],
              },
              {
                name: 'Entertainment',
                icon: '🎭',
                interests: ['Live Music', 'Movies & Cinema', 'Comedy & Theater', 'Gaming'],
              },
              {
                name: 'Fitness & Wellness',
                icon: '💪',
                interests: ['Fitness & Gym', 'Outdoor Sports', 'Yoga & Mindfulness'],
              },
              {
                name: 'Arts & Culture',
                icon: '🎨',
                interests: ['Museums & Art', 'Photography'],
              },
              {
                name: 'Outdoors & Nature',
                icon: '🌲',
                interests: ['Parks & Nature', 'Hiking & Trails'],
              },
              {
                name: 'Shopping & Services',
                icon: '🛍️',
                interests: ['Shopping', 'Beauty & Spa'],
              },
            ];

            // Filter to only show groups that have at least one interest in ONBOARDING_INTERESTS
            return categoryGroups
              .filter(group => group.interests.some(i => ONBOARDING_INTERESTS.includes(i)))
              .map((group) => {
                const validInterests = group.interests.filter(i => ONBOARDING_INTERESTS.includes(i));
                if (validInterests.length === 0) return null;

                return (
                  <View key={group.name} style={styles.interestCategory}>
                    {/* Category Header */}
                    <View style={styles.interestCategoryHeader}>
                      <Text style={styles.interestCategoryIcon}>{group.icon}</Text>
                      <Text style={[styles.interestCategoryTitle, { color: colors.text }]}>
                        {group.name}
                      </Text>
                      <Text style={[styles.interestCategoryCount, { color: colors.textSecondary }]}>
                        {validInterests.filter(i => selectedInterests.includes(i)).length}/{validInterests.length}
                      </Text>
                    </View>

                    {/* Interests in this category */}
                    <View style={styles.interestsGrid}>
                      {validInterests.map((interest) => {
                        const isSelected = selectedInterests.includes(interest);
                        const interestGroup = INTEREST_GROUPS[interest];
                        return (
                          <TouchableOpacity
                            key={interest}
                            style={[
                              styles.interestChip,
                              {
                                backgroundColor: isSelected ? BrandColors.loopBlue : colors.card,
                                borderColor: isSelected ? BrandColors.loopBlue : colors.border,
                              }
                            ]}
                            onPress={() => toggleInterest(interest)}
                          >
                            <Text style={styles.interestEmoji}>{interestGroup?.icon}</Text>
                            <Text style={[
                              styles.interestText,
                              { color: isSelected ? '#FFFFFF' : colors.text }
                            ]}>
                              {interest}
                            </Text>
                            {isSelected && (
                              <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              });
          })()}
        </View>

        {/* Save Button — only visible when edits have been made */}
        {hasChanges && (
          <TouchableOpacity
            style={[styles.saveButton, {
              backgroundColor: BrandColors.loopBlue,
              opacity: isSaving ? 0.6 : 1,
            }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      </View>
    </SwipeableLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100, // Account for tab bar + safe area
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  avatarContainer: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  profileSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  hint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  input: {
    height: 50,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  locationsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  locationsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  locationsContent: {
    flex: 1,
  },
  locationsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationsSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  // TikTok-Style Interest Categories (v2.0)
  interestCategory: {
    marginBottom: Spacing.lg,
  },
  interestCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  interestCategoryIcon: {
    fontSize: 18,
  },
  interestCategoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  interestCategoryCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  interestEmoji: {
    fontSize: 14,
  },
  interestText: {
    fontSize: 13,
    fontWeight: '500',
  },
  saveButton: {
    height: 56,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
