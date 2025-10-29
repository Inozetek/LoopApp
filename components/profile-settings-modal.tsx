/**
 * Profile Settings Modal
 *
 * Allows users to view and edit their profile information:
 * - Name, email, Loop Score
 * - Interests
 * - Feedback statistics
 * - Privacy settings
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { getUserFeedbackStats } from '@/services/feedback-service';
import { BrandColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import {
  getLocationPermissionStatus,
  requestLocationPermissions,
} from '@/services/location-service';
import { Linking } from 'react-native';
import { handleError, validateRequired } from '@/utils/error-handler';

interface ProfileSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userEmail: string;
  userLoopScore: number;
}

const AVAILABLE_INTERESTS = [
  'Coffee',
  'Dining',
  'Live Music',
  'Fitness',
  'Outdoor',
  'Culture',
  'Bars',
  'Shopping',
  'Sports',
  'Movies',
  'Art',
  'Theater',
  'Hiking',
  'Yoga',
  'Brunch',
  'Nightlife',
  'Gaming',
  'Photography',
];

export function ProfileSettingsModal({
  visible,
  onClose,
  userId,
  userName,
  userEmail,
  userLoopScore,
}: ProfileSettingsModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const [name, setName] = useState(userName);
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [feedbackStats, setFeedbackStats] = useState({
    totalFeedback: 0,
    thumbsUpCount: 0,
    thumbsDownCount: 0,
    satisfactionRate: 0,
    topCategories: [] as string[],
  });

  useEffect(() => {
    if (visible) {
      loadUserData();
      loadFeedbackStats();
      loadLocationPermission();
    }
  }, [visible]);

  const loadUserData = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, interests')
        .eq('id', userId)
        .single();

      if (error) throw error;

      const userData = data as any;
      setName(userData.name || userName);
      setInterests(userData.interests || []);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadFeedbackStats = async () => {
    const stats = await getUserFeedbackStats(userId);
    setFeedbackStats(stats);
  };

  const loadLocationPermission = async () => {
    try {
      const status = await getLocationPermissionStatus();
      setLocationPermission(status);
    } catch (error) {
      console.error('Error checking location permission:', error);
    }
  };

  const handleEnableLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const currentStatus = await getLocationPermissionStatus();

    if (currentStatus === 'denied') {
      // Permission was permanently denied, need to go to settings
      Alert.alert(
        'Location Permission',
        'Location access is disabled. Please enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
        ]
      );
      return;
    }

    // Request permission
    const granted = await requestLocationPermissions();

    if (granted) {
      setLocationPermission('granted');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Location access enabled! Pull down to refresh recommendations with your real location.');
    } else {
      setLocationPermission('denied');
    }
  };

  const toggleInterest = (interest: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSave = async () => {
    // Validate inputs
    const validationError = validateRequired(
      { name, interests: interests.length > 0 ? interests : null },
      { name: 'Name', interests: 'At least one interest' }
    );

    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { error } = await (supabase
        .from('users') as any)
        .update({
          name: name.trim(),
          interests,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Profile updated successfully!');
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      handleError(error, 'updating profile', handleSave);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

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
            <Text style={[styles.title, { color: colors.text }]}>Profile Settings</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Info Card */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#1f2123' : '#f8f9fa',
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.profileHeader}>
                <View
                  style={[
                    styles.avatarLarge,
                    { backgroundColor: BrandColors.loopBlue },
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={[Typography.headlineMedium, { color: colors.text }]}>
                    {userName}
                  </Text>
                  <Text style={[Typography.bodyMedium, { color: colors.icon }]}>
                    {userEmail}
                  </Text>
                  <View style={styles.loopScoreContainer}>
                    <Ionicons name="trophy" size={16} color={BrandColors.star} />
                    <Text
                      style={[
                        Typography.labelLarge,
                        { color: BrandColors.star, marginLeft: 4 },
                      ]}
                    >
                      Loop Score: {userLoopScore}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Feedback Stats Card */}
            {feedbackStats.totalFeedback > 0 && (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark ? '#1f2123' : '#ffffff',
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[Typography.titleLarge, { color: colors.text, marginBottom: 12 }]}>
                  Activity Feedback
                </Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[Typography.headlineMedium, { color: '#10b981' }]}>
                      {feedbackStats.thumbsUpCount}
                    </Text>
                    <Text style={[Typography.bodySmall, { color: colors.icon }]}>
                      Loved
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[Typography.headlineMedium, { color: '#ef4444' }]}>
                      {feedbackStats.thumbsDownCount}
                    </Text>
                    <Text style={[Typography.bodySmall, { color: colors.icon }]}>
                      Not Great
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[Typography.headlineMedium, { color: BrandColors.loopBlue }]}>
                      {Math.round(feedbackStats.satisfactionRate)}%
                    </Text>
                    <Text style={[Typography.bodySmall, { color: colors.icon }]}>
                      Satisfaction
                    </Text>
                  </View>
                </View>
                {feedbackStats.topCategories.length > 0 && (
                  <>
                    <Text style={[Typography.labelLarge, { color: colors.text, marginTop: 12, marginBottom: 8 }]}>
                      Top Categories:
                    </Text>
                    <View style={styles.topCategoriesContainer}>
                      {feedbackStats.topCategories.map((category) => (
                        <View
                          key={category}
                          style={[
                            styles.categoryChip,
                            { backgroundColor: BrandColors.loopBlue + '20' },
                          ]}
                        >
                          <Text
                            style={[
                              Typography.bodySmall,
                              { color: BrandColors.loopBlue },
                            ]}
                          >
                            {category}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Edit Name */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#1f2123' : '#ffffff',
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[Typography.titleLarge, { color: colors.text, marginBottom: 12 }]}>
                Name
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#2f3133' : '#f5f5f5',
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.icon}
                maxLength={50}
              />
            </View>

            {/* Edit Interests */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#1f2123' : '#ffffff',
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[Typography.titleLarge, { color: colors.text, marginBottom: 8 }]}>
                Interests
              </Text>
              <Text style={[Typography.bodySmall, { color: colors.icon, marginBottom: 12 }]}>
                Select at least 3 to get better recommendations
              </Text>
              <View style={styles.interestsGrid}>
                {AVAILABLE_INTERESTS.map((interest) => (
                  <TouchableOpacity
                    key={interest}
                    onPress={() => toggleInterest(interest)}
                    style={[
                      styles.interestChip,
                      interests.includes(interest) && styles.interestChipSelected,
                      {
                        backgroundColor: interests.includes(interest)
                          ? BrandColors.loopBlue
                          : (isDark ? '#2f3133' : '#f5f5f5'),
                        borderColor: interests.includes(interest)
                          ? BrandColors.loopBlue
                          : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        Typography.bodyMedium,
                        {
                          color: interests.includes(interest) ? '#ffffff' : colors.text,
                        },
                      ]}
                    >
                      {interest}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Location Services */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#1f2123' : '#ffffff',
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.locationHeader}>
                <View>
                  <Text style={[Typography.titleLarge, { color: colors.text, marginBottom: 4 }]}>
                    Location Services
                  </Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon }]}>
                    Enable to get personalized recommendations nearby
                  </Text>
                </View>
                <Ionicons
                  name={locationPermission === 'granted' ? 'location' : 'location-outline'}
                  size={32}
                  color={locationPermission === 'granted' ? BrandColors.loopBlue : colors.icon}
                />
              </View>

              <View style={styles.locationStatus}>
                <View style={styles.locationStatusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          locationPermission === 'granted'
                            ? '#10b981'
                            : locationPermission === 'denied'
                            ? '#ef4444'
                            : '#f59e0b',
                      },
                    ]}
                  />
                  <Text style={[Typography.bodyMedium, { color: colors.text, marginLeft: 8 }]}>
                    Status:{' '}
                    {locationPermission === 'granted'
                      ? 'Enabled'
                      : locationPermission === 'denied'
                      ? 'Disabled'
                      : 'Not Set'}
                  </Text>
                </View>

                {locationPermission !== 'granted' && (
                  <TouchableOpacity
                    onPress={handleEnableLocation}
                    style={[
                      styles.enableLocationButton,
                      { backgroundColor: BrandColors.loopBlue },
                    ]}
                  >
                    <Ionicons name="location" size={18} color="#ffffff" />
                    <Text style={styles.enableLocationText}>
                      {locationPermission === 'denied' ? 'Open Settings' : 'Enable Location'}
                    </Text>
                  </TouchableOpacity>
                )}

                {locationPermission === 'granted' && (
                  <View style={styles.locationEnabledInfo}>
                    <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                    <Text style={[Typography.bodySmall, { color: '#10b981', marginLeft: 6 }]}>
                      Getting personalized recommendations
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Referral Rewards */}
            <TouchableOpacity
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#1f2123' : '#ffffff',
                  borderColor: colors.border,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                // Open referral dashboard (will be shown in separate screen/modal)
                Alert.alert(
                  '🎁 Referral Program',
                  'Invite friends and earn rewards!\n\n• Invite 3 friends → Get 1 month Loop Plus free\n• They get 7 days free to start\n• Track your progress and see rewards\n\nComing in next update!',
                  [{ text: 'Got it!' }]
                );
              }}
              activeOpacity={0.7}
            >
              <View style={styles.locationHeader}>
                <View>
                  <Text style={[Typography.titleLarge, { color: colors.text, marginBottom: 4 }]}>
                    Invite Friends & Earn Rewards
                  </Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon }]}>
                    Get 1 month Loop Plus for every 3 friends who join
                  </Text>
                </View>
                <Ionicons name="gift" size={32} color={BrandColors.loopGreen} />
              </View>

              <View style={styles.referralPreview}>
                <View style={styles.referralStat}>
                  <Text style={[Typography.titleLarge, { color: BrandColors.loopGreen }]}>0</Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon }]}>Friends Invited</Text>
                </View>
                <View style={styles.referralStat}>
                  <Text style={[Typography.titleLarge, { color: BrandColors.loopBlue }]}>0</Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon }]}>Rewards Earned</Text>
                </View>
              </View>

              <View style={[styles.enableLocationButton, { backgroundColor: BrandColors.loopGreen }]}>
                <Ionicons name="share-social" size={18} color="#ffffff" />
                <Text style={styles.enableLocationText}>
                  Start Inviting
                </Text>
              </View>
            </TouchableOpacity>

            {/* App Info */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#1f2123' : '#f8f9fa',
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[Typography.bodySmall, { color: colors.icon, textAlign: 'center' }]}>
                Loop App v1.0 (MVP)
              </Text>
              <Text style={[Typography.bodySmall, { color: colors.icon, textAlign: 'center', marginTop: 4 }]}>
                Progress: 95% Complete
              </Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: '95%', backgroundColor: BrandColors.loopBlue },
                  ]}
                />
              </View>
            </View>
          </ScrollView>

          {/* Save Button */}
          <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[
                styles.saveButton,
                {
                  backgroundColor: BrandColors.loopBlue,
                  opacity: saving ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
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
    borderWidth: 1,
    ...Shadows.sm,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  loopScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  topCategoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  interestChipSelected: {
    transform: [{ scale: 1.02 }],
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    ...Shadows.md,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  locationStatus: {
    gap: 12,
  },
  locationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  enableLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    gap: 8,
    ...Shadows.sm,
  },
  enableLocationText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  locationEnabledInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  referralPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  referralStat: {
    alignItems: 'center',
  },
});
