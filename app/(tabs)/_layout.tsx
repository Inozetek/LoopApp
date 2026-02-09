import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { GradientIcon } from '@/components/gradient-icon';
import { AnimatedTabIcon } from '@/components/animated-tab-icon';
import { Colors } from '@/constants/theme';
import { BrandColors } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const isBusiness = user?.account_type === 'business';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.icon,
        tabBarShowLabel: false, // Icons only - no text labels
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.icon + '20',
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      {/* === Personal Tabs === */}
      {/* Tab 1: Calendar - Schedule, Loop route view */}
      <Tabs.Screen
        name="calendar"
        options={{
          href: isBusiness ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name="calendar"
              size={26}
              color={focused ? BrandColors.loopBlue : color}
              focused={focused}
            />
          ),
        }}
      />
      {/* Tab 2: Explore - Search, browse, discover */}
      <Tabs.Screen
        name="explore"
        options={{
          href: isBusiness ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name="magnifyingglass"
              size={26}
              color={focused ? BrandColors.loopBlue : color}
              focused={focused}
            />
          ),
        }}
      />
      {/* Tab 3: Daily - AI-curated recommendations (center position - special gradient) */}
      <Tabs.Screen
        name="index"
        options={{
          href: isBusiness ? null : undefined,
          tabBarIcon: ({ focused }) => <GradientIcon name="sparkles" size={30} focused={focused} />,
        }}
      />
      {/* Tab 4: Friends - Friends' Loops, coordinate, group planning */}
      <Tabs.Screen
        name="friends"
        options={{
          href: isBusiness ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name="person.2.fill"
              size={26}
              color={focused ? BrandColors.loopBlue : color}
              focused={focused}
            />
          ),
        }}
      />
      {/* Tab 5: Profile - Settings, preferences, subscription */}
      <Tabs.Screen
        name="profile"
        options={{
          href: isBusiness ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name="person.fill"
              size={24}
              color={focused ? BrandColors.loopBlue : color}
              focused={focused}
            />
          ),
        }}
      />

      {/* === Business Tabs === */}
      {/* Business Tab 1: Dashboard - Overview metrics */}
      <Tabs.Screen
        name="dashboard"
        options={{
          href: isBusiness ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name="house.fill"
              size={26}
              color={focused ? BrandColors.loopBlue : color}
              focused={focused}
            />
          ),
        }}
      />
      {/* Business Tab 2: Listing - Manage business listing */}
      <Tabs.Screen
        name="listing"
        options={{
          href: isBusiness ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name="pencil"
              size={26}
              color={focused ? BrandColors.loopGreen : color}
              focused={focused}
            />
          ),
        }}
      />
      {/* Business Tab 3: Analytics - Detailed analytics */}
      <Tabs.Screen
        name="analytics"
        options={{
          href: isBusiness ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name="chart.bar.fill"
              size={26}
              color={focused ? BrandColors.loopOrange : color}
              focused={focused}
            />
          ),
        }}
      />

      {/* Hidden screens (accessible from navigation) */}
      <Tabs.Screen
        name="settings"
        options={{
          href: isBusiness ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name="gearshape.fill"
              size={24}
              color={focused ? BrandColors.loopBlue : color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="locations"
        options={{
          href: null, // Hide from tab bar - accessed from Profile/Settings
        }}
      />
    </Tabs>
  );
}
