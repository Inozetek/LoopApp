import { Tabs } from 'expo-router';
import React from 'react';
import { View, Platform } from 'react-native';

import { EbayStyleTabBar } from '@/components/ebay-style-tab-bar';
import { GradientIcon } from '@/components/gradient-icon';
import { AnimatedTabIcon } from '@/components/animated-tab-icon';
import { AppBadgingIcon } from '@/components/icons/app-badging-icon';
import { ModeCommentIcon } from '@/components/icons/mode-comment-icon';
import { AccountCircleIcon } from '@/components/icons/account-circle-icon';
import { SearchIcon } from '@/components/icons/search-icon';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabNotifications } from '@/contexts/tab-notifications-context';
import { useAuth } from '@/contexts/auth-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { hasNewRecommendations, notifications } = useTabNotifications();
  const { user } = useAuth();

  // Get user's first name for Profile tab
  const firstName = user?.name?.split(' ')[0] || 'Profile';

  // Icon color based on theme - white for both active/inactive in dark mode like eBay
  const iconColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';
  const inactiveIconColor = colorScheme === 'dark' ? '#FFFFFF' : '#48484A';

  return (
    <Tabs
      tabBar={(props) => <EbayStyleTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: iconColor,
        tabBarInactiveTintColor: inactiveIconColor,
        tabBarShowLabel: true,
        headerShown: false,
      }}>
      {/* === Main Tabs (All Users) === */}
      {/* Tab 1: My Loop - Schedule, Loop route view */}
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'My Loop',
          tabBarIcon: ({ color, focused, size }) => (
            <AnimatedTabIcon
              size={size}
              color={color}
              focused={focused}
              badge={notifications.calendar}
              customIcon={({ size: iconSize, color: iconColor }) => (
                <AppBadgingIcon size={iconSize} color={iconColor} filled={focused} />
              )}
            />
          ),
        }}
      />
      {/* Tab 2: Explore - Search, browse, discover */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused, size }) => (
            <AnimatedTabIcon
              size={size}
              color={color}
              focused={focused}
              badge={notifications.explore}
              customIcon={({ size: iconSize, color: iconColor }) => (
                <SearchIcon size={iconSize} color={iconColor} filled={focused} />
              )}
            />
          ),
        }}
      />
      {/* Tab 3: Daily - AI-curated recommendations (center position) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'For You',
          tabBarIcon: ({ focused, size }) => (
            <GradientIcon
              name="sparkles"
              size={Platform.OS === 'android' ? (size || 24) : (size ? size + 3 : 33)}
              focused={focused}
              showBadge={hasNewRecommendations}
              badgeCount={notifications.recommendations}
            />
          ),
        }}
      />
      {/* Tab 4: Social - Friends' Loops, coordinate, group planning */}
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Social',
          tabBarIcon: ({ color, focused, size }) => (
            <View style={{ marginTop: 2 }}>
              <AnimatedTabIcon
                size={size ? size - 4 : 26}
                color={color}
                focused={focused}
                badge={notifications.friends}
                customIcon={({ size: iconSize, color: iconColor }) => (
                  <ModeCommentIcon size={iconSize} color={iconColor} filled={focused} />
                )}
              />
            </View>
          ),
        }}
      />
      {/* Tab 5: Profile - Settings, preferences, subscription */}
      <Tabs.Screen
        name="profile"
        options={{
          title: firstName,
          tabBarIcon: ({ color, focused, size }) => (
            <AnimatedTabIcon
              size={size}
              color={color}
              focused={focused}
              badge={notifications.profile}
              customIcon={({ size: iconSize, color: iconColor }) => (
                <AccountCircleIcon size={iconSize} color={iconColor} filled={focused} />
              )}
            />
          ),
        }}
      />

      {/* === Hidden Screens (accessible via navigation/menu) === */}
      {/* Business Dashboard - accessed from Main Menu */}
      <Tabs.Screen
        name="dashboard"
        options={{
          href: null, // Hidden from tab bar - accessed via Main Menu
        }}
      />
      {/* Business Listing - accessed from Main Menu */}
      <Tabs.Screen
        name="listing"
        options={{
          href: null, // Hidden from tab bar - accessed via Main Menu
        }}
      />
      {/* Business Analytics - accessed from Main Menu */}
      <Tabs.Screen
        name="analytics"
        options={{
          href: null, // Hidden from tab bar - accessed via Main Menu
        }}
      />
      {/* Settings - accessed from Main Menu */}
      <Tabs.Screen
        name="settings"
        options={{
          href: null, // Hidden from tab bar - accessed via Main Menu
        }}
      />
      <Tabs.Screen
        name="locations"
        options={{
          href: null, // Hide from tab bar - accessed from Profile/Settings
        }}
      />
      {/* Business Dashboard - accessed from Main Menu (non-business users) */}
      <Tabs.Screen
        name="business-dashboard"
        options={{
          href: null, // Hidden from tab bar - accessed via Main Menu
        }}
      />
    </Tabs>
  );
}
