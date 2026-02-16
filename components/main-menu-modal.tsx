/**
 * Profile Drawer (formerly MainMenuModal)
 *
 * Slim 6-item profile drawer that replaces the 15+ item main menu.
 * Grok-style left slide with glass blur backdrop.
 *
 * Items:
 * 1. Profile card (avatar, name, email)
 * 2. My Dashboard (stats + map)
 * 3. History (recommendation history)
 * 4. Settings
 * 5. Help
 * 6. Sign Out
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { useMenuAnimation } from '@/contexts/menu-animation-context';
import { AnimatedDrawer } from '@/components/animated-drawer';

interface MainMenuModalProps {
  visible: boolean;
  onClose: () => void;
  notificationCount?: number;
  onOpenDashboard?: () => void;
  onOpenHistory?: () => void;
}

interface DrawerItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
  color?: string;
  description?: string;
}

function DrawerItem({ icon, label, onPress, badge, color, description }: DrawerItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity
      style={styles.drawerItem}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.drawerItemIconContainer, { backgroundColor: (color || colors.tint) + '15' }]}>
        <Ionicons name={icon} size={22} color={color || colors.tint} />
      </View>
      <View style={styles.drawerItemContent}>
        <Text style={[styles.drawerItemLabel, { color: colors.text }]}>{label}</Text>
        {description && (
          <Text style={[styles.drawerItemDescription, { color: colors.textSecondary }]}>
            {description}
          </Text>
        )}
      </View>
      {badge !== undefined && badge > 0 && (
        <View style={styles.drawerItemBadge}>
          <Text style={styles.drawerItemBadgeText}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={colors.icon} />
    </TouchableOpacity>
  );
}

export function MainMenuModal({
  visible,
  onClose,
  notificationCount = 0,
  onOpenDashboard,
  onOpenHistory,
}: MainMenuModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const isBusiness = user?.account_type === 'business';
  const { menuProgress, setMenuOpen } = useMenuAnimation();

  useEffect(() => {
    setMenuOpen(visible);
  }, [visible, setMenuOpen]);

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

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (!user?.name) return '?';
    const parts = user.name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0][0].toUpperCase();
  };

  return (
    <AnimatedDrawer
      visible={visible}
      onClose={onClose}
      side="left"
      menuProgress={menuProgress}
    >
      <View
        style={[
          styles.contentWrapper,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
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
          {/* Profile Card */}
          <TouchableOpacity
            style={[styles.profileSection, { borderBottomColor: colors.icon + '20' }]}
            onPress={() => navigateAndClose('/(tabs)/profile')}
            activeOpacity={0.7}
          >
            <View style={[styles.avatarContainer, { backgroundColor: BrandColors.loopBlue + '20' }]}>
              {user?.profile_picture_url ? (
                <Image source={{ uri: user.profile_picture_url }} style={styles.avatar} />
              ) : (
                <Text style={styles.avatarInitials}>{getInitials()}</Text>
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

          {/* Main Drawer Items */}
          <View style={[styles.drawerSection, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
            <DrawerItem
              icon="stats-chart"
              label="My Dashboard"
              description="Stats, map & insights"
              onPress={() => {
                onClose();
                setTimeout(() => onOpenDashboard?.(), 200);
              }}
              color={BrandColors.loopBlue}
            />
            <DrawerItem
              icon="time-outline"
              label="History"
              description="Past recommendations & feedback"
              onPress={() => {
                onClose();
                setTimeout(() => onOpenHistory?.(), 200);
              }}
              color={BrandColors.loopPurple}
            />
            <DrawerItem
              icon="settings-outline"
              label="Settings"
              description="Preferences, privacy & more"
              onPress={() => navigateAndClose('/settings/ai-preferences')}
              color={colors.textSecondary}
            />
            {isBusiness && (
              <DrawerItem
                icon="briefcase-outline"
                label="Business"
                description="Dashboard & analytics"
                onPress={() => navigateAndClose('/(tabs)/business-dashboard')}
                color={BrandColors.loopOrange}
              />
            )}
            <DrawerItem
              icon="help-circle-outline"
              label="Help & Support"
              onPress={() => navigateAndClose('/(tabs)/settings')}
              color={colors.textSecondary}
            />
          </View>

          {/* Sign Out */}
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
              Loop v1.0.0
            </Text>
          </View>
        </ScrollView>
      </View>
    </AnimatedDrawer>
  );
}

const styles = StyleSheet.create({
  contentWrapper: {
    flex: 1,
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
    overflow: 'hidden',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: BrandColors.loopBlue,
    includeFontPadding: false,
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
  drawerSection: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  drawerItemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  drawerItemContent: {
    flex: 1,
  },
  drawerItemLabel: {
    ...Typography.bodyMedium,
    fontFamily: 'Urbanist-SemiBold',
  },
  drawerItemDescription: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  drawerItemBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BrandColors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: Spacing.sm,
  },
  drawerItemBadgeText: {
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
