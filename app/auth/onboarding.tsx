import React, { useState, useEffect, useRef } from 'react';
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
  Switch,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { processReferralCode } from '@/services/referral-service';
import { geocodeAddress, reverseGeocode } from '@/services/geocoding';
import * as Location from 'expo-location';
import { requestCalendarPermissions } from '@/services/calendar-service';
import { requestNotificationPermissions } from '@/services/notification-service';
import { INTEREST_GROUPS } from '@/constants/activity-categories';
import { LoopLogoVariant } from '@/components/loop-logo-variant';
import { OnboardingLoopAnimation } from '@/components/onboarding-loop-animation';
import { GROK_SPRING } from '@/constants/animations';

// 12 quick interests for the picker
const QUICK_INTERESTS = [
  'Dining', 'Coffee & Cafes', 'Bars & Nightlife', 'Live Music',
  'Entertainment', 'Fitness', 'Outdoor Activities', 'Arts & Culture',
  'Shopping', 'Sports', 'Movies', 'Wellness',
];

export default function OnboardingScreen() {
  const { session, updateUserProfile, updateBusinessProfile } = useAuth();
  const colorScheme = useColorScheme();
  const params = useLocalSearchParams<{ referralCode?: string; accountType?: string }>();
  const accountType = (params.accountType === 'business' ? 'business' : 'personal') as 'personal' | 'business';
  const isBusiness = accountType === 'business';
  const isDark = colorScheme === 'dark';

  // Always-dark theme for personal flow; theme-aware for business
  const theme = isBusiness ? {
    bg: isDark ? '#000000' : '#ffffff',
    text: isDark ? '#ffffff' : '#000000',
    textMuted: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
    textSubtle: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
    border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    borderSubtle: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    card: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    accent: '#10a37f',
    accentMuted: isDark ? 'rgba(16,163,127,0.15)' : 'rgba(16,163,127,0.1)',
    success: '#10a37f',
  } : {
    bg: '#000000',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.50)',
    textSubtle: 'rgba(255,255,255,0.25)',
    border: 'rgba(255,255,255,0.12)',
    borderSubtle: 'rgba(255,255,255,0.06)',
    card: 'rgba(255,255,255,0.04)',
    accent: '#10a37f',
    accentMuted: 'rgba(16,163,127,0.12)',
    success: '#10a37f',
  };

  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Personal flow state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [smartLearning, setSmartLearning] = useState(true);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [locationGranted, setLocationGranted] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [homeAddress, setHomeAddress] = useState('');
  const [workAddress, setWorkAddress] = useState('');
  const [showAddressFields, setShowAddressFields] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isRequestingNotifications, setIsRequestingNotifications] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [interestError, setInterestError] = useState(false);
  const [birthYear, setBirthYear] = useState<number | null>(null);

  // Business flow state
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessWebsite, setBusinessWebsite] = useState('');
  const [businessTier, setBusinessTier] = useState<'organic' | 'boosted' | 'premium'>('organic');

  // Refs
  const firstNameRef = useRef<TextInput>(null);

  // Animation values
  const nameShakeX = useSharedValue(0);
  const [meterWidth, setMeterWidth] = useState(0);
  const meterFill = useSharedValue(0);

  const nameShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nameShakeX.value }],
  }));

  const meterFillStyle = useAnimatedStyle(() => ({
    width: meterFill.value,
  }));

  // Google user detection
  const isGoogleUser = session?.user?.app_metadata?.provider === 'google'
    || session?.user?.identities?.some(i => i.provider === 'google');

  // Pre-fill from Google profile
  useEffect(() => {
    if (session?.user?.user_metadata) {
      const meta = session.user.user_metadata;
      if (meta.full_name) {
        const parts = meta.full_name.split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
      } else if (meta.name) {
        const parts = meta.name.split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
      }
    }
    if (isGoogleUser) {
      setCalendarConnected(true);
    }
  }, [session]);

  // Readiness calculation
  function getReadinessPercent(): number {
    let pct = 0;
    if (calendarConnected) pct += 30;
    if (locationGranted || homeAddress.trim()) pct += 25;
    if (selectedInterests.length >= 3) pct += 30;
    else if (selectedInterests.length > 0) pct += selectedInterests.length * 10;
    if (notificationsEnabled) pct += 15;
    return Math.min(pct, 100);
  }

  // Animate readiness meter
  useEffect(() => {
    if (meterWidth > 0) {
      const target = (getReadinessPercent() / 100) * meterWidth;
      meterFill.value = withSpring(target, GROK_SPRING);
    }
  }, [calendarConnected, locationGranted, homeAddress, selectedInterests.length, notificationsEnabled, meterWidth]);

  // Auto-focus first name on step 1
  useEffect(() => {
    if (!isBusiness && step === 1) {
      setTimeout(() => firstNameRef.current?.focus(), 300);
    }
  }, [step, isBusiness]);

  const PERSONAL_TOTAL = 4; // last step index (5 steps: 0-4)
  const BUSINESS_TOTAL = 5; // last step index (6 steps: 0-5)
  const TOTAL_STEPS = isBusiness ? BUSINESS_TOTAL : PERSONAL_TOTAL;

  // ============================================================================
  // HANDLERS
  // ============================================================================

  function toggleInterest(interest: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else if (selectedInterests.length < 10) {
      setSelectedInterests([...selectedInterests, interest]);
    }
  }

  async function handleUseLocation() {
    setIsFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'You can add your location manually below.');
        setIsFetchingLocation(false);
        return;
      }

      setLocationGranted(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const result = await reverseGeocode(
        location.coords.latitude,
        location.coords.longitude
      );
      setHomeAddress(result.formattedAddress);
      setShowAddressFields(true);
      setIsFetchingLocation(false);
    } catch (error) {
      setIsFetchingLocation(false);
      console.error('Location error:', error);
      Alert.alert('Location Error', 'Could not get location. You can enter it manually.');
    }
  }

  async function handleConnectCalendar() {
    setIsSyncingCalendar(true);
    try {
      const result = await requestCalendarPermissions();
      if (result.granted) {
        setCalendarConnected(true);
      }
    } catch (error) {
      console.error('Calendar error:', error);
    } finally {
      setIsSyncingCalendar(false);
    }
  }

  async function handleEnableNotifications() {
    setIsRequestingNotifications(true);
    try {
      const granted = await requestNotificationPermissions();
      setNotificationsEnabled(granted);
    } catch (error) {
      console.error('Notification error:', error);
    } finally {
      setIsRequestingNotifications(false);
    }
  }

  function handleNext() {
    if (isBusiness) {
      handleBusinessNext();
      return;
    }

    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      if (!firstName.trim()) {
        nameShakeX.value = withSequence(
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 50 }),
          withTiming(-8, { duration: 50 }),
          withTiming(0, { duration: 50 }),
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (selectedInterests.length === 0) {
        setInterestError(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setTimeout(() => setInterestError(false), 1500);
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      completeOnboarding();
    }
  }

  function handleBusinessNext() {
    if (step === 0) {
      if (!firstName.trim() || !businessName.trim()) {
        Alert.alert('Error', 'Please enter your name and business name');
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (!businessCategory.trim()) {
        Alert.alert('Error', 'Please select a business category');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!homeAddress.trim()) {
        Alert.alert('Error', 'Please enter your business address');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      // Phone & website — optional, always advance
      setStep(4);
    } else if (step === 4) {
      // Tier selection — always advance (defaults to organic)
      setStep(5);
    } else if (step === 5) {
      completeOnboarding();
    }
  }

  function handleSkip() {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  }

  async function completeOnboarding() {
    setIsLoading(true);
    try {
      let homeLocation = null;
      let formattedHomeAddress = homeAddress.trim() || null;

      if (homeAddress.trim()) {
        try {
          const homeResult = await geocodeAddress(homeAddress.trim());
          homeLocation = `POINT(${homeResult.longitude} ${homeResult.latitude})`;
          formattedHomeAddress = homeResult.formattedAddress;
        } catch (error) {
          console.warn('Home geocode failed:', error);
        }
      }

      let workLocation = null;
      let formattedWorkAddress = workAddress.trim() || null;

      if (workAddress.trim()) {
        try {
          const workResult = await geocodeAddress(workAddress.trim());
          workLocation = `POINT(${workResult.longitude} ${workResult.latitude})`;
          formattedWorkAddress = workResult.formattedAddress;
        } catch (error) {
          console.warn('Work geocode failed:', error);
        }
      }

      const userName = isBusiness
        ? firstName.trim()
        : `${firstName.trim()} ${lastName.trim()}`.trim();

      // Compute age bracket from birth year
      const currentYear = new Date().getFullYear();
      let ageBracket: string | null = null;
      if (birthYear && birthYear >= currentYear - 80 && birthYear <= currentYear - 16) {
        const age = currentYear - birthYear;
        if (age <= 24) ageBracket = '18-24';
        else if (age <= 34) ageBracket = '25-34';
        else if (age <= 44) ageBracket = '35-44';
        else ageBracket = '45+';
      }

      const { error } = await updateUserProfile({
        name: userName,
        interests: isBusiness ? [businessCategory.toLowerCase()] : selectedInterests,
        home_address: formattedHomeAddress,
        home_location: homeLocation as any,
        work_address: formattedWorkAddress,
        work_location: workLocation as any,
        account_type: accountType,
        ...(birthYear ? { birth_year: birthYear } : {}),
        ...(ageBracket ? { age_bracket: ageBracket } : {}),
        // Reverse trial: all new users start with 7-day Plus trial
        subscription_tier: 'plus',
        subscription_status: 'trialing',
        subscription_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        preferences: {
          budget: 50,
          max_distance_miles: 10,
          preferred_times: ['evening', 'weekend'],
          notification_enabled: notificationsEnabled,
          smart_learning: smartLearning,
        },
        privacy_settings: {
          share_loop_with: 'friends',
          discoverable: true,
          share_location: locationGranted,
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

      if (!error && isBusiness) {
        const trialEnd = businessTier !== 'organic'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null;
        await updateBusinessProfile({
          business_name: businessName.trim(),
          business_category: businessCategory,
          business_description: businessDescription.trim() || null,
          business_phone: businessPhone.trim() || null,
          business_website: businessWebsite.trim() || null,
          subscription_tier: businessTier,
          subscription_status: businessTier !== 'organic' ? 'trialing' : 'active',
          trial_ends_at: trialEnd,
          address: formattedHomeAddress,
          location: homeLocation as any,
        } as any);
      }

      if (error) {
        setIsLoading(false);
        Alert.alert('Error', `Failed to complete setup: ${error.message}`);
        return;
      }

      if (params.referralCode && session?.user?.id) {
        try {
          const referralResult = await processReferralCode(
            session.user.id,
            params.referralCode,
            'link'
          );
          if (referralResult.success) {
            Alert.alert(
              'Welcome Bonus!',
              'You received 7 days of Loop Plus free!',
              [{ text: 'Awesome!' }]
            );
          }
        } catch (error) {
          console.error('Referral error:', error);
        }
      }

      setIsLoading(false);
      router.replace('/(tabs)');
    } catch (error) {
      setIsLoading(false);
      console.error('Onboarding error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  }

  // ============================================================================
  // PERSONAL FLOW — Grok-style conversational UI
  // ============================================================================

  function getButtonText(): string {
    if (isBusiness) return step === BUSINESS_TOTAL ? 'Get started' : 'Continue';
    if (step === 0) return "let's go";
    if (step === PERSONAL_TOTAL) return 'get started';
    return 'continue';
  }

  function renderPersonalStep0() {
    return (
      <View style={styles.stepInner}>
        <View style={styles.welcomeTop}>
          <LoopLogoVariant size={32} style={{ alignSelf: 'center' }} />
          <Text style={[styles.convoTitle, { color: theme.text }]}>
            welcome to loop
          </Text>
          <Text style={[styles.convoSub, { color: theme.textMuted, textAlign: 'center', marginBottom: 0 }]}>
            loop learns what you love and finds things{'\n'}worth your time. the more it knows, the{'\n'}better it gets.
          </Text>
        </View>

        {/* Smart learning toggle */}
        <View style={[styles.toggleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.toggleLeft}>
            <Ionicons name="sparkles-outline" size={18} color={theme.accent} />
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleLabel, { color: theme.text }]}>smart learning</Text>
              <Text style={[styles.toggleDesc, { color: theme.textSubtle }]}>
                improve suggestions from your activity
              </Text>
            </View>
          </View>
          <Switch
            value={smartLearning}
            onValueChange={setSmartLearning}
            trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(16,163,127,0.4)' }}
            thumbColor={smartLearning ? '#10a37f' : '#555'}
          />
        </View>

        {/* Calendar status */}
        <View style={[styles.toggleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.toggleLeft}>
            <Ionicons
              name={calendarConnected ? 'checkmark-circle' : 'calendar-outline'}
              size={18}
              color={calendarConnected ? theme.success : theme.textMuted}
            />
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleLabel, { color: theme.text }]}>
                {calendarConnected ? 'calendar connected' : 'google calendar'}
              </Text>
              <Text style={[styles.toggleDesc, { color: theme.textSubtle }]}>
                {calendarConnected
                  ? "we'll learn your schedule"
                  : 'import your schedule for better suggestions'}
              </Text>
            </View>
          </View>
          {!calendarConnected && (
            <TouchableOpacity
              onPress={handleConnectCalendar}
              disabled={isSyncingCalendar}
              style={[styles.connectBtn, { borderColor: theme.border }]}
            >
              {isSyncingCalendar ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : (
                <Text style={[styles.connectBtnText, { color: theme.accent }]}>connect</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.tagline, { color: theme.textSubtle }]}>
          discover better, together.
        </Text>
      </View>
    );
  }

  function renderPersonalStep1() {
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 80;
    const maxYear = currentYear - 16;

    return (
      <View style={styles.stepInner}>
        <Text style={[styles.convoTitle, { color: theme.text }]}>
          what should we call you?
        </Text>

        <Animated.View style={[styles.inputGroup, nameShakeStyle]}>
          <View style={styles.underlineField}>
            <TextInput
              ref={firstNameRef}
              style={[styles.underlineInput, { color: theme.text, borderBottomColor: theme.border }]}
              placeholder="first name"
              placeholderTextColor={theme.textSubtle}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              editable={!isLoading}
            />
            {isGoogleUser && firstName ? (
              <Text style={[styles.hintText, { color: theme.textSubtle }]}>(from google)</Text>
            ) : null}
          </View>
          <View style={styles.underlineField}>
            <TextInput
              style={[styles.underlineInput, { color: theme.text, borderBottomColor: theme.border }]}
              placeholder="last name"
              placeholderTextColor={theme.textSubtle}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              editable={!isLoading}
            />
            {isGoogleUser && lastName ? (
              <Text style={[styles.hintText, { color: theme.textSubtle }]}>(from google)</Text>
            ) : null}
          </View>
          <View style={styles.underlineField}>
            <TextInput
              style={[styles.underlineInput, { color: theme.text, borderBottomColor: theme.border }]}
              placeholder="birth year (optional)"
              placeholderTextColor={theme.textSubtle}
              value={birthYear ? String(birthYear) : ''}
              onChangeText={(text) => {
                const num = parseInt(text, 10);
                if (text === '') {
                  setBirthYear(null);
                } else if (!isNaN(num) && text.length <= 4) {
                  setBirthYear(num);
                }
              }}
              keyboardType="number-pad"
              maxLength={4}
              editable={!isLoading}
            />
            <Text style={[styles.hintText, { color: theme.textSubtle }]}>
              helps personalize your experience
            </Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  function renderPersonalStep2() {
    const countText = selectedInterests.length >= 3
      ? `${selectedInterests.length} selected \u2014 nice picks`
      : `${selectedInterests.length} selected`;

    return (
      <View style={styles.stepInner}>
        <Text style={[styles.convoTitle, { color: theme.text }]}>
          what gets you excited?
        </Text>
        <Text style={[styles.convoSub, {
          color: interestError ? '#ff4444' : theme.textMuted,
        }]}>
          {interestError ? 'pick at least one to continue' : "pick a few \u2014 we'll refine as you use loop"}
        </Text>

        <View style={styles.chipsGrid}>
          {QUICK_INTERESTS.map((interest, index) => {
            const isSelected = selectedInterests.includes(interest);
            const group = INTEREST_GROUPS[interest];
            return (
              <Animated.View
                key={interest}
                entering={FadeIn.delay(index * 30).duration(200)}
              >
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? theme.accent : 'transparent',
                      borderColor: isSelected ? theme.accent : theme.border,
                    },
                  ]}
                  onPress={() => toggleInterest(interest)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipIcon}>{group?.icon}</Text>
                  <Text style={[styles.chipLabel, { color: isSelected ? '#fff' : theme.text }]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        <Text style={[styles.chipCount, { color: theme.textSubtle }]}>
          {countText}
        </Text>
      </View>
    );
  }

  function renderPersonalStep3() {
    return (
      <View style={styles.stepInner}>
        <Text style={[styles.convoTitle, { color: theme.text }]}>
          where are you based?
        </Text>

        <TouchableOpacity
          style={[styles.permissionPill, {
            borderColor: locationGranted ? theme.success : theme.border,
            backgroundColor: locationGranted ? theme.accentMuted : 'transparent',
          }]}
          onPress={handleUseLocation}
          disabled={isFetchingLocation || locationGranted}
          activeOpacity={0.6}
        >
          {isFetchingLocation ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <View style={styles.pillInner}>
              <Ionicons
                name={locationGranted ? 'checkmark-circle' : 'location-outline'}
                size={20}
                color={locationGranted ? theme.success : theme.textMuted}
              />
              <Text style={[styles.pillText, {
                color: locationGranted ? theme.success : theme.text,
              }]}>
                {locationGranted ? 'location enabled' : 'enable location'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {!showAddressFields && !locationGranted && (
          <TouchableOpacity
            onPress={() => setShowAddressFields(true)}
            style={styles.orLink}
          >
            <Text style={[styles.orLinkText, { color: theme.textMuted }]}>
              or enter your address
            </Text>
          </TouchableOpacity>
        )}

        {(showAddressFields || locationGranted) && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.inputGroup}>
            <TextInput
              style={[styles.underlineInput, { color: theme.text, borderBottomColor: theme.border }]}
              placeholder="home address"
              placeholderTextColor={theme.textSubtle}
              value={homeAddress}
              onChangeText={setHomeAddress}
              editable={!isLoading}
            />
            <TextInput
              style={[styles.underlineInput, { color: theme.text, borderBottomColor: theme.border }]}
              placeholder="work address (optional)"
              placeholderTextColor={theme.textSubtle}
              value={workAddress}
              onChangeText={setWorkAddress}
              editable={!isLoading}
            />
            <Text style={[styles.helperText, { color: theme.textSubtle }]}>
              used for commute suggestions
            </Text>
          </Animated.View>
        )}
      </View>
    );
  }

  function renderPersonalStep4() {
    const readiness = getReadinessPercent();
    const checks = [
      { label: 'calendar', done: calendarConnected },
      { label: 'interests', done: selectedInterests.length >= 1 },
      { label: 'location', done: locationGranted || !!homeAddress.trim() },
      { label: 'notifications', done: notificationsEnabled },
    ];

    return (
      <View style={[styles.stepInner, styles.centeredStep]}>
        <Text style={[styles.convoTitle, { color: theme.text, textAlign: 'center' }]}>
          one last thing
        </Text>

        <TouchableOpacity
          style={[styles.permissionPill, {
            borderColor: notificationsEnabled ? theme.success : theme.border,
            backgroundColor: notificationsEnabled ? theme.accentMuted : 'transparent',
          }]}
          onPress={handleEnableNotifications}
          disabled={isRequestingNotifications || notificationsEnabled}
          activeOpacity={0.6}
        >
          {isRequestingNotifications ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <View style={styles.pillInner}>
              <Ionicons
                name={notificationsEnabled ? 'checkmark-circle' : 'notifications-outline'}
                size={20}
                color={notificationsEnabled ? theme.success : theme.textMuted}
              />
              <Text style={[styles.pillText, {
                color: notificationsEnabled ? theme.success : theme.text,
              }]}>
                {notificationsEnabled ? 'notifications enabled' : 'enable notifications'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Readiness summary card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.summaryMeterRow}>
            <Text style={[styles.summaryPercent, { color: theme.accent }]}>{readiness}%</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSubtle }]}>ready</Text>
          </View>
          <View style={[styles.summaryTrack, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <View style={[styles.summaryFill, { backgroundColor: theme.accent, width: `${readiness}%` }]} />
          </View>
          <View style={styles.checklistContainer}>
            {checks.map((item) => (
              <View key={item.label} style={styles.checkRow}>
                <Ionicons
                  name={item.done ? 'checkmark-circle' : 'remove-outline'}
                  size={16}
                  color={item.done ? theme.success : theme.textSubtle}
                />
                <Text style={[styles.checkLabel, {
                  color: item.done ? theme.text : theme.textSubtle,
                }]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[styles.helperText, { color: theme.textSubtle, textAlign: 'center', marginTop: 16 }]}>
          you can change any of this in settings
        </Text>
      </View>
    );
  }

  // ============================================================================
  // BUSINESS FLOW (unchanged — conventional theme-aware UI)
  // ============================================================================

  const BUSINESS_CATEGORIES = [
    'Restaurant', 'Cafe', 'Bar', 'Brewery', 'Gym', 'Yoga Studio',
    'Spa', 'Salon', 'Retail', 'Entertainment', 'Gallery', 'Museum',
    'Park', 'Outdoor Recreation', 'Event Venue', 'Other',
  ];

  function renderBusinessStep0() {
    return (
      <View style={styles.bizStepContent}>
        <Text style={[styles.bizStepTitle, { color: theme.text }]}>
          Tell us about your business
        </Text>
        <Text style={[styles.bizStepSubtitle, { color: theme.textMuted }]}>
          Reach users actively looking for things to do near them
        </Text>

        <View style={styles.bizNameSection}>
          <TextInput
            style={[styles.bizInput, { borderColor: theme.border, color: theme.text }]}
            placeholder="Business name"
            placeholderTextColor={theme.textSubtle}
            value={businessName}
            onChangeText={setBusinessName}
            autoCapitalize="words"
            editable={!isLoading}
          />
          <TextInput
            style={[styles.bizInput, { borderColor: theme.border, color: theme.text }]}
            placeholder="Your name (contact)"
            placeholderTextColor={theme.textSubtle}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            editable={!isLoading}
          />
        </View>
      </View>
    );
  }

  function renderBusinessStep1() {
    return (
      <View style={styles.bizStepContent}>
        <Text style={[styles.bizStepTitle, { color: theme.text }]}>
          Business category
        </Text>
        <Text style={[styles.bizStepSubtitle, { color: theme.textMuted }]}>
          How would you describe your business?
        </Text>

        <View style={styles.bizInterestsGrid}>
          {BUSINESS_CATEGORIES.map((cat) => {
            const isSelected = businessCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.bizInterestChip,
                  {
                    backgroundColor: isSelected ? theme.accent : 'transparent',
                    borderColor: isSelected ? theme.accent : theme.border,
                  },
                ]}
                onPress={() => setBusinessCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.bizInterestLabel,
                  { color: isSelected ? '#fff' : theme.text },
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={[styles.bizInput, styles.bizTextArea, {
            borderColor: theme.border,
            color: theme.text,
            marginTop: 16,
          }]}
          placeholder="Describe your business (optional)"
          placeholderTextColor={theme.textSubtle}
          value={businessDescription}
          onChangeText={setBusinessDescription}
          multiline
          editable={!isLoading}
        />
      </View>
    );
  }

  function renderBusinessStep2() {
    return (
      <View style={styles.bizStepContent}>
        <Text style={[styles.bizStepTitle, { color: theme.text }]}>
          Business location
        </Text>
        <Text style={[styles.bizStepSubtitle, { color: theme.textMuted }]}>
          Where can customers find you?
        </Text>

        <TouchableOpacity
          style={[styles.bizLocationButton, {
            borderColor: locationGranted ? theme.success : theme.border,
            backgroundColor: locationGranted ? theme.accentMuted : 'transparent',
          }]}
          onPress={handleUseLocation}
          disabled={isFetchingLocation || locationGranted}
          activeOpacity={0.6}
        >
          {isFetchingLocation ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <View style={styles.bizButtonInner}>
              <Ionicons
                name={locationGranted ? 'checkmark-circle' : 'location-outline'}
                size={18}
                color={locationGranted ? theme.success : theme.textMuted}
              />
              <Text style={[styles.bizLocationButtonText, {
                color: locationGranted ? theme.success : theme.text,
              }]}>
                {locationGranted ? 'Location detected' : 'Use current location'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={[styles.bizDividerRow, { marginVertical: 16 }]}>
          <View style={[styles.bizDividerLine, { backgroundColor: theme.borderSubtle }]} />
          <Text style={[styles.bizDividerText, { color: theme.textSubtle }]}>or</Text>
          <View style={[styles.bizDividerLine, { backgroundColor: theme.borderSubtle }]} />
        </View>

        <TextInput
          style={[styles.bizInput, { borderColor: theme.border, color: theme.text }]}
          placeholder="Business address"
          placeholderTextColor={theme.textSubtle}
          value={homeAddress}
          onChangeText={setHomeAddress}
          editable={!isLoading && !isFetchingLocation}
        />
      </View>
    );
  }

  function renderBusinessStep3() {
    return (
      <View style={styles.bizStepContent}>
        <Text style={[styles.bizStepTitle, { color: theme.text }]}>
          Contact details
        </Text>
        <Text style={[styles.bizStepSubtitle, { color: theme.textMuted }]}>
          Optional — helps customers reach you
        </Text>

        <View style={styles.bizNameSection}>
          <TextInput
            style={[styles.bizInput, { borderColor: theme.border, color: theme.text }]}
            placeholder="Phone number (optional)"
            placeholderTextColor={theme.textSubtle}
            value={businessPhone}
            onChangeText={setBusinessPhone}
            keyboardType="phone-pad"
            editable={!isLoading}
          />
          <TextInput
            style={[styles.bizInput, { borderColor: theme.border, color: theme.text }]}
            placeholder="Website URL (optional)"
            placeholderTextColor={theme.textSubtle}
            value={businessWebsite}
            onChangeText={setBusinessWebsite}
            keyboardType="url"
            autoCapitalize="none"
            editable={!isLoading}
          />
        </View>
      </View>
    );
  }

  const TIER_OPTIONS: { tier: 'organic' | 'boosted' | 'premium'; name: string; price: string; features: string[] }[] = [
    {
      tier: 'organic',
      name: 'Organic',
      price: 'Free',
      features: ['Listed in database', 'Appears when best match', 'No algorithmic boost'],
    },
    {
      tier: 'boosted',
      name: 'Boosted',
      price: '$49/mo',
      features: ['+15% algorithm boost', '"Sponsored" label', 'Basic analytics', '30-day free trial'],
    },
    {
      tier: 'premium',
      name: 'Premium',
      price: '$149/mo',
      features: ['+30% algorithm boost', 'Top placement', 'Full analytics dashboard', '30-day free trial'],
    },
  ];

  function renderBusinessStep4() {
    return (
      <View style={styles.bizStepContent}>
        <Text style={[styles.bizStepTitle, { color: theme.text }]}>
          Choose your plan
        </Text>
        <Text style={[styles.bizStepSubtitle, { color: theme.textMuted }]}>
          Boost your visibility to nearby Loop users
        </Text>

        <View style={styles.bizTierList}>
          {TIER_OPTIONS.map((option) => {
            const isSelected = businessTier === option.tier;
            return (
              <TouchableOpacity
                key={option.tier}
                style={[
                  styles.bizTierCard,
                  {
                    borderColor: isSelected ? theme.accent : theme.border,
                    backgroundColor: isSelected ? theme.accentMuted : 'transparent',
                  },
                ]}
                onPress={() => {
                  setBusinessTier(option.tier);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.bizTierHeader}>
                  <Text style={[styles.bizTierName, { color: isSelected ? theme.accent : theme.text }]}>
                    {option.name}
                  </Text>
                  <Text style={[styles.bizTierPrice, { color: isSelected ? theme.accent : theme.textMuted }]}>
                    {option.price}
                  </Text>
                </View>
                {option.features.map((feat, i) => (
                  <Text key={i} style={[styles.bizTierFeature, { color: theme.textMuted }]}>
                    {feat}
                  </Text>
                ))}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  function renderBusinessStep5() {
    const tierLabel = businessTier === 'organic' ? '' : ` (${businessTier === 'boosted' ? 'Boosted' : 'Premium'} — 30-day trial)`;
    return (
      <View style={[styles.bizStepContent, styles.centeredStep]}>
        <Text style={[styles.bizStepTitle, { color: theme.text, textAlign: 'center' }]}>
          You&apos;re all set{tierLabel ? '!' : ''}
        </Text>
        {tierLabel ? (
          <View style={[styles.bizTierBadge, { backgroundColor: theme.accent }]}>
            <Text style={styles.bizTierBadgeText}>{businessTier === 'boosted' ? 'Boosted' : 'Premium'} Trial</Text>
          </View>
        ) : null}
        <Text style={[styles.bizStepSubtitle, { color: theme.textMuted, textAlign: 'center' }]}>
          Your business will appear in Loop recommendations{'\n'}for nearby users{tierLabel}
        </Text>
      </View>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  function renderCurrentStep() {
    if (isBusiness) {
      switch (step) {
        case 0: return renderBusinessStep0();
        case 1: return renderBusinessStep1();
        case 2: return renderBusinessStep2();
        case 3: return renderBusinessStep3();
        case 4: return renderBusinessStep4();
        case 5: return renderBusinessStep5();
      }
    } else {
      switch (step) {
        case 0: return renderPersonalStep0();
        case 1: return renderPersonalStep1();
        case 2: return renderPersonalStep2();
        case 3: return renderPersonalStep3();
        case 4: return renderPersonalStep4();
      }
    }
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {!isBusiness && <StatusBar style="light" />}

      {/* Background loop animation — personal flow only */}
      {!isBusiness && (
        <View style={styles.loopAnimationWrap}>
          <OnboardingLoopAnimation
            currentStep={step}
            size={280}
            onComplete={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}
          />
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Readiness meter bar — personal flow only */}
        {!isBusiness && (
          <View style={[styles.meterContainer, { paddingTop: Platform.OS === 'android' ? 48 : 56 }]}>
            <View
              style={[styles.meterTrack, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              onLayout={(e) => setMeterWidth(e.nativeEvent.layout.width)}
            >
              <Animated.View style={[styles.meterFill, { backgroundColor: theme.accent }, meterFillStyle]} />
            </View>
          </View>
        )}

        {/* Business progress bar (unchanged) */}
        {isBusiness && (
          <View style={[styles.progressContainer, { paddingTop: Platform.OS === 'android' ? 50 : 60 }]}>
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <View
                style={[styles.progressFill, {
                  backgroundColor: theme.accent,
                  width: `${((step + 1) / (TOTAL_STEPS + 1)) * 100}%`,
                }]}
              />
            </View>
            <Text style={[styles.stepIndicator, { color: theme.textSubtle }]}>
              {step + 1} of {TOTAL_STEPS + 1}
            </Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            key={`step-${step}`}
            entering={FadeIn.duration(200).delay(50)}
            style={styles.animatedStepWrap}
          >
            {renderCurrentStep()}
          </Animated.View>
        </ScrollView>

        {/* Bottom nav */}
        <View style={[
          styles.bottomBar,
          isBusiness && { borderTopWidth: 1, borderTopColor: theme.borderSubtle },
        ]}>
          {step > 0 ? (
            <TouchableOpacity
              onPress={() => setStep(step - 1)}
              disabled={isLoading}
              style={styles.backTouchable}
            >
              <Text style={[styles.backText, { color: theme.textMuted }]}>back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backTouchable} />
          )}

          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: theme.accent }]}
            onPress={handleNext}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.nextButtonText}>{getButtonText()}</Text>
            )}
          </TouchableOpacity>

          {step < TOTAL_STEPS ? (
            <TouchableOpacity
              onPress={handleSkip}
              disabled={isLoading}
              style={styles.skipTouchable}
            >
              <Text style={[styles.skipText, { color: theme.textSubtle }]}>skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.skipTouchable} />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loopAnimationWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  flex: {
    flex: 1,
  },

  // ── Readiness meter (thin bar at top, personal flow) ──
  meterContainer: {
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  meterTrack: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 1,
  },

  // ── Business progress bar ──
  progressContainer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  stepIndicator: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },

  // ── Scroll & step wrappers ──
  scrollContent: {
    flexGrow: 1,
  },
  animatedStepWrap: {
    flex: 1,
  },

  // ── Personal step content ──
  stepInner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  centeredStep: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Welcome screen (step 0) ──
  welcomeTop: {
    alignItems: 'center',
    marginBottom: 40,
    gap: 16,
  },

  // ── Conversational headings ──
  convoTitle: {
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  convoSub: {
    fontSize: 15,
    fontWeight: '300',
    lineHeight: 22,
    marginBottom: 28,
  },

  // ── Toggle cards (smart learning, calendar) ──
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: 12,
    fontWeight: '300',
    lineHeight: 16,
  },
  connectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },
  connectBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tagline: {
    fontSize: 14,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: 'auto',
    paddingBottom: 16,
  },

  // ── Underline inputs ──
  inputGroup: {
    gap: 20,
    marginTop: 24,
  },
  underlineField: {
    position: 'relative',
  },
  underlineInput: {
    height: 48,
    fontSize: 16,
    fontWeight: '300',
    borderBottomWidth: 1,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  hintText: {
    fontSize: 11,
    fontWeight: '300',
    position: 'absolute',
    right: 0,
    bottom: 14,
  },

  // ── Interest chips ──
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipIcon: {
    fontSize: 16,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '400',
  },
  chipCount: {
    fontSize: 13,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: 16,
  },

  // ── Permission pills ──
  permissionPill: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '400',
  },
  orLink: {
    alignSelf: 'center',
    paddingVertical: 12,
  },
  orLinkText: {
    fontSize: 14,
    fontWeight: '300',
  },

  // ── Helper text ──
  helperText: {
    fontSize: 12,
    fontWeight: '300',
    lineHeight: 16,
  },

  // ── Summary card (step 4) ──
  summaryCard: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 24,
    width: '100%',
    maxWidth: 320,
  },
  summaryMeterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 10,
  },
  summaryPercent: {
    fontSize: 28,
    fontWeight: '600',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '300',
  },
  summaryTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  summaryFill: {
    height: '100%',
    borderRadius: 2,
  },
  checklistContainer: {
    gap: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkLabel: {
    fontSize: 14,
    fontWeight: '300',
  },

  // ── Bottom bar ──
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  backTouchable: {
    width: 50,
  },
  backText: {
    fontSize: 15,
    fontWeight: '400',
  },
  nextButton: {
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  skipTouchable: {
    width: 50,
    alignItems: 'flex-end',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '400',
  },

  // ── Business flow styles (unchanged) ──
  bizStepContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  bizStepTitle: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  bizStepSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  bizNameSection: {
    gap: 12,
    marginBottom: 16,
  },
  bizInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: 'transparent',
  },
  bizTextArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  bizInterestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bizInterestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  bizInterestLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  bizLocationButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bizButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bizLocationButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  bizDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bizDividerLine: {
    flex: 1,
    height: 1,
  },
  bizDividerText: {
    paddingHorizontal: 14,
    fontSize: 13,
  },
  bizTierList: {
    gap: 12,
    marginTop: 16,
  },
  bizTierCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
  },
  bizTierHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  bizTierName: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  bizTierPrice: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  bizTierFeature: {
    fontSize: 13,
    lineHeight: 20,
    paddingLeft: 4,
  },
  bizTierBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 4,
    alignSelf: 'center' as const,
  },
  bizTierBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700' as const,
  },
});
