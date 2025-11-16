/**
 * Google Places API Cost Tracker
 * Monitors API usage and warns before hitting free tier limits
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Cost constants (in cents)
const COST_PER_NEARBY_SEARCH = 1.7; // $0.017 per request with our field mask
const COST_PER_TEXT_SEARCH = 1.7; // $0.017 per request (same as nearby search)
const FREE_TIER_MONTHLY_CREDIT = 20000; // $200 in cents
const WARNING_THRESHOLD_PERCENT = 50; // Warn at 50% usage
const DANGER_THRESHOLD_PERCENT = 80; // Critical warning at 80%

// Storage keys
const STORAGE_KEY_REQUEST_COUNT = 'google_places_request_count';
const STORAGE_KEY_MONTH_YEAR = 'google_places_month_year';
const STORAGE_KEY_TOTAL_COST = 'google_places_total_cost';

/**
 * Get current month-year string (YYYY-MM)
 */
function getCurrentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Track a Google Places API request
 * Call this BEFORE making the API call
 */
export async function trackPlacesAPIRequest(requestType: 'nearby_search' | 'text_search' | 'place_details' | 'photo' = 'nearby_search'): Promise<boolean> {
  try {
    const currentMonth = getCurrentMonthYear();
    const storedMonth = await AsyncStorage.getItem(STORAGE_KEY_MONTH_YEAR);

    // Reset counter if new month
    if (storedMonth !== currentMonth) {
      await AsyncStorage.setItem(STORAGE_KEY_MONTH_YEAR, currentMonth);
      await AsyncStorage.setItem(STORAGE_KEY_REQUEST_COUNT, '0');
      await AsyncStorage.setItem(STORAGE_KEY_TOTAL_COST, '0');
      console.log('🔄 New month detected - API usage counter reset');
    }

    // Get current count
    const countStr = await AsyncStorage.getItem(STORAGE_KEY_REQUEST_COUNT) || '0';
    const count = parseInt(countStr, 10);

    // Get current cost
    const costStr = await AsyncStorage.getItem(STORAGE_KEY_TOTAL_COST) || '0';
    const totalCost = parseFloat(costStr);

    // Calculate new cost
    let requestCost = 0;
    if (requestType === 'nearby_search') {
      requestCost = COST_PER_NEARBY_SEARCH;
    } else if (requestType === 'text_search') {
      requestCost = COST_PER_TEXT_SEARCH;
    }
    const newCount = count + 1;
    const newTotalCost = totalCost + requestCost;

    // Check if we should block the request
    const percentUsed = (newTotalCost / FREE_TIER_MONTHLY_CREDIT) * 100;

    if (percentUsed >= 95) {
      console.error('🚨 BLOCKED: 95% of free tier used! Blocking API request to prevent charges.');
      console.error(`💸 Current usage: $${(newTotalCost / 100).toFixed(2)} / $${FREE_TIER_MONTHLY_CREDIT / 100} free tier`);
      return false; // Block request
    }

    // Save new count and cost
    await AsyncStorage.setItem(STORAGE_KEY_REQUEST_COUNT, String(newCount));
    await AsyncStorage.setItem(STORAGE_KEY_TOTAL_COST, String(newTotalCost));

    // Display warnings
    if (percentUsed >= DANGER_THRESHOLD_PERCENT) {
      console.warn('⚠️ DANGER: 80%+ of free tier used!');
      console.warn(`💸 Current usage: $${(newTotalCost / 100).toFixed(2)} / $${FREE_TIER_MONTHLY_CREDIT / 100} free tier`);
      console.warn(`📊 Requests this month: ${newCount}`);
      console.warn(`🚨 You have ~${Math.floor((FREE_TIER_MONTHLY_CREDIT - newTotalCost) / COST_PER_NEARBY_SEARCH)} requests left before charges!`);
    } else if (percentUsed >= WARNING_THRESHOLD_PERCENT) {
      console.warn('⚠️ WARNING: 50%+ of free tier used');
      console.warn(`💸 Current usage: $${(newTotalCost / 100).toFixed(2)} / $${FREE_TIER_MONTHLY_CREDIT / 100} free tier`);
      console.warn(`📊 Requests this month: ${newCount}`);
    } else {
      console.log(`✅ API request tracked: ${newCount} requests, $${(newTotalCost / 100).toFixed(2)} used (${percentUsed.toFixed(1)}% of free tier)`);
    }

    return true; // Allow request

  } catch (error) {
    console.error('Error tracking API request:', error);
    return true; // Default to allowing request if tracking fails
  }
}

/**
 * Get current API usage stats
 */
export async function getAPIUsageStats(): Promise<{
  requestCount: number;
  totalCostCents: number;
  percentUsed: number;
  remainingCredit: number;
  monthYear: string;
}> {
  try {
    const countStr = await AsyncStorage.getItem(STORAGE_KEY_REQUEST_COUNT) || '0';
    const costStr = await AsyncStorage.getItem(STORAGE_KEY_TOTAL_COST) || '0';
    const monthYear = await AsyncStorage.getItem(STORAGE_KEY_MONTH_YEAR) || getCurrentMonthYear();

    const requestCount = parseInt(countStr, 10);
    const totalCostCents = parseFloat(costStr);
    const percentUsed = (totalCostCents / FREE_TIER_MONTHLY_CREDIT) * 100;
    const remainingCredit = FREE_TIER_MONTHLY_CREDIT - totalCostCents;

    return {
      requestCount,
      totalCostCents,
      percentUsed,
      remainingCredit,
      monthYear,
    };
  } catch (error) {
    console.error('Error getting API usage stats:', error);
    return {
      requestCount: 0,
      totalCostCents: 0,
      percentUsed: 0,
      remainingCredit: FREE_TIER_MONTHLY_CREDIT,
      monthYear: getCurrentMonthYear(),
    };
  }
}

/**
 * Reset API usage counter (for testing or manual reset)
 */
export async function resetAPIUsageCounter(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_REQUEST_COUNT, '0');
  await AsyncStorage.setItem(STORAGE_KEY_TOTAL_COST, '0');
  await AsyncStorage.setItem(STORAGE_KEY_MONTH_YEAR, getCurrentMonthYear());
  console.log('🔄 API usage counter manually reset');
}

/**
 * Display usage summary in console
 */
export async function logAPIUsageSummary(): Promise<void> {
  const stats = await getAPIUsageStats();

  console.log('\n📊 === Google Places API Usage Summary ===');
  console.log(`📅 Month: ${stats.monthYear}`);
  console.log(`🔢 Total Requests: ${stats.requestCount}`);
  console.log(`💰 Total Cost: $${(stats.totalCostCents / 100).toFixed(2)}`);
  console.log(`📊 Free Tier Used: ${stats.percentUsed.toFixed(1)}%`);
  console.log(`💵 Remaining Credit: $${(stats.remainingCredit / 100).toFixed(2)}`);

  if (stats.percentUsed >= 80) {
    console.log('🚨 Status: DANGER - Approaching limit!');
  } else if (stats.percentUsed >= 50) {
    console.log('⚠️  Status: WARNING - Monitor usage');
  } else {
    console.log('✅ Status: Safe');
  }
  console.log('==========================================\n');
}
