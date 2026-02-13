/**
 * Tab Notifications Context
 * Tracks notification badges for each tab in the navbar
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface TabNotifications {
  calendar: number;
  explore: number;
  recommendations: number; // "For You" feed
  friends: number;
  profile: number;
}

interface TabNotificationsContextType {
  notifications: TabNotifications;
  setTabNotification: (tab: keyof TabNotifications, count: number) => void;
  clearTabNotification: (tab: keyof TabNotifications) => void;
  hasNewRecommendations: boolean;
  setHasNewRecommendations: (value: boolean) => void;
}

const defaultNotifications: TabNotifications = {
  calendar: 0,
  explore: 0,
  recommendations: 0,
  friends: 0,
  profile: 0,
};

const TabNotificationsContext = createContext<TabNotificationsContextType | undefined>(undefined);

export function TabNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<TabNotifications>(defaultNotifications);
  const [hasNewRecommendations, setHasNewRecommendations] = useState(false); // Only show when new recommendations are fetched

  const setTabNotification = useCallback((tab: keyof TabNotifications, count: number) => {
    setNotifications(prev => ({ ...prev, [tab]: count }));
  }, []);

  const clearTabNotification = useCallback((tab: keyof TabNotifications) => {
    setNotifications(prev => ({ ...prev, [tab]: 0 }));
  }, []);

  // Badge will be set to true by the recommendations service when new content is fetched
  // Clear badge when user logs out
  useEffect(() => {
    if (!user) {
      setHasNewRecommendations(false);
    }
  }, [user]);

  return (
    <TabNotificationsContext.Provider
      value={{
        notifications,
        setTabNotification,
        clearTabNotification,
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
