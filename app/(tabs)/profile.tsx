/**
 * Profile Screen
 *
 * Allows users to view and edit their profile information:
 * - Profile picture upload
 * - Name, email, phone
 * - Selected interests
 * - Account settings
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LoopHeader } from '@/components/loop-header';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { ONBOARDING_INTERESTS, INTEREST_GROUPS } from '@/constants/activity-categories';

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LoopHeader
        showBackButton={true}
        onBackPress={() => router.push('/(tabs)')} // Navigate to feed, not back
        showSettingsButton={false}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile Picture</Text>

          <TouchableOpacity
            style={styles.profilePictureContainer}
            onPress={handleProfilePictureUpload}
          >
            {profilePicture ? (
              <Image
                source={{ uri: profilePicture }}
                style={styles.profilePicture}
              />
            ) : (
              <View style={[styles.profilePicturePlaceholder, { backgroundColor: colors.card }]}>
                <Ionicons name="person" size={48} color={colors.textSecondary} />
              </View>
            )}

            <View style={[styles.editBadge, { backgroundColor: BrandColors.loopBlue }]}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Tap to upload a profile picture
          </Text>
        </View>

        {/* Personal Information Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>

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
        </View>

        {/* Interests Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Your Interests ({selectedInterests.length})
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary, marginBottom: Spacing.md }]}>
            Select interests to get personalized recommendations
          </Text>

          <View style={styles.interestsGrid}>
            {ONBOARDING_INTERESTS.map((interest) => {
              const isSelected = selectedInterests.includes(interest);
              const group = INTEREST_GROUPS[interest];
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
                  <Text style={[
                    styles.interestText,
                    { color: isSelected ? '#FFFFFF' : colors.text }
                  ]}>
                    {group?.icon} {interest}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Save Button */}
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
      </ScrollView>
    </View>
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
    paddingBottom: Spacing.xl * 2,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  profilePictureContainer: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profilePicturePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
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
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  interestText: {
    fontSize: 15,
    fontWeight: '600',
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
