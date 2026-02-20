/**
 * Tab Notifications Context
 *
 * Tracks badge state for each tab in the navbar.
 * Each tab has a composite badge: { count, dot }.
 * - count (red badge): actionable items needing user response
 * - dot (blue dot): new content available
 * Red count supersedes blue dot in rendering.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { TabBadgeState, TabBadges } from '@/utils/notification-routing';

interface TabNotifications {
  calendar: TabBadgeState;
  explore: TabBadgeState;
  recommendations: TabBadgeState;
  friends: TabBadgeState;
  profile: TabBadgeState;
}

interface TabNotificationsContextType {
  notifications: TabNotifications;
  /** Set full badge state for a tab */
  setTabBadge: (tab: keyof TabNotifications, badge: TabBadgeState) => void;
  /** Clear all badges for a tab */
  clearTabBadge: (tab: keyof TabNotifications) => void;
  /** Backwards-compat: set a count-only badge */
  setTabNotification: (tab: keyof TabNotifications, count: number) => void;
  /** Backwards-compat: clear badge */
  clearTabNotification: (tab: keyof TabNotifications) => void;
  /** Apply computed badges from notification-routing */
  applyBadges: (badges: TabBadges) => void;
  /** Whether new recommendations are available (drives For You dot) */
  hasNewRecommendations: boolean;
  setHasNewRecommendations: (value: boolean) => void;
}

const EMPTY_BADGE: TabBadgeState = { count: 0, dot: false };

const defaultNotifications: TabNotifications = {
  calendar: { ...EMPTY_BADGE },
  explore: { ...EMPTY_BADGE },
  recommendations: { ...EMPTY_BADGE },
  friends: { ...EMPTY_BADGE },
  profile: { ...EMPTY_BADGE },
};

const TabNotificationsContext = createContext<TabNotificationsContextType | undefined>(undefined);

export function TabNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<TabNotifications>({ ...defaultNotifications });
  const [hasNewRecommendations, setHasNewRecommendations] = useState(false);

  const setTabBadge = useCallback((tab: keyof TabNotifications, badge: TabBadgeState) => {
    setNotifications(prev => ({ ...prev, [tab]: badge }));
  }, []);

  const clearTabBadge = useCallback((tab: keyof TabNotifications) => {
    setNotifications(prev => ({ ...prev, [tab]: { count: 0, dot: false } }));
  }, []);

  // Backwards-compat wrappers
  const setTabNotification = useCallback((tab: keyof TabNotifications, count: number) => {
    setNotifications(prev => ({ ...prev, [tab]: { ...prev[tab], count } }));
  }, []);

  const clearTabNotification = useCallback((tab: keyof TabNotifications) => {
    setNotifications(prev => ({ ...prev, [tab]: { count: 0, dot: false } }));
  }, []);

  const applyBadges = useCallback((badges: TabBadges) => {
    setNotifications(prev => ({
      ...prev,
      calendar: badges.calendar,
      recommendations: badges.recommendations,
      friends: badges.friends,
      profile: badges.profile,
    }));
  }, []);

  // Clear on logout
  useEffect(() => {
    if (!user) {
      setNotifications({ ...defaultNotifications });
      setHasNewRecommendations(false);
    }
  }, [user]);

  return (
    <TabNotificationsContext.Provider
      value={{
        notifications,
        setTabBadge,
        clearTabBadge,
        setTabNotification,
        clearTabNotification,
        applyBadges,
        hasNewRecommendations,
        setHasNewRecommendations,
      }}
    >
      {children}
    </TabNotificationsContext.Provider>
  );
}

export function useTabNotifications() {
  const context = useContext(TabNotificationsContext);
  if (context === undefined) {
    throw new Error('useTabNotifications must be used within a TabNotificationsProvider');
  }
  return context;
}
