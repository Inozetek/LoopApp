import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GradientIcon } from '@/components/gradient-icon';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

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
      {/* Tab 1: Calendar - Schedule, Loop route view */}
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      {/* Tab 2: Explore - Search, browse, discover */}
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="safari" color={color} />,
        }}
      />
      {/* Tab 3: Daily - AI-curated recommendations (center position) */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <GradientIcon name="sparkles" size={28} focused={focused} />,
        }}
      />
      {/* Tab 4: Friends - Friends' Loops, coordinate, group planning */}
      <Tabs.Screen
        name="friends"
        options={{
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
        }}
      />
      {/* Tab 5: Profile - Settings, preferences, subscription */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
        }}
      />
      {/* Hidden screens (accessible from navigation) */}
      <Tabs.Screen
        name="settings"
        options={{
          href: null, // Hide from tab bar - accessed from Profile
        }}
      />
    </Tabs>
  );
}
