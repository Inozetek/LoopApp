import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { processReferralCode, completeReferral } from '@/services/referral-service';
import { geocodeAddress, reverseGeocode } from '@/services/geocoding';
import * as Location from 'expo-location';

// Common interest categories for Loop
const INTEREST_OPTIONS = [
  'Dining',
  'Fitness',
  'Entertainment',
  'Arts & Culture',
  'Sports',
  'Nightlife',
  'Shopping',
  'Outdoor Activities',
  'Music',
  'Movies',
  'Coffee & Cafes',
  'Gaming',
  'Photography',
  'Food & Cooking',
  'Wellness',
  'Technology',
  'Reading',
  'Travel',
];

export default function OnboardingScreen() {
  const { session, updateUserProfile } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const params = useLocalSearchParams<{ referralCode?: string }>();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // Step 1: Basic info
  const [name, setName] = useState('');

  // Step 2: Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Step 3: Locations
  const [homeAddress, setHomeAddress] = useState('');
  const [workAddress, setWorkAddress] = useState('');

  function toggleInterest(interest: string) {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      if (selectedInterests.length < 10) {
        setSelectedInterests([...selectedInterests, interest]);
      } else {
        Alert.alert('Maximum Interests', 'You can select up to 10 interests');
      }
    }
  }

  async function useCurrentLocation() {
    setIsFetchingLocation(true);

    try {
      console.log('📍 Requesting location permission...');

      // Request foreground location permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Loop needs location access to find activities near you and auto-fill your address.',
          [{ text: 'OK' }]
        );
        setIsFetchingLocation(false);
        return;
      }

      console.log('✅ Location permission granted');
      console.log('📍 Getting current location...');

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log(`📍 Location: ${location.coords.latitude}, ${location.coords.longitude}`);

      // Reverse geocode to get address
      const result = await reverseGeocode(
        location.coords.latitude,
        location.coords.longitude
      );

      console.log(`✅ Reverse geocoded: ${result.formattedAddress}`);

      // Auto-fill home address
      setHomeAddress(result.formattedAddress);

      Alert.alert(
        'Location Found',
        'Your home address has been auto-filled. You can edit it if needed.',
        [{ text: 'OK' }]
      );

      setIsFetchingLocation(false);
    } catch (error) {
      setIsFetchingLocation(false);
      console.error('❌ Location error:', error);

      Alert.alert(
        'Location Error',
        'Failed to get your current location. Please enter your address manually.',
        [{ text: 'OK' }]
      );
    }
  }

  async function handleNext() {
    if (step === 1) {
      if (!name.trim()) {
        Alert.alert('Error', 'Please enter your name');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (selectedInterests.length === 0) {
        Alert.alert('Error', 'Please select at least one interest');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      await completeOnboarding();
    }
  }

  function handleBack() {
    if (step > 1) {
      setStep(step - 1);
    }
  }

  async function completeOnboarding() {
    if (!homeAddress.trim()) {
      Alert.alert('Error', 'Please enter your home address');
      return;
    }

    setIsLoading(true);

    try {
      // Geocode home address (required)
      console.log('🗺️ Geocoding home address...');
      const homeResult = await geocodeAddress(homeAddress.trim());

      // Geocode work address (optional)
      let workResult = null;
      if (workAddress.trim()) {
        console.log('🗺️ Geocoding work address...');
        try {
          workResult = await geocodeAddress(workAddress.trim());
        } catch (error) {
          console.error('⚠️ Work address geocoding failed, continuing without it:', error);
          Alert.alert(
            'Invalid Work Address',
            'We couldn\'t find your work address. You can add it later in settings.',
            [{ text: 'OK' }]
          );
        }
      }

      // Convert to PostGIS format: { type: 'Point', coordinates: [lng, lat] }
      const homeLocation = {
        type: 'Point',
        coordinates: [homeResult.longitude, homeResult.latitude]
      };

      const workLocation = workResult ? {
        type: 'Point',
        coordinates: [workResult.longitude, workResult.latitude]
      } : null;

      console.log('✅ Addresses geocoded successfully');
      console.log(`📍 Home: ${homeResult.formattedAddress} (${homeResult.latitude}, ${homeResult.longitude})`);
      if (workResult) {
        console.log(`📍 Work: ${workResult.formattedAddress} (${workResult.latitude}, ${workResult.longitude})`);
      }

      const { error } = await updateUserProfile({
        name: name.trim(),
        interests: selectedInterests,
        home_address: homeResult.formattedAddress,
        home_location: homeLocation as any, // PostGIS geography type
        work_address: workResult?.formattedAddress || null,
        work_location: workLocation as any, // PostGIS geography type
        preferences: {
          budget: 50,
          max_distance_miles: 10,
          preferred_times: ['evening', 'weekend'],
          notification_enabled: true,
        },
        privacy_settings: {
          share_loop_with: 'friends',
          discoverable: true,
          share_location: true,
          group_invite_settings: {
            who_can_invite: 'friends',
            require_mutual_friends: false,
            blocked_from_invites: [],
            auto_decline_from_strangers: false,
            notification_preferences: {
              group_invites: true,
              new_friend_in_group: true,
            },
          },
        },
      });

      setIsLoading(false);

      if (error) {
        Alert.alert('Error', 'Failed to complete profile setup. Please try again.');
      } else {
        // Process referral code if provided
        if (params.referralCode && session?.user?.id) {
          try {
            const referralResult = await processReferralCode(
              session.user.id,
              params.referralCode,
              'link'
            );

            if (referralResult.success) {
              // Complete the referral to grant rewards
              await completeReferral(session.user.id);

              // Show success message
              Alert.alert(
                '🎉 Welcome Bonus!',
                'You received 7 days of Loop Plus free!\n\nYour friend also earned rewards for inviting you.',
                [{ text: 'Awesome!' }]
              );
            }
          } catch (error) {
            console.error('Error processing referral:', error);
            // Don't block onboarding if referral fails
          }
        }

        console.log('✅ Onboarding complete, navigating to app...');
        // Navigate to main app
        router.replace('/(tabs)');
      }
    } catch (error) {
      setIsLoading(false);
      console.error('❌ Onboarding error:', error);

      // Provide helpful error message based on error type
      if (error instanceof Error) {
        if (error.message.includes('No results found')) {
          Alert.alert(
            'Invalid Address',
            'We couldn\'t find that address. Please check and try again.',
            [{ text: 'OK' }]
          );
        } else if (error.message.includes('Geocoding request denied')) {
          Alert.alert(
            'Configuration Error',
            'There\'s an issue with our geocoding service. Please contact support.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Error',
            'An error occurred while setting up your profile. Please try again.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      }
    }
  }

  function renderProgressBar() {
    return (
      <View style={styles.progressContainer}>
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              {
                backgroundColor: s <= step ? colors.tint : colors.icon,
              },
            ]}
          />
        ))}
      </View>
    );
  }

  function renderStep1() {
    return (
      <View style={styles.stepContainer}>
        <ThemedText style={styles.title}>What's your name?</ThemedText>
        <ThemedText style={styles.subtitle}>
          Help us personalize your Loop experience
        </ThemedText>

        <TextInput
          style={[styles.input, { borderColor: colors.icon, color: colors.text }]}
          placeholder="Enter your full name"
          placeholderTextColor={colors.icon}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          editable={!isLoading}
        />
      </View>
    );
  }

  function renderStep2() {
    return (
      <View style={styles.stepContainer}>
        <ThemedText style={styles.title}>What are you interested in?</ThemedText>
        <ThemedText style={styles.subtitle}>
          Select up to 10 interests (min 1 required)
        </ThemedText>

        <ScrollView
          style={styles.interestsScrollContainer}
          contentContainerStyle={styles.interestsContainer}
          showsVerticalScrollIndicator={false}
        >
          {INTEREST_OPTIONS.map((interest) => {
            const isSelected = selectedInterests.includes(interest);
            return (
              <TouchableOpacity
                key={interest}
                style={[
                  styles.interestChip,
                  {
                    backgroundColor: isSelected ? colors.tint : 'transparent',
                    borderColor: isSelected ? colors.tint : colors.icon,
                  },
                ]}
                onPress={() => toggleInterest(interest)}
                disabled={isLoading}
              >
                <Text
                  style={[
                    styles.interestText,
                    { color: isSelected ? '#fff' : colors.text },
                  ]}
                >
                  {interest}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ThemedText style={styles.interestCounter}>
          {selectedInterests.length} / 10 selected
        </ThemedText>
      </View>
    );
  }

  function renderStep3() {
    return (
      <View style={styles.stepContainer}>
        <ThemedText style={styles.title}>Where are you based?</ThemedText>
        <ThemedText style={styles.subtitle}>
          We'll use this to find activities near you
        </ThemedText>

        <View style={styles.form}>
          {/* Use Current Location Button */}
          <TouchableOpacity
            style={[
              styles.locationButton,
              {
                backgroundColor: colors.tint + '15',
                borderColor: colors.tint,
              },
            ]}
            onPress={useCurrentLocation}
            disabled={isLoading || isFetchingLocation}
          >
            {isFetchingLocation ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <Text style={[styles.locationButtonText, { color: colors.tint }]}>
                📍 Use Current Location
              </Text>
            )}
          </TouchableOpacity>

          <ThemedText style={styles.dividerText}>or enter manually</ThemedText>

          <ThemedText style={styles.label}>Home Address *</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: colors.icon, color: colors.text }]}
            placeholder="123 Main St, City, State ZIP"
            placeholderTextColor={colors.icon}
            value={homeAddress}
            onChangeText={setHomeAddress}
            autoCapitalize="words"
            editable={!isLoading && !isFetchingLocation}
          />

          <ThemedText style={styles.label}>Work Address (Optional)</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: colors.icon, color: colors.text }]}
            placeholder="456 Office Blvd, City, State ZIP"
            placeholderTextColor={colors.icon}
            value={workAddress}
            onChangeText={setWorkAddress}
            autoCapitalize="words"
            editable={!isLoading && !isFetchingLocation}
          />

          <ThemedText style={styles.helperText}>
            We'll use your work address to suggest activities along your commute
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ThemedView style={styles.container}>
        {renderProgressBar()}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </ScrollView>

        <View style={styles.buttonContainer}>
          {step > 1 && (
            <TouchableOpacity
              style={[styles.backButton, { borderColor: colors.icon }]}
              onPress={handleBack}
              disabled={isLoading}
            >
              <ThemedText style={styles.backButtonText}>Back</ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: colors.tint, flex: step > 1 ? 1 : undefined },
            ]}
            onPress={handleNext}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextButtonText}>
                {step === 3 ? 'Get Started' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepContainer: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    opacity: 0.7,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  interestsScrollContainer: {
    flex: 1,
    marginBottom: 16,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  interestChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
  },
  interestText: {
    fontSize: 14,
    fontWeight: '500',
  },
  interestCounter: {
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 16,
  },
  form: {
    gap: 8,
  },
  locationButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerText: {
    textAlign: 'center',
    fontSize: 13,
    opacity: 0.5,
    marginBottom: 16,
    marginTop: -8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
  },
  backButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 120,
    paddingHorizontal: 32,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
