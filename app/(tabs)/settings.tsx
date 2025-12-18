/**
 * Settings Screen
 * User settings including tutorial replay, profile editing, and preferences
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
import { Ionicons } from '@expo/vector-icons';
import { useTutorial } from '@/contexts/tutorial-context';
import { useAuth } from '@/contexts/auth-context';
import { Colors } from '@/constants/theme';
import { getBlockedActivities, unblockActivity } from '@/services/recommendation-persistence';

export default function SettingsScreen() {
  const { startTutorial } = useTutorial();
  const { user } = useAuth();
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
    Alert.alert(
      'Replay Tutorial',
      'This will show you the app navigation tutorial again. Ready to start?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Tutorial',
          onPress: () => {
            console.log('📚 User requested tutorial replay from Settings');
            startTutorial();
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>

        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Ionicons name="person" size={40} color="#fff" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
            <Text style={styles.profileUsername}>@{user?.username || 'username'}</Text>
          </View>
        </View>
      </View>

      {/* Tutorial Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help & Tutorial</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleReplayTutorial}
        >
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#00D4FF20' }]}>
              <Ionicons name="help-circle" size={24} color="#00D4FF" />
            </View>
            <View>
              <Text style={styles.menuItemTitle}>Replay Tutorial</Text>
              <Text style={styles.menuItemDescription}>
                Review how to navigate and use Loop
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#7C3AED20' }]}>
              <Ionicons name="person-circle" size={24} color="#7C3AED" />
            </View>
            <View>
              <Text style={styles.menuItemTitle}>Edit Profile</Text>
              <Text style={styles.menuItemDescription}>
                Update your name, username, and contact info
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="notifications" size={24} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.menuItemTitle}>Notifications</Text>
              <Text style={styles.menuItemDescription}>
                Manage notification preferences
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="shield-checkmark" size={24} color="#10B981" />
            </View>
            <View>
              <Text style={styles.menuItemTitle}>Privacy</Text>
              <Text style={styles.menuItemDescription}>
                Control who can see your Loop and invite you
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="heart" size={24} color="#EF4444" />
            </View>
            <View>
              <Text style={styles.menuItemTitle}>Interests</Text>
              <Text style={styles.menuItemDescription}>
                Update your interests and preferences
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="location" size={24} color="#3B82F6" />
            </View>
            <View>
              <Text style={styles.menuItemTitle}>Locations</Text>
              <Text style={styles.menuItemDescription}>
                Update home and work addresses
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setShowBlockedPlacesModal(true)}
        >
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="ban" size={24} color="#EF4444" />
            </View>
            <View>
              <Text style={styles.menuItemTitle}>Blocked Places</Text>
              <Text style={styles.menuItemDescription}>
                Manage places you've hidden from recommendations
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Subscription Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>

        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeader}>
            <Text style={styles.subscriptionTier}>
              {user?.subscription_tier?.toUpperCase() || 'FREE'} TIER
            </Text>
            <View style={styles.subscriptionBadge}>
              <Ionicons name="star" size={16} color="#F59E0B" />
            </View>
          </View>
          <Text style={styles.subscriptionDescription}>
            {user?.subscription_tier === 'free'
              ? 'Upgrade to Loop Plus for unlimited recommendations and group planning'
              : 'Thanks for supporting Loop!'}
          </Text>
          <TouchableOpacity style={styles.upgradeButton}>
            <Text style={styles.upgradeButtonText}>
              {user?.subscription_tier === 'free' ? 'Upgrade to Plus' : 'Manage Subscription'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#6366F120' }]}>
              <Ionicons name="information-circle" size={24} color="#6366F1" />
            </View>
            <Text style={styles.menuItemTitle}>About Loop</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#8B5CF620' }]}>
              <Ionicons name="document-text" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.menuItemTitle}>Terms & Privacy</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, { backgroundColor: '#EC489920' }]}>
              <Ionicons name="log-out" size={24} color="#EC4899" />
            </View>
            <Text style={styles.menuItemTitle}>Sign Out</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Loop v1.0.0</Text>
        <Text style={styles.footerText}>Made with ❤️ for better days</Text>
      </View>

      {/* Blocked Places Modal */}
      <Modal
        visible={showBlockedPlacesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBlockedPlacesModal(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Blocked Places</Text>
            <TouchableOpacity
              onPress={() => setShowBlockedPlacesModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Blocked Places List */}
          {loadingBlocked ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00D4FF" />
              <Text style={styles.loadingText}>Loading blocked places...</Text>
            </View>
          ) : blockedPlaces.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
              <Text style={styles.emptyStateTitle}>No Blocked Places</Text>
              <Text style={styles.emptyStateDescription}>
                You haven't blocked any places from recommendations yet.
              </Text>
            </View>
          ) : (
            <FlatList
              data={blockedPlaces}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.blockedList}
              renderItem={({ item }) => (
                <View style={styles.blockedItem}>
                  <View style={styles.blockedItemLeft}>
                    <Ionicons name="ban" size={24} color="#EF4444" />
                    <View style={styles.blockedItemInfo}>
                      <Text style={styles.blockedItemName}>{item.place_name}</Text>
                      <Text style={styles.blockedItemDate}>
                        Blocked {new Date(item.blocked_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.unblockButton}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  profileAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#00D4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 14,
    color: '#00D4FF',
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  menuItemDescription: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    maxWidth: 220,
  },
  subscriptionCard: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subscriptionTier: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00D4FF',
    letterSpacing: 1,
  },
  subscriptionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F59E0B20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionDescription: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
    marginBottom: 16,
  },
  upgradeButton: {
    backgroundColor: '#00D4FF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  // Blocked Places Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    marginTop: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  blockedList: {
    padding: 20,
  },
  blockedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  blockedItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  blockedItemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  blockedItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  blockedItemDate: {
    fontSize: 13,
    color: '#888',
  },
  unblockButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unblockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
