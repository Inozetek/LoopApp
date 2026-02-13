/**
 * Locations Settings Screen
 *
 * Allows users to set and update their home and work addresses.
 * These locations are used for:
 * - Loop Map visualization (showing route from home)
 * - Commute-based recommendations
 * - Distance calculations
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocationAutocomplete } from '@/components/location-autocomplete';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BorderRadius, BrandColors, Typography } from '@/constants/brand';

interface LocationData {
  address: string;
  latitude: number;
  longitude: number;
}

export default function LocationsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user, updateUserProfile } = useAuth();

  // Form state
  const [homeAddress, setHomeAddress] = useState('');
  const [homeLocation, setHomeLocation] = useState<LocationData | null>(null);
  const [workAddress, setWorkAddress] = useState('');
  const [workLocation, setWorkLocation] = useState<LocationData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing addresses on mount
  useEffect(() => {
    if (user) {
      // Set home address
      if (user.home_address) {
        setHomeAddress(user.home_address);
        // Try to parse existing location
        const homeLoc = parseStoredLocation(user.home_location);
        if (homeLoc) {
          setHomeLocation({
            address: user.home_address,
            ...homeLoc,
          });
        }
      }

      // Set work address
      if (user.work_address) {
        setWorkAddress(user.work_address);
        const workLoc = parseStoredLocation(user.work_location);
        if (workLoc) {
          setWorkLocation({
            address: user.work_address,
            ...workLoc,
          });
        }
      }
    }
  }, [user]);

  // Parse stored PostGIS location to lat/lng
  const parseStoredLocation = (location: any): { latitude: number; longitude: number } | null => {
    if (!location) return null;

    // Handle PostGIS object format: { coordinates: [lng, lat] }
    if (typeof location === 'object' && 'coordinates' in location) {
      return {
        latitude: location.coordinates[1],
        longitude: location.coordinates[0],
      };
    }

    // Handle POINT string format
    if (typeof location === 'string') {
      const match = location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
      if (match) {
        return {
          latitude: parseFloat(match[2]),
          longitude: parseFloat(match[1]),
        };
      }
    }

    return null;
  };

  // Handle home location selection
  const handleSelectHome = (location: {
    placeName: string;
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHomeAddress(location.address);
    setHomeLocation({
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setHasChanges(true);
  };

  // Handle work location selection
  const handleSelectWork = (location: {
    placeName: string;
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWorkAddress(location.address);
    setWorkLocation({
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setHasChanges(true);
  };

  // Clear home location
  const clearHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHomeAddress('');
    setHomeLocation(null);
    setHasChanges(true);
  };

  // Clear work location
  const clearWork = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWorkAddress('');
    setWorkLocation(null);
    setHasChanges(true);
  };

  // Save locations
  const handleSave = async () => {
    if (!user) return;

    // Require at least home address
    if (!homeLocation) {
      Alert.alert('Home Address Required', 'Please set your home address to enable Loop Map features.');
      return;
    }

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Format locations as PostGIS POINT
      const homePoint = homeLocation
        ? `POINT(${homeLocation.longitude} ${homeLocation.latitude})`
        : null;
      const workPoint = workLocation
        ? `POINT(${workLocation.longitude} ${workLocation.latitude})`
        : null;

      const { error } = await supabase
        .from('users')
        .update({
          home_address: homeLocation?.address || null,
          home_location: homePoint,
          work_address: workLocation?.address || null,
          work_location: workPoint,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update auth context
      await updateUserProfile({
        home_address: homeLocation?.address || null,
        home_location: homePoint as any,
        work_address: workLocation?.address || null,
        work_location: workPoint as any,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Your locations have been saved!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving locations:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Save Failed', 'Unable to save locations. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to leave?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Locations</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Info Banner */}
          <View style={[styles.infoBanner, { backgroundColor: BrandColors.loopBlue + '15' }]}>
            <Ionicons name="information-circle" size={20} color={BrandColors.loopBlue} />
            <Text style={[styles.infoText, { color: BrandColors.loopBlue }]}>
              Your locations help Loop show your daily route and provide better recommendations.
            </Text>
          </View>

          {/* Home Address Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.iconContainer, { backgroundColor: BrandColors.loopGreen + '20' }]}>
                <Ionicons name="home" size={24} color={BrandColors.loopGreen} />
              </View>
              <View style={styles.sectionTitleContainer}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Home Address</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Used for Loop Map start/end point
                </Text>
              </View>
            </View>

            {homeLocation ? (
              <View style={[styles.savedLocation, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.savedLocationContent}>
                  <Ionicons name="checkmark-circle" size={20} color={BrandColors.loopGreen} />
                  <Text style={[styles.savedLocationText, { color: colors.text }]} numberOfLines={2}>
                    {homeLocation.address}
                  </Text>
                </View>
                <TouchableOpacity onPress={clearHome} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <LocationAutocomplete
                value={homeAddress}
                onChangeText={(text) => {
                  setHomeAddress(text);
                  if (!text) setHomeLocation(null);
                }}
                onSelectLocation={handleSelectHome}
                placeholder="Enter your home address"
                isDark={colorScheme === 'dark'}
              />
            )}
          </View>

          {/* Work Address Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.iconContainer, { backgroundColor: BrandColors.loopBlue + '20' }]}>
                <Ionicons name="briefcase" size={24} color={BrandColors.loopBlue} />
              </View>
              <View style={styles.sectionTitleContainer}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Work Address</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Optional - for commute recommendations
                </Text>
              </View>
            </View>

            {workLocation ? (
              <View style={[styles.savedLocation, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.savedLocationContent}>
                  <Ionicons name="checkmark-circle" size={20} color={BrandColors.loopBlue} />
                  <Text style={[styles.savedLocationText, { color: colors.text }]} numberOfLines={2}>
                    {workLocation.address}
                  </Text>
                </View>
                <TouchableOpacity onPress={clearWork} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <LocationAutocomplete
                value={workAddress}
                onChangeText={(text) => {
                  setWorkAddress(text);
                  if (!text) setWorkLocation(null);
                }}
                onSelectLocation={handleSelectWork}
                placeholder="Enter your work address (optional)"
                isDark={colorScheme === 'dark'}
              />
            )}
          </View>

          {/* Tips Section */}
          <View style={[styles.tipsSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.tipsTitle, { color: colors.text }]}>Why set locations?</Text>
            <View style={styles.tipItem}>
              <Ionicons name="map" size={16} color={BrandColors.loopOrange} />
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                See your daily Loop route on the map
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="navigate" size={16} color={BrandColors.loopOrange} />
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                Get activity suggestions along your commute
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="time" size={16} color={BrandColors.loopOrange} />
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                Accurate travel time estimates
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.saveButtonContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom + Spacing.md }]}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: hasChanges ? BrandColors.loopBlue : colors.border },
              isSaving && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? (
              <Text style={styles.saveButtonText}>Saving...</Text>
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Save Locations</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginRight: 44, // Balance the back button width
  },
  headerSpacer: {
    width: 0,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  savedLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  savedLocationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  savedLocationText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  tipsSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipText: {
    fontSize: 14,
  },
  saveButtonContainer: {
    padding: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
