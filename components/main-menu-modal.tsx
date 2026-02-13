/**
 * Main Menu Modal
 *
 * Grok-style side menu with:
 * - Slides in from left
 * - Main content scales down and shifts right
 * - Glass blur backdrop
 * - Premium spring animations
 * - Interactive pan gesture to close
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Dimensions,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { useMenuAnimation } from '@/contexts/menu-animation-context';
import { AnimatedCollapsible } from '@/components/ui/animated-collapsible';
import { GROK_SPRING, TIMING, MENU_DIMENSIONS, SCALES } from '@/constants/animations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MENU_WIDTH = SCREEN_WIDTH * MENU_DIMENSIONS.widthPercentage;

interface MainMenuModalProps {
  visible: boolean;
  onClose: () => void;
  notificationCount?: number;
}

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
  color?: string;
  description?: string;
}

function MenuItem({ icon, label, onPress, badge, color, description }: MenuItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.menuItemIconContainer, { backgroundColor: (color || colors.tint) + '15' }]}>
        <Ionicons name={icon} size={22} color={color || colors.tint} />
      </View>
      <View style={styles.menuItemContent}>
        <Text style={[styles.menuItemLabel, { color: colors.text }]}>{label}</Text>
        {description && (
          <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>
            {description}
          </Text>
        )}
      </View>
      {badge !== undefined && badge > 0 && (
        <View style={styles.menuItemBadge}>
          <Text style={styles.menuItemBadgeText}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={colors.icon} />
    </TouchableOpacity>
  );
}

export function MainMenuModal({ visible, onClose, notificationCount = 0 }: MainMenuModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const isBusiness = user?.account_type === 'business';
  const { menuProgress, setMenuOpen } = useMenuAnimation();

  // Animation values for Grok-style side menu
  const translateX = useSharedValue(-MENU_WIDTH);
  const backdropOpacity = useSharedValue(0);

  // Sync with menu animation context
  useEffect(() => {
    setMenuOpen(visible);
  }, [visible, setMenuOpen]);

  useEffect(() => {
    if (visible) {
      // Opening - slide in from left with Grok-quality spring
      translateX.value = withSpring(0, GROK_SPRING);
      backdropOpacity.value = withTiming(0.5, TIMING.backdropFadeIn);
      // Sync menu progress for content scaling
      menuProgress.value = withSpring(1, GROK_SPRING);
    } else {
      // Closing - slide out to left
      translateX.value = withSpring(-MENU_WIDTH, { ...GROK_SPRING, duration: 250 });
      backdropOpacity.value = withTiming(0, TIMING.backdropFadeOut);
      // Sync menu progress for content scaling
      menuProgress.value = withSpring(0, { ...GROK_SPRING, duration: 250 });
    }
  }, [visible]);

  // Pan gesture for interactive closing
  const panGesture = Gesture.Pan()
    .activeOffsetX(-10)
    .onUpdate((event) => {
      if (event.translationX < 0) {
        const clampedX = Math.max(-MENU_WIDTH, event.translationX);
        translateX.value = clampedX;

        const progress = 1 + clampedX / MENU_WIDTH;
        backdropOpacity.value = interpolate(
          progress,
          [0, 1],
          [0, 0.5],
          Extrapolate.CLAMP
        );
        // Sync menu progress for real-time content scaling during drag
        menuProgress.value = progress;
      }
    })
    .onEnd((event) => {
      const shouldClose =
        event.translationX < -MENU_WIDTH * MENU_DIMENSIONS.dragThreshold ||
        event.velocityX < -MENU_DIMENSIONS.velocityThreshold;

      if (shouldClose) {
        menuProgress.value = withSpring(0, { ...GROK_SPRING, duration: 250 });
        runOnJS(onClose)();
      } else {
        translateX.value = withSpring(0, GROK_SPRING);
        backdropOpacity.value = withTiming(0.5, TIMING.backdropFadeIn);
        menuProgress.value = withSpring(1, GROK_SPRING);
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const menuStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const navigateAndClose = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 200);
  };

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await signOut();
    if (!error) {
      onClose();
      router.replace('/auth/login');
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        {/* Backdrop - tap to close */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </TouchableWithoutFeedback>

        {/* Menu Container - Grok-style left slide */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.container,
              menuStyle,
              {
                paddingTop: insets.top,
                paddingBottom: insets.bottom + Spacing.md,
              },
            ]}
          >
            {/* Glass blur background */}
            <BlurView
              intensity={Platform.OS === 'ios' ? 80 : 100}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            {/* Solid background overlay */}
            <View style={[styles.menuBackground, { backgroundColor: colorScheme === 'dark' ? 'rgba(20, 20, 20, 0.92)' : 'rgba(255, 255, 255, 0.92)' }]} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Menu</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* User Profile Section */}
              <TouchableOpacity
                style={[styles.profileSection, { borderBottomColor: colors.icon + '20' }]}
                onPress={() => navigateAndClose('/(tabs)/profile')}
                activeOpacity={0.7}
              >
                <View style={[styles.avatarContainer, { backgroundColor: BrandColors.loopBlue + '20' }]}>
                  {user?.profile_picture_url ? (
                    <Image source={{ uri: user.profile_picture_url }} style={styles.avatar} />
                  ) : (
                    <Ionicons name="person" size={32} color={BrandColors.loopBlue} />
                  )}
                </View>
                <View style={styles.profileInfo}>
                  <Text style={[styles.profileName, { color: colors.text }]}>
                    {user?.name || 'Guest User'}
                  </Text>
                  <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
                    {user?.email || 'Not signed in'}
                  </Text>
                  <View style={styles.viewProfileRow}>
                    <Text style={[styles.viewProfileText, { color: BrandColors.loopBlue }]}>
                      View Profile
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={BrandColors.loopBlue} />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Quick Actions */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  QUICK ACTIONS
                </Text>
                <View style={[styles.sectionContent, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                  <MenuItem
                    icon="notifications"
                    label="Notifications"
                    badge={notificationCount}
                    onPress={() => navigateAndClose('/(tabs)')}
                    color={BrandColors.loopOrange}
                  />
                  <MenuItem
                    icon="calendar"
                    label="My Calendar"
                    onPress={() => navigateAndClose('/(tabs)/calendar')}
                    color={BrandColors.loopBlue}
                  />
                  <MenuItem
                    icon="sparkles"
                    label="For You"
                    description="AI-curated recommendations"
                    onPress={() => navigateAndClose('/(tabs)')}
                    color={BrandColors.loopPurple}
                  />
                  <MenuItem
                    icon="compass"
                    label="Explore"
                    onPress={() => navigateAndClose('/(tabs)/explore')}
                    color={BrandColors.loopGreen}
                  />
                </View>
              </View>

              {/* Settings & Preferences (Collapsible) */}
              <View style={[styles.collapsibleContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <AnimatedCollapsible title="Settings & Preferences" icon="settings-outline">
                  <MenuItem
                    icon="color-palette-outline"
                    label="Appearance"
                    description="Light, Dark, or System theme"
                    onPress={() => navigateAndClose('/(tabs)/settings')}
                    color={BrandColors.loopIndigo}
                  />
                  <MenuItem
                    icon="sparkles"
                    label="AI Preferences"
                    description="Discovery mode & data controls"
                    onPress={() => navigateAndClose('/settings/ai-preferences')}
                    color={BrandColors.loopPurple}
                  />
                  <MenuItem
                    icon="shield-checkmark-outline"
                    label="Privacy"
                    description="Loop visibility & invites"
                    onPress={() => navigateAndClose('/settings/privacy')}
                    color={BrandColors.success}
                  />
                  <MenuItem
                    icon="heart"
                    label="Interests"
                    description="Customize your preferences"
                    onPress={() => navigateAndClose('/(tabs)/settings')}
                  />
                  <MenuItem
                    icon="location"
                    label="Home & Work Locations"
                    onPress={() => navigateAndClose('/(tabs)/locations')}
                  />
                  <MenuItem
                    icon="notifications-outline"
                    label="Notification Preferences"
                    onPress={() => navigateAndClose('/(tabs)/settings')}
                  />
                  <MenuItem
                    icon="ban-outline"
                    label="Blocked Places"
                    onPress={() => navigateAndClose('/(tabs)/settings')}
                  />
                </AnimatedCollapsible>
              </View>

              {/* Business Section (Collapsible) */}
              <View style={[styles.collapsibleContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <AnimatedCollapsible title="Business" icon="briefcase-outline">
                  {isBusiness ? (
                    <>
                      <MenuItem
                        icon="analytics"
                        label="Dashboard"
                        description="View your business metrics"
                        onPress={() => navigateAndClose('/(tabs)/dashboard')}
                        color={BrandColors.loopBlue}
                      />
                      <MenuItem
                        icon="bar-chart"
                        label="Analytics"
                        description="Detailed performance data"
                        onPress={() => navigateAndClose('/(tabs)/analytics')}
                        color={BrandColors.loopOrange}
                      />
                      <MenuItem
                        icon="pencil"
                        label="Edit Listing"
                        onPress={() => navigateAndClose('/(tabs)/listing')}
                        color={BrandColors.loopGreen}
                      />
                    </>
                  ) : (
                    <MenuItem
                      icon="add-circle"
                      label="Create Business Account"
                      description="Promote your venue on Loop"
                      onPress={() => navigateAndClose('/(tabs)/business-dashboard')}
                      color={BrandColors.loopPurple}
                    />
                  )}
                </AnimatedCollapsible>
              </View>

              {/* Help & Support (Collapsible) */}
              <View style={[styles.collapsibleContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <AnimatedCollapsible title="Help & Support" icon="help-circle-outline">
                  <MenuItem
                    icon="play-circle-outline"
                    label="Replay Tutorial"
                    onPress={() => {}}
                  />
                  <MenuItem
                    icon="information-circle-outline"
                    label="About Loop"
                    onPress={() => {}}
                  />
                  <MenuItem
                    icon="document-text-outline"
                    label="Terms & Privacy"
                    onPress={() => {}}
                  />
                  <MenuItem
                    icon="chatbubble-ellipses-outline"
                    label="Contact Support"
                    onPress={() => {}}
                  />
                </AnimatedCollapsible>
              </View>

              {/* Sign Out Button */}
              <TouchableOpacity
                style={[styles.signOutButton, { borderColor: BrandColors.error + '40' }]}
                onPress={handleSignOut}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={20} color={BrandColors.error} />
                <Text style={[styles.signOutText, { color: BrandColors.error }]}>
                  Sign Out
                </Text>
              </TouchableOpacity>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                  Loop v1.0.0 • Made with love
                </Text>
              </View>
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: MENU_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  menuBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    ...Typography.headlineMedium,
    fontFamily: 'Urbanist-Bold',
  },
  closeButton: {
    padding: Spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...Typography.titleMedium,
    fontFamily: 'Urbanist-Bold',
    marginBottom: 2,
  },
  profileEmail: {
    ...Typography.bodySmall,
    marginBottom: Spacing.xs,
  },
  viewProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewProfileText: {
    ...Typography.labelMedium,
    fontFamily: 'Urbanist-SemiBold',
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.labelMedium,
    fontFamily: 'Urbanist-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  sectionContent: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  collapsibleContainer: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  menuItemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    ...Typography.bodyMedium,
    fontFamily: 'Urbanist-SemiBold',
  },
  menuItemDescription: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  menuItemBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BrandColors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: Spacing.sm,
  },
  menuItemBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  signOutText: {
    ...Typography.bodyMedium,
    fontFamily: 'Urbanist-SemiBold',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  footerText: {
    ...Typography.bodySmall,
  },
});
