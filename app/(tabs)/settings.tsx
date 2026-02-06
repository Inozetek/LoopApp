/**
 * Settings Screen
 * User settings including tutorial replay, profile editing, and preferences
 * Updated to match app theme and include proper header
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoopHeader } from '@/components/loop-header';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BorderRadius, BrandColors, Typography } from '@/constants/brand';
import { getBlockedActivities, unblockActivity } from '@/services/recommendation-persistence';

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const [blockedPlaces, setBlockedPlaces] = useState<any[]>([]);
  const [showBlockedPlacesModal, setShowBlockedPlacesModal] = useState(false);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Load blocked places
  const loadBlockedPlaces = async () => {
    if (!user) return;

    setLoadingBlocked(true);
    try {
      const blocked = await getBlockedActivities(user.id);
      setBlockedPlaces(blocked);
    } catch (error) {
      console.error('Error loading blocked places:', error);
    } finally {
      setLoadingBlocked(false);
    }
  };

  // Load blocked places on mount and when modal opens
  useEffect(() => {
    if (showBlockedPlacesModal) {
      loadBlockedPlaces();
    }
  }, [showBlockedPlacesModal]);

  const handleReplayTutorial = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Replay Tutorial',
      'Tutorial feature is coming soon!',
      [{ text: 'OK', style: 'cancel' }]
    );
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleUnblock = async (googlePlaceId: string, placeName: string) => {
    if (!user) return;

    Alert.alert(
      'Unblock Place',
      `Allow "${placeName}" to appear in recommendations again?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await unblockActivity(user.id, googlePlaceId);
              // Refresh the list
              await loadBlockedPlaces();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', `${placeName} has been unblocked.`);
            } catch (error) {
              console.error('Error unblocking place:', error);
              Alert.alert('Error', 'Failed to unblock place. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderMenuItem = (
    icon: string,
    iconColor: string,
    iconBgColor: string,
    title: string,
    description?: string,
    onPress?: () => void
  ) => (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.menuIcon, { backgroundColor: iconBgColor }]}>
          <Ionicons name={icon as any} size={24} color={iconColor} />
        </View>
        <View style={styles.menuItemTextContainer}>
          <Text style={[styles.menuItemTitle, { color: colors.text }]}>{title}</Text>
          {description && (
            <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>
              {description}
            </Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LoopHeader
        showBackButton={true}
        onBackPress={() => router.push('/(tabs)')}
        showSettingsButton={false}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.profileAvatar, { backgroundColor: BrandColors.loopBlue }]}>
            <Ionicons name="person" size={40} color="#fff" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {user?.name || 'User'}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {user?.email || ''}
            </Text>
            <TouchableOpacity
              style={[styles.editProfileButton, { backgroundColor: BrandColors.loopBlue + '20' }]}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Text style={[styles.editProfileText, { color: BrandColors.loopBlue }]}>
                Edit Profile
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Help & Tutorial</Text>

          {renderMenuItem(
            'help-circle',
            BrandColors.loopBlue,
            BrandColors.loopBlue + '20',
            'Replay Tutorial',
            'Review how to navigate and use Loop',
            handleReplayTutorial
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account</Text>

          {renderMenuItem(
            'notifications',
            BrandColors.loopOrange,
            BrandColors.loopOrange + '20',
            'Notifications',
            'Manage notification preferences',
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          )}

          {renderMenuItem(
            'shield-checkmark',
            BrandColors.success,
            BrandColors.success + '20',
            'Privacy',
            'Control who can see your Loop and invite you',
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          )}
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Preferences</Text>

          {renderMenuItem(
            'heart',
            BrandColors.like,
            BrandColors.like + '20',
            'Interests',
            'Update your interests and preferences',
            () => router.push('/(tabs)/profile')
          )}

          {renderMenuItem(
            'location',
            BrandColors.loopBlue,
            BrandColors.loopBlue + '20',
            'Locations',
            'Update home and work addresses',
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          )}

          {renderMenuItem(
            'ban',
            BrandColors.error,
            BrandColors.error + '20',
            'Blocked Places',
            'Manage places hidden from recommendations',
            () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowBlockedPlacesModal(true);
            }
          )}
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Subscription</Text>

          <View style={[styles.subscriptionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.subscriptionHeader}>
              <Text style={[styles.subscriptionTier, { color: BrandColors.loopBlue }]}>
                {user?.subscription_tier?.toUpperCase() || 'FREE'} TIER
              </Text>
              <View style={[styles.subscriptionBadge, { backgroundColor: BrandColors.loopOrange + '20' }]}>
                <Ionicons name="star" size={16} color={BrandColors.loopOrange} />
              </View>
            </View>
            <Text style={[styles.subscriptionDescription, { color: colors.textSecondary }]}>
              {user?.subscription_tier === 'free'
                ? 'Upgrade to Loop Plus for unlimited recommendations and group planning'
                : 'Thanks for supporting Loop!'}
            </Text>
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: BrandColors.loopBlue }]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <Text style={styles.upgradeButtonText}>
                {user?.subscription_tier === 'free' ? 'Upgrade to Plus' : 'Manage Subscription'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>

          {renderMenuItem(
            'information-circle',
            BrandColors.loopIndigo,
            BrandColors.loopIndigo + '20',
            'About Loop',
            undefined,
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          )}

          {renderMenuItem(
            'document-text',
            BrandColors.loopPurple,
            BrandColors.loopPurple + '20',
            'Terms & Privacy',
            undefined,
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          )}

          {renderMenuItem(
            'log-out',
            BrandColors.loopPink,
            BrandColors.loopPink + '20',
            'Sign Out',
            undefined,
            handleSignOut
          )}
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>Loop v1.0.0</Text>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Made with ❤️ for better days
          </Text>
        </View>
      </ScrollView>

      {/* Blocked Places Modal */}
      <Modal
        visible={showBlockedPlacesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBlockedPlacesModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + Spacing.md }]}>
            <TouchableOpacity
              onPress={() => setShowBlockedPlacesModal(false)}
              style={styles.modalBackButton}
            >
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Blocked Places</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Blocked Places List */}
          {loadingBlocked ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BrandColors.loopBlue} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading blocked places...
              </Text>
            </View>
          ) : blockedPlaces.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={64} color={BrandColors.success} />
              <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Blocked Places</Text>
              <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
                You haven't blocked any places from recommendations yet.
              </Text>
            </View>
          ) : (
            <FlatList
              data={blockedPlaces}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.blockedList}
              renderItem={({ item }) => (
                <View style={[styles.blockedItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.blockedItemLeft}>
                    <View style={[styles.blockedIconContainer, { backgroundColor: BrandColors.error + '20' }]}>
                      <Ionicons name="ban" size={20} color={BrandColors.error} />
                    </View>
                    <View style={styles.blockedItemInfo}>
                      <Text style={[styles.blockedItemName, { color: colors.text }]}>
                        {item.place_name}
                      </Text>
                      <Text style={[styles.blockedItemDate, { color: colors.textSecondary }]}>
                        Blocked {new Date(item.blocked_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.unblockButton, { backgroundColor: BrandColors.success }]}
                    onPress={() => handleUnblock(item.google_place_id, item.place_name)}
                  >
                    <Text style={styles.unblockButtonText}>Unblock</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  profileAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  editProfileButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  menuItemTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  menuItemDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  subscriptionCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  subscriptionTier: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  subscriptionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  upgradeButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 12,
    marginBottom: 4,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    fontSize: 16,
    marginTop: Spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyStateDescription: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  blockedList: {
    padding: Spacing.lg,
  },
  blockedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  blockedItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  blockedIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  blockedItemInfo: {
    flex: 1,
  },
  blockedItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  blockedItemDate: {
    fontSize: 13,
  },
  unblockButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  unblockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
