/**
 * Time-Sensitive Boost Algorithm
 *
 * Calculates score boost for activities based on time-sensitivity:
 * - Happy hours active now or soon: +25 points
 * - Events/deals today: +15-20 points
 * - Deals expiring soon: +20 points
 *
 * Only applied in Daily Feed mode (not Explore mode).
 */

import type { UnifiedActivity, YelpDeal } from '@/types/activity';

/**
 * Calculate time-sensitive boost for an activity
 *
 * @param activity Activity to score
 * @returns Boost points to add to base score (0-25)
 */
export function calculateTimeSensitiveBoost(activity: UnifiedActivity): number {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

  let maxBoost = 0;

  // Check Yelp deals (happy hours, specials)
  if (activity.yelp_metadata?.deals) {
    for (const deal of activity.yelp_metadata.deals) {
      const boost = calculateDealBoost(deal, currentHour, currentDay);
      maxBoost = Math.max(maxBoost, boost);
    }
  }

  // Check extracted deals from Google Places editorial summaries
  if (activity.extractedDeals) {
    for (const deal of activity.extractedDeals) {
      const boost = calculateDealBoost(deal, currentHour, currentDay);
      maxBoost = Math.max(maxBoost, boost);
    }
  }

  // Check Groupon deals (always active until expiration)
  if (activity.groupon_metadata) {
    const expiresAt = new Date(activity.groupon_metadata.voucher_expiration);
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilExpiry > 0 && hoursUntilExpiry <= 24) {
      maxBoost = Math.max(maxBoost, 20); // Expires within 24 hours
    } else if (hoursUntilExpiry > 0 && hoursUntilExpiry <= 48) {
      maxBoost = Math.max(maxBoost, 10); // Expires within 48 hours
    }
  }

  // Check event metadata (concerts, shows, etc.)
  if (activity.event_metadata) {
    const eventStart = new Date(activity.event_metadata.start_time);
    const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilEvent >= 0 && hoursUntilEvent <= 3) {
      maxBoost = Math.max(maxBoost, 25); // Event starting very soon
    } else if (hoursUntilEvent > 3 && hoursUntilEvent <= 12) {
      maxBoost = Math.max(maxBoost, 20); // Event today (within 12 hours)
    } else if (hoursUntilEvent > 12 && hoursUntilEvent <= 24) {
      maxBoost = Math.max(maxBoost, 15); // Event today (later)
    } else if (hoursUntilEvent > 24 && hoursUntilEvent <= 48) {
      maxBoost = Math.max(maxBoost, 10); // Event tomorrow
    }
  }

  // Check Songkick events
  if (activity.songkick_metadata) {
    const eventUrl = activity.event_metadata?.start_time;
    if (eventUrl) {
      const eventStart = new Date(eventUrl);
      const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilEvent >= 0 && hoursUntilEvent <= 24) {
        maxBoost = Math.max(maxBoost, 20); // Concert today
      } else if (hoursUntilEvent > 24 && hoursUntilEvent <= 48) {
        maxBoost = Math.max(maxBoost, 10); // Concert tomorrow
      }
    }
  }

  return maxBoost;
}

/**
 * Calculate boost for a specific deal based on current time
 *
 * @param deal Deal information with time window
 * @param currentHour Current hour (0-23)
 * @param currentDay Current day of week (0=Sunday, 6=Saturday)
 * @returns Boost points (0-25)
 */
function calculateDealBoost(
  deal: YelpDeal,
  currentHour: number,
  currentDay: number
): number {
  // Check if deal is valid for today's day of week
  if (deal.days && deal.days.length > 0) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[currentDay];

    if (!deal.days.map(d => d.toLowerCase()).includes(todayName)) {
      return 0; // Deal not active today
    }
  }

  // Parse deal time window
  if (!deal.time_start || !deal.time_end) {
    // No specific time, assume deal is always active
    return 15;
  }

  const dealStartHour = parseTimeToHour(deal.time_start);
  const dealEndHour = parseTimeToHour(deal.time_end);

  // Check if deal is active now or soon
  if (currentHour >= dealStartHour && currentHour < dealEndHour) {
    return 25; // ACTIVE NOW
  } else if (currentHour >= dealStartHour - 2 && currentHour < dealStartHour) {
    return 20; // STARTS IN 1-2 HOURS
  } else if (currentHour >= dealStartHour - 4 && currentHour < dealStartHour) {
    return 15; // STARTS LATER TODAY (within 4 hours)
  }

  return 0; // Not time-sensitive right now
}

/**
 * Parse time string to hour number
 *
 * @param timeStr Time string (e.g., "16:00", "4:00 PM")
 * @returns Hour number (0-23)
 */
function parseTimeToHour(timeStr: string): number {
  // Handle HH:MM format (e.g., "16:00")
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Fallback: try to parse as plain number
  const hour = parseInt(timeStr, 10);
  return isNaN(hour) ? 0 : hour;
}

/**
 * Check if an activity should show "ACTIVE NOW" badge
 *
 * @param activity Activity to check
 * @returns True if active now
 */
export function isActivityActiveNow(activity: UnifiedActivity): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay();

  // Check all deals
  const allDeals = [
    ...(activity.yelp_metadata?.deals || []),
    ...(activity.extractedDeals || []),
  ];

  for (const deal of allDeals) {
    if (isDealActiveNow(deal, currentHour, currentDay)) {
      return true;
    }
  }

  // Check events starting very soon (within 1 hour)
  if (activity.event_metadata) {
    const eventStart = new Date(activity.event_metadata.start_time);
    const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilEvent >= 0 && hoursUntilEvent <= 1) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a deal is currently active
 */
function isDealActiveNow(deal: YelpDeal, currentHour: number, currentDay: number): boolean {
  // Check day of week
  if (deal.days && deal.days.length > 0) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[currentDay];

    if (!deal.days.map(d => d.toLowerCase()).includes(todayName)) {
      return false;
    }
  }

  // Check time window
  if (!deal.time_start || !deal.time_end) {
    return true; // No time restriction
  }

  const dealStartHour = parseTimeToHour(deal.time_start);
  const dealEndHour = parseTimeToHour(deal.time_end);

  return currentHour >= dealStartHour && currentHour < dealEndHour;
}

/**
 * Get hours until a deal starts
 *
 * @param deal Deal information
 * @returns Number of hours until deal starts, or undefined if not applicable
 */
export function getHoursUntilDealStarts(deal: YelpDeal): number | undefined {
  if (!deal.time_start) {
    return undefined;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const dealStartHour = parseTimeToHour(deal.time_start);

  if (dealStartHour > currentHour) {
    return dealStartHour - currentHour;
  }

  return undefined;
}
