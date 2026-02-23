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

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BLUR_HEADER_HEIGHT } from '@/components/blur-header-wrapper';
import { ProfileHeader } from '@/components/profile-header';
import ProfileStatsBar, { TraitPills, type FeedbackStats } from '@/components/profile-stats-bar';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { getUserFeedbackStats } from '@/services/feedback-service';
import SwipeableLayout from '@/components/swipeable-layout';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BorderRadius, BrandColors, CategoryColors } from '@/constants/brand';
import { ONBOARDING_INTERESTS, INTEREST_GROUPS } from '@/constants/activity-categories';
import { generatePersonalitySummary, type PersonalityInput } from '@/utils/personality-generator';
import { useMenuAnimation } from '@/contexts/menu-animation-context';
import { AnimatedBlurView, SUPPORTS_ANIMATED_BLUR, ANDROID_BLUR_METHOD } from '@/components/ui/animated-blur-view';
import { MENU_CONTENT_BLUR, MENU_OPEN_SPRING, GROK_SPRING, MENU_DIMENSIONS } from '@/constants/animations';
import { MainMenuModal } from '@/components/main-menu-modal';
import { ScreenErrorBoundary } from '@/components/error-boundary';

// Ionicons for interest icons — filled (selected) and outline (unselected)
const TILE_ICONS_FILLED: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Dining': 'restaurant',
  'Coffee & Cafes': 'cafe',
  'Bars & Nightlife': 'wine',
  'Live Music': 'musical-notes',
  'Entertainment': 'film',
  'Sports': 'basketball',
  'Fitness': 'fitness',
  'Wellness': 'heart',
  'Arts & Culture': 'color-palette',
  'Outdoor Activities': 'leaf',
  'Shopping': 'cart',
  'Movies': 'videocam',
  'Gaming': 'game-controller',
  'Photography': 'camera',
  'Food & Cooking': 'flame',
  'Technology': 'laptop',
  'Reading': 'book',
  'Travel': 'airplane',
};
const TILE_ICONS_OUTLINE: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Dining': 'restaurant-outline',
  'Coffee & Cafes': 'cafe-outline',
  'Bars & Nightlife': 'wine-outline',
  'Live Music': 'musical-notes-outline',
  'Entertainment': 'film-outline',
  'Sports': 'basketball-outline',
  'Fitness': 'fitness-outline',
  'Wellness': 'heart-outline',
  'Arts & Culture': 'color-palette-outline',
  'Outdoor Activities': 'leaf-outline',
  'Shopping': 'cart-outline',
  'Movies': 'videocam-outline',
  'Gaming': 'game-controller-outline',
  'Photography': 'camera-outline',
  'Food & Cooking': 'flame-outline',
  'Technology': 'laptop-outline',
  'Reading': 'book-outline',
  'Travel': 'airplane-outline',
};

// Map interest names to CategoryColors for selected tile borders/badges
const TILE_CATEGORY_COLORS: Record<string, string> = {
  'Dining': CategoryColors.dining,
  'Coffee & Cafes': CategoryColors.coffee,
  'Bars & Nightlife': CategoryColors.nightlife,
  'Live Music': CategoryColors.music,
  'Entertainment': CategoryColors.entertainment,
  'Sports': CategoryColors.sports,
  'Fitness': CategoryColors.fitness,
  'Wellness': CategoryColors.wellness,
  'Arts & Culture': CategoryColors.arts,
  'Outdoor Activities': CategoryColors.outdoors,
  'Shopping': CategoryColors.shopping,
  'Movies': CategoryColors.entertainment,
  'Gaming': CategoryColors.entertainment,
  'Photography': CategoryColors.arts,
  'Food & Cooking': CategoryColors.dining,
  'Technology': CategoryColors.work,
  'Reading': CategoryColors.arts,
  'Travel': CategoryColors.travel,
};

const SCREEN_W = Dimensions.get('window').width;
const INTEREST_COLS = 4;
const INTEREST_GAP = 12;
const INTEREST_PADDING = Spacing.lg * 2;
const INTEREST_ICON_AREA = Math.floor((SCREEN_W - INTEREST_PADDING - (INTEREST_GAP * (INTEREST_COLS - 1))) / INTEREST_COLS);

// ============================================================================
// INTEREST ICON — Navbar lens-style: B&W icons, circular lens on selection
// Lens clones from last-selected icon, travels via spring translate, pops on lock
// On deselect: lens shrinks/fades in place (no travel)
// First selection (no previous): lens pops in from scale 0→1
// ============================================================================

// Base circle behind all icons — matches navbar dark background
const ICON_BASE_BG = { dark: '#1C1C1E', light: '#E8E8ED' };
// Lens bubble on selection — lighter, same as tab bar active lens
const LENS_BG = { dark: '#2D2D30', light: '#D1D1D6' };

// Spring config from the tab bar (SCALE_CONFIG)
const SCALE_SPRING = { damping: 25, stiffness: 400, mass: 0.5 };
// Slightly faster spring for the travel animation
const TRAVEL_SPRING = { damping: 22, stiffness: 350, mass: 0.4 };

// B&W icon colors (outline state)
const ICON_MUTED = { dark: '#808080', light: '#8E8E93' };

// Approximate row height for vertical travel calculation:
// paddingVertical(8) + icon(48) + marginTop(4) + label(~12) + paddingVertical(8) = ~80
// plus gap(12) between rows = ~92 center-to-center vertically
const CELL_STEP_X = INTEREST_ICON_AREA + INTEREST_GAP;
const CELL_STEP_Y = 92;

/** Get grid column and row from a flat index (4 columns) */
function gridPos(index: number): { col: number; row: number } {
  return { col: index % INTEREST_COLS, row: Math.floor(index / INTEREST_COLS) };
}

interface InterestIconProps {
  interest: string;
  isSelected: boolean;
  isDark: boolean;
  textColor: string;
  categoryColor: string;
  gridIndex: number;
  lastSelectedIndex: number | null;
  onToggle: (interest: string) => void;
}

function InterestIcon({
  interest,
  isSelected,
  isDark,
  textColor,
  categoryColor,
  gridIndex,
  lastSelectedIndex,
  onToggle,
}: InterestIconProps) {
  const lensScale = useSharedValue(isSelected ? 1 : 0);
  const lensTranslateX = useSharedValue(0);
  const lensTranslateY = useSharedValue(0);
  const iconScale = useSharedValue(1);
  const prevSelected = useRef(isSelected);

  useEffect(() => {
    if (isSelected && !prevSelected.current) {
      // === SELECTING ===
      if (lastSelectedIndex !== null && lastSelectedIndex !== gridIndex) {
        // Traveling lens: start offset toward last-selected position, slide to center
        const from = gridPos(lastSelectedIndex);
        const to = gridPos(gridIndex);
        const deltaCol = from.col - to.col;
        const deltaRow = from.row - to.row;

        // Set initial offset (where the last selected icon is relative to this one)
        lensTranslateX.value = deltaCol * CELL_STEP_X;
        lensTranslateY.value = deltaRow * CELL_STEP_Y;
        lensScale.value = 0.7; // start slightly smaller

        // Animate: travel to center position + scale up
        lensTranslateX.value = withSpring(0, TRAVEL_SPRING);
        lensTranslateY.value = withSpring(0, TRAVEL_SPRING);
        lensScale.value = withSpring(1, SCALE_SPRING);
      } else {
        // First selection or same-index re-select: just pop in
        lensTranslateX.value = 0;
        lensTranslateY.value = 0;
        lensScale.value = 0;
        lensScale.value = withSpring(1, SCALE_SPRING);
      }

      // Icon reacts — brief scale-up like tab bar pressIn
      iconScale.value = withSpring(1.15, SCALE_SPRING);
      setTimeout(() => {
        iconScale.value = withSpring(1, SCALE_SPRING);
      }, 150);
    } else if (!isSelected && prevSelected.current) {
      // === DESELECTING — lens shrinks/fades in place, no travel ===
      lensScale.value = withSpring(0, SCALE_SPRING);
      lensTranslateX.value = withTiming(0, { duration: 100 });
      lensTranslateY.value = withTiming(0, { duration: 100 });

      // Icon bumps down briefly
      iconScale.value = withSpring(0.9, SCALE_SPRING);
      setTimeout(() => {
        iconScale.value = withSpring(1, SCALE_SPRING);
      }, 100);
    }
    prevSelected.current = isSelected;
  }, [isSelected, lastSelectedIndex, gridIndex]);

  const lensStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: lensTranslateX.value },
      { translateY: lensTranslateY.value },
      { scale: lensScale.value },
    ],
    opacity: lensScale.value,
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(interest);
  }, [interest, onToggle]);

  const mutedColor = isDark ? ICON_MUTED.dark : ICON_MUTED.light;
  const baseBg = isDark ? ICON_BASE_BG.dark : ICON_BASE_BG.light;
  const lensBg = isDark ? LENS_BG.dark : LENS_BG.light;
  // Outline icon when unselected, filled icon when selected (like navbar)
  const iconName = isSelected
    ? (TILE_ICONS_FILLED[interest] || 'ellipse')
    : (TILE_ICONS_OUTLINE[interest] || 'ellipse-outline');

  return (
    <Pressable
      onPress={handlePress}
      style={styles.interestIconWrapper}
      accessibilityRole="button"
      accessibilityLabel={`${interest}${isSelected ? ', selected' : ''}`}
      accessibilityState={{ selected: isSelected }}
      accessibilityHint={isSelected ? 'Tap to remove interest' : 'Tap to add interest'}
    >
      {/* Base dark circle behind all icons (like navbar bar background) */}
      <View style={[styles.interestIconBase, { backgroundColor: baseBg }]} />

      {/* Lens bubble — lighter circle that slides on top when selected */}
      <Animated.View style={[styles.interestLens, { backgroundColor: lensBg }, lensStyle]} />

      {/* Icon — centered, outline→filled on selection */}
      <Animated.View style={[styles.interestIconContent, iconAnimStyle]}>
        <Ionicons
          name={iconName}
          size={26}
          color={isSelected ? categoryColor : mutedColor}
        />
      </Animated.View>
      <Text
        style={[
          styles.interestLabel,
          { color: isSelected ? textColor : mutedColor },
        ]}
        numberOfLines={1}
      >
        {interest}
      </Text>
    </Pressable>
  );
}

// ============================================================================
// INLINE SAVE INDICATOR — pencil → Save → checkmark → pencil cycle
// ============================================================================
interface InlineSaveIndicatorProps {
  hasChanges: boolean;
  saveState: 'idle' | 'saving' | 'saved';
  onSave: () => void;
  /** Show pencil icon in idle state (Personal Info) vs hidden (Interests) */
  showPencil?: boolean;
  isDark: boolean;
}

function InlineSaveIndicator({ hasChanges, saveState, onSave, showPencil = false, isDark }: InlineSaveIndicatorProps) {
  const pencilScale = useSharedValue(1);
  const brightOpacity = useSharedValue(0); // 0 = muted showing, 1 = bright showing
  const checkOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0.5);

  // Pencil tap — bounce + flash brighter
  const handlePencilPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pencilScale.value = withSpring(1.3, SCALE_SPRING, () => {
      pencilScale.value = withSpring(1, SCALE_SPRING);
    });
    // Flash to bright color then fade back to muted
    brightOpacity.value = withTiming(1, { duration: 100 }, () => {
      brightOpacity.value = withTiming(0, { duration: 600 });
    });
  }, []);

  // Checkmark: slow fade in, hold, slow fade out (symmetrical)
  useEffect(() => {
    if (saveState === 'saved') {
      checkOpacity.value = 0;
      checkScale.value = 0.8;
      checkOpacity.value = withTiming(1, { duration: 800 });
      checkScale.value = withSpring(1, SCALE_SPRING);
      const timer = setTimeout(() => {
        checkOpacity.value = withTiming(0, { duration: 800 });
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [saveState]);

  const pencilContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pencilScale.value }],
  }));

  // Muted icon fades out as bright fades in
  const mutedStyle = useAnimatedStyle(() => ({
    opacity: 1 - brightOpacity.value,
  }));

  const brightStyle = useAnimatedStyle(() => ({
    opacity: brightOpacity.value,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  // State: saved → show outline checkmark (no filled circle bg), slow fade
  if (saveState === 'saved') {
    return (
      <Animated.View style={[{ marginLeft: Spacing.sm }, checkStyle]}>
        <Ionicons name="checkmark" size={17} color={BrandColors.loopGreen} />
      </Animated.View>
    );
  }

  // State: saving → subtle text
  if (saveState === 'saving') {
    return (
      <Text style={[indicatorStyles.saveLink, { opacity: 0.4, marginLeft: Spacing.sm }]}>Saving...</Text>
    );
  }

  // State: idle + changes → show Save link
  if (hasChanges) {
    return (
      <TouchableOpacity
        onPress={onSave}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{ marginLeft: Spacing.sm }}
        accessibilityRole="button"
        accessibilityLabel="Save changes"
      >
        <Text style={indicatorStyles.saveLink}>Save</Text>
      </TouchableOpacity>
    );
  }

  // State: idle + no changes → show pencil (if enabled) or nothing
  // Two overlapping icons: muted (default) and bright (on press)
  if (showPencil) {
    const mutedColor = isDark ? '#555' : '#AAAAAA';
    const brightColor = isDark ? '#CCCCCC' : '#555555';
    return (
      <Animated.View style={[{ marginLeft: 6, marginBottom: 1 }, pencilContainerStyle]}>
        <Pressable
          onPressIn={handlePencilPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Edit"
        >
          <View style={{ width: 15, height: 15 }}>
            {/* Muted pencil — default visible */}
            <Animated.View style={[{ position: 'absolute' }, mutedStyle]}>
              <Ionicons name="pencil-outline" size={15} color={mutedColor} />
            </Animated.View>
            {/* Bright pencil — flashes on press */}
            <Animated.View style={[{ position: 'absolute' }, brightStyle]}>
              <Ionicons name="pencil-outline" size={15} color={brightColor} />
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return null;
}

const indicatorStyles = StyleSheet.create({
  saveLink: {
    fontSize: 13,
    fontWeight: '500',
    color: BrandColors.loopBlue,
    opacity: 0.85,
  },
});

// ============================================================================
// PROFILE SCREEN
// ============================================================================

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = ThemeColors[colorScheme ?? 'light'];
  const { user, updateUserProfile } = useAuth();
  const safeInsets = useSafeAreaInsets();
  /** Height of the absolutely-positioned blur header */
  const headerOffset = safeInsets.top + BLUR_HEADER_HEIGHT.standard;

  // ── Menu animation: blur + scale main content when left drawer opens ──
  const { menuProgress } = useMenuAnimation();
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [menuGestureControlled, setMenuGestureControlled] = useState(false);

  const DRAWER_WIDTH = Dimensions.get('window').width * MENU_DIMENSIONS.widthPercentage;

  // Animated styles for content scale/shift when menu is open
  const menuContentStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [
        { scale: interpolate(menuProgress.value, [0, 1], [1, MENU_CONTENT_BLUR.contentScale], Extrapolate.CLAMP) },
        { translateX: interpolate(menuProgress.value, [0, 1], [0, MENU_CONTENT_BLUR.contentTranslateX], Extrapolate.CLAMP) },
      ],
      borderRadius: interpolate(menuProgress.value, [0, 1], [0, MENU_CONTENT_BLUR.contentBorderRadius], Extrapolate.CLAMP),
      overflow: menuProgress.value > 0.01 ? 'hidden' as const : 'visible' as const,
    };
  });

  // Animated blur intensity for content overlay
  const menuBlurAnimatedProps = useAnimatedProps(() => {
    'worklet';
    return {
      intensity: SUPPORTS_ANIMATED_BLUR
        ? interpolate(menuProgress.value, [0, 1], [0, MENU_CONTENT_BLUR.backgroundBlurIntensity], Extrapolate.CLAMP)
        : MENU_CONTENT_BLUR.backgroundBlurIntensity,
    };
  });

  // Animated opacity for blur overlay
  const menuBlurOverlayStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: SUPPORTS_ANIMATED_BLUR
        ? (menuProgress.value > 0.01 ? 1 : 0)
        : interpolate(menuProgress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
    };
  });

  // ── Menu gesture handlers (drag-to-open from hamburger button) ──
  const handleHeaderMenuDrag = useCallback((translationX: number) => {
    const progress = Math.min(translationX / DRAWER_WIDTH, 1);
    menuProgress.value = Math.max(0, progress);
    if (progress > 0.05 && !showMainMenu) {
      setMenuGestureControlled(true);
      setShowMainMenu(true);
    }
  }, [DRAWER_WIDTH, menuProgress, showMainMenu]);

  const handleHeaderMenuDragEnd = useCallback((translationX: number, velocityX: number) => {
    if (translationX > 60 || velocityX > 600) {
      // Snap open
      menuProgress.value = withSpring(1, MENU_OPEN_SPRING);
      if (!showMainMenu) {
        setMenuGestureControlled(true);
        setShowMainMenu(true);
      }
    } else {
      // Snap closed
      menuProgress.value = withSpring(0, { ...GROK_SPRING, duration: 250 });
      setShowMainMenu(false);
      setMenuGestureControlled(false);
    }
  }, [showMainMenu, menuProgress]);

  const handleCloseMenu = useCallback(() => {
    setShowMainMenu(false);
    setMenuGestureControlled(false);
  }, []);

  // Form state
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture_url || '');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    (user?.interests as string[]) || []
  );
  // Track the grid index of the PREVIOUS selection (for traveling lens origin).
  // We use a state pair: prevSelectedIndex is what the lens travels FROM,
  // and a ref tracks the "current" so we can derive "previous" on next selection.
  const lastSelectedRef = useRef<number | null>(null);
  const [travelOriginIndex, setTravelOriginIndex] = useState<number | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats>({
    totalFeedback: 0,
    thumbsUpCount: 0,
    thumbsDownCount: 0,
    satisfactionRate: 0,
  });

  useEffect(() => {
    if (user?.id) {
      getUserFeedbackStats(user.id).then(setFeedbackStats).catch((err) => {
        console.warn('[profile] Feedback stats fetch failed:', err?.message);
      });
    }
  }, [user?.id]);

  // Track whether edits have been made
  const initialName = user?.name || '';
  const initialPhone = user?.phone || '';
  const initialPicture = user?.profile_picture_url || '';
  const initialInterests = (user?.interests as string[]) || [];

  const hasPersonalChanges = useMemo(() => {
    if (name !== initialName) return true;
    if (phone !== initialPhone) return true;
    if (profilePicture !== initialPicture) return true;
    return false;
  }, [name, phone, profilePicture, initialName, initialPhone, initialPicture]);

  const hasInterestChanges = useMemo(() => {
    if (selectedInterests.length !== initialInterests.length) return true;
    if (selectedInterests.some((i) => !initialInterests.includes(i))) return true;
    return false;
  }, [selectedInterests, initialInterests]);

  // Save confirmation animation states
  const [personalSaveState, setPersonalSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [interestSaveState, setInterestSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

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

  // Toggle interest selection — track travel origin for traveling lens
  const toggleInterest = useCallback((interest: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const isDeselecting = selectedInterests.includes(interest);
    if (!isDeselecting) {
      // SELECTING: set travel origin to the PREVIOUS selection (ref value)
      // before updating the ref to this new selection
      setTravelOriginIndex(lastSelectedRef.current);
      const idx = ONBOARDING_INTERESTS.indexOf(interest);
      if (idx >= 0) lastSelectedRef.current = idx;
    }
    setSelectedInterests(prev =>
      isDeselecting
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  }, [selectedInterests]);

  // Inline save — saves all changes, shows checkmark on the section that triggered it
  const handleInlineSave = useCallback(async (section: 'personal' | 'interests') => {
    if (!user) return;

    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }

    if (selectedInterests.length === 0) {
      Alert.alert('Interests Required', 'Please select at least one interest.');
      return;
    }

    const setSaveState = section === 'personal' ? setPersonalSaveState : setInterestSaveState;
    setSaveState('saving');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const updates = {
        name: name.trim(),
        phone: phone.trim() || null,
        profile_picture_url: profilePicture || null,
        interests: selectedInterests,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Show checkmark BEFORE updating context (so hasChanges doesn't flip first)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaveState('saved');

      // Update local auth context in background
      updateUserProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        profile_picture_url: profilePicture || null,
        interests: selectedInterests,
      }).catch((err) => {
        console.warn('[profile] Background profile update failed:', err?.message);
      });

      // Return to idle after checkmark shows
      setTimeout(() => setSaveState('idle'), 1800);
    } catch (error) {
      console.error('Error saving profile:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Save Failed', 'Unable to save profile changes. Please try again.');
      setSaveState('idle');
    }
  }, [user, name, phone, profilePicture, selectedInterests, updateUserProfile]);

  return (
    <ScreenErrorBoundary screen="Profile">
    <SwipeableLayout>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={[styles.container, { backgroundColor: colors.background }, menuContentStyle]}>
        <ProfileHeader
          username={user?.email?.split('@')[0] || user?.name || 'Profile'}
          onSettingsPress={() => {
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
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerOffset + Spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handleProfilePictureUpload}
          accessibilityRole="button"
          accessibilityLabel="Change profile picture"
          accessibilityHint="Opens photo picker to upload a new profile picture"
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>
            <InlineSaveIndicator
              hasChanges={hasPersonalChanges}
              saveState={personalSaveState}
              onSave={() => handleInlineSave('personal')}
              isDark={isDark}
            />
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
              accessibilityLabel="Name"
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
              accessibilityLabel="Email, read only"
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
              accessibilityLabel="Phone number"
            />
          </View>

          {/* Locations Link */}
          <TouchableOpacity
            style={[styles.locationsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/locations');
            }}
            accessibilityRole="button"
            accessibilityLabel="My Locations"
            accessibilityHint="Set home and work addresses"
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

        {/* Interests Section — Navbar lens-style icons */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Your Interests
            </Text>
            <Text style={[styles.sectionCount, { color: isDark ? '#555' : '#AAAAAA' }]}>
              {selectedInterests.length}
            </Text>
            <InlineSaveIndicator
              hasChanges={hasInterestChanges}
              saveState={interestSaveState}
              onSave={() => handleInlineSave('interests')}
              isDark={isDark}
            />
          </View>
          <Text style={[styles.hint, { color: colors.textSecondary, marginBottom: Spacing.md }]}>
            {"Tap to toggle — we'll refine as you use Loop"}
          </Text>

          <View style={styles.interestGrid}>
            {ONBOARDING_INTERESTS.map((interest, idx) => {
              const isSelected = selectedInterests.includes(interest);
              const categoryColor = TILE_CATEGORY_COLORS[interest] || BrandColors.loopBlue;

              return (
                <InterestIcon
                  key={interest}
                  interest={interest}
                  isSelected={isSelected}
                  categoryColor={categoryColor}
                  isDark={isDark}
                  textColor={colors.text}
                  gridIndex={idx}
                  lastSelectedIndex={travelOriginIndex}
                  onToggle={toggleInterest}
                />
              );
            })}
          </View>
        </View>

      </ScrollView>

        {/* Blur overlay for menu transition */}
        <AnimatedBlurView
          animatedProps={menuBlurAnimatedProps}
          tint="dark"
          experimentalBlurMethod={ANDROID_BLUR_METHOD}
          style={[StyleSheet.absoluteFill, menuBlurOverlayStyle]}
          pointerEvents="none"
        />
      </Animated.View>
      </View>

    </SwipeableLayout>
    </ScreenErrorBoundary>
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
    alignItems: 'flex-end',
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
  // Interest icons — navbar lens-style grid
  interestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: INTEREST_GAP,
  },
  interestIconWrapper: {
    width: INTEREST_ICON_AREA,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  interestIconBase: {
    position: 'absolute',
    top: Spacing.sm,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignSelf: 'center',
  },
  interestLens: {
    position: 'absolute',
    top: Spacing.sm,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignSelf: 'center',
  },
  interestIconContent: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    width: '100%',
  },
  sectionCount: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 6,
  },
});
