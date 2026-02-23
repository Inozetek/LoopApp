/**
 * Gemini API Quota Tracker
 * Monitors usage of the free Gemini 2.0 Flash tier to prevent overuse.
 *
 * Free tier: 1,500 requests/day. We apply a conservative monthly cap
 * (1,500 requests/month) since city seeds only happen every 60 days.
 *
 * Auto-resets when the stored month differs from the current month.
 * When at limit, returns false — callers fall back to template explanations.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const MONTHLY_REQUEST_LIMIT = 1500;

const STORAGE_KEY_REQUEST_COUNT = 'gemini_request_count';
const STORAGE_KEY_MONTH_YEAR = 'gemini_month_year';

/**
 * Get current month-year string (YYYY-MM)
 */
function getCurrentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Check if we can make a Gemini API request (within monthly quota)
 */
export async function canMakeGeminiRequest(): Promise<boolean> {
  try {
    const currentMonth = getCurrentMonthYear();
    const storedMonth = await AsyncStorage.getItem(STORAGE_KEY_MONTH_YEAR);

    // New month — reset counter
    if (storedMonth !== currentMonth) {
      await AsyncStorage.setItem(STORAGE_KEY_MONTH_YEAR, currentMonth);
      await AsyncStorage.setItem(STORAGE_KEY_REQUEST_COUNT, '0');
      console.log('🔄 Gemini quota: New month detected, counter reset');
      return true;
    }

    const countStr = await AsyncStorage.getItem(STORAGE_KEY_REQUEST_COUNT) || '0';
    const count = parseInt(countStr, 10);

    if (count >= MONTHLY_REQUEST_LIMIT) {
      console.warn(`⚠️ Gemini quota: Monthly limit reached (${count}/${MONTHLY_REQUEST_LIMIT}). Skipping AI descriptions.`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking Gemini quota:', error);
    return true; // Default to allowing if tracking fails
  }
}

/**
 * Track a successful Gemini API request
 */
export async function trackGeminiRequest(): Promise<void> {
  try {
    const currentMonth = getCurrentMonthYear();
    const storedMonth = await AsyncStorage.getItem(STORAGE_KEY_MONTH_YEAR);

    // Ensure month is current
    if (storedMonth !== currentMonth) {
      await AsyncStorage.setItem(STORAGE_KEY_MONTH_YEAR, currentMonth);
      await AsyncStorage.setItem(STORAGE_KEY_REQUEST_COUNT, '1');
      return;
    }

    const countStr = await AsyncStorage.getItem(STORAGE_KEY_REQUEST_COUNT) || '0';
    const newCount = parseInt(countStr, 10) + 1;
    await AsyncStorage.setItem(STORAGE_KEY_REQUEST_COUNT, String(newCount));

    console.log(`✅ Gemini request tracked: ${newCount}/${MONTHLY_REQUEST_LIMIT} this month`);
  } catch (error) {
    console.error('Error tracking Gemini request:', error);
  }
}

/**
 * Get current Gemini usage stats
 */
export async function getGeminiUsageStats(): Promise<{
  requestCount: number;
  monthlyLimit: number;
  percentUsed: number;
  remainingRequests: number;
  monthYear: string;
}> {
  try {
    const countStr = await AsyncStorage.getItem(STORAGE_KEY_REQUEST_COUNT) || '0';
    const monthYear = await AsyncStorage.getItem(STORAGE_KEY_MONTH_YEAR) || getCurrentMonthYear();

    const requestCount = parseInt(countStr, 10);
    const percentUsed = (requestCount / MONTHLY_REQUEST_LIMIT) * 100;
    const remainingRequests = Math.max(0, MONTHLY_REQUEST_LIMIT - requestCount);

    return {
      requestCount,
      monthlyLimit: MONTHLY_REQUEST_LIMIT,
      percentUsed,
      remainingRequests,
      monthYear,
    };
  } catch (error) {
    console.error('Error getting Gemini usage stats:', error);
    return {
      requestCount: 0,
      monthlyLimit: MONTHLY_REQUEST_LIMIT,
      percentUsed: 0,
      remainingRequests: MONTHLY_REQUEST_LIMIT,
      monthYear: getCurrentMonthYear(),
    };
  }
}

/**
 * Reset Gemini usage counter (for testing)
 */
export async function resetGeminiUsageCounter(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_REQUEST_COUNT, '0');
  await AsyncStorage.setItem(STORAGE_KEY_MONTH_YEAR, getCurrentMonthYear());
  console.log('🔄 Gemini usage counter manually reset');
}
