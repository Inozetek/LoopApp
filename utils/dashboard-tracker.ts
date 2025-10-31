/**
 * Dashboard Tracker Utility
 * Handles first-load detection and session tracking for daily dashboard
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_DASHBOARD_VIEW_KEY = '@loop/last_dashboard_view';
const DASHBOARD_DISMISSED_TODAY_KEY = '@loop/dashboard_dismissed_today';

/**
 * Check if this is the first load of the app today
 * Uses AsyncStorage as backup to database tracking
 */
export async function isFirstLoadToday(): Promise<boolean> {
  try {
    const lastView = await AsyncStorage.getItem(LAST_DASHBOARD_VIEW_KEY);

    if (!lastView) {
      // Never viewed before
      return true;
    }

    const lastViewDate = new Date(lastView);
    const today = new Date();

    // Check if last view was on a different day
    return lastViewDate.toDateString() !== today.toDateString();
  } catch (error) {
    console.error('❌ Error checking first load:', error);
    // Default to showing dashboard if error
    return true;
  }
}

/**
 * Mark dashboard as viewed today
 */
export async function markDashboardViewedToday(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_DASHBOARD_VIEW_KEY, new Date().toISOString());
    console.log('✅ Dashboard marked as viewed in AsyncStorage');
  } catch (error) {
    console.error('❌ Error marking dashboard viewed:', error);
  }
}

/**
 * Check if dashboard was dismissed today (user closed it)
 */
export async function wasDashboardDismissedToday(): Promise<boolean> {
  try {
    const dismissedDate = await AsyncStorage.getItem(DASHBOARD_DISMISSED_TODAY_KEY);

    if (!dismissedDate) {
      return false;
    }

    const dismissed = new Date(dismissedDate);
    const today = new Date();

    return dismissed.toDateString() === today.toDateString();
  } catch (error) {
    console.error('❌ Error checking dashboard dismissal:', error);
    return false;
  }
}

/**
 * Mark dashboard as dismissed today
 */
export async function markDashboardDismissedToday(): Promise<void> {
  try {
    await AsyncStorage.setItem(DASHBOARD_DISMISSED_TODAY_KEY, new Date().toISOString());
    console.log('✅ Dashboard marked as dismissed today');
  } catch (error) {
    console.error('❌ Error marking dashboard dismissed:', error);
  }
}

/**
 * Reset dashboard state (for testing or debugging)
 */
export async function resetDashboardState(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([LAST_DASHBOARD_VIEW_KEY, DASHBOARD_DISMISSED_TODAY_KEY]);
    console.log('✅ Dashboard state reset');
  } catch (error) {
    console.error('❌ Error resetting dashboard state:', error);
  }
}

/**
 * Get last dashboard view timestamp
 */
export async function getLastDashboardView(): Promise<Date | null> {
  try {
    const lastView = await AsyncStorage.getItem(LAST_DASHBOARD_VIEW_KEY);
    return lastView ? new Date(lastView) : null;
  } catch (error) {
    console.error('❌ Error getting last dashboard view:', error);
    return null;
  }
}

/**
 * Check if user should see dashboard now
 * Combines first-load check with dismissal check
 */
export async function shouldShowDashboardNow(): Promise<boolean> {
  const isFirstLoad = await isFirstLoadToday();
  const wasDismissed = await wasDashboardDismissedToday();

  // Show dashboard if:
  // 1. It's first load today AND
  // 2. User hasn't dismissed it today
  return isFirstLoad && !wasDismissed;
}
