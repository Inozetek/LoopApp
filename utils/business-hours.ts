/**
 * Business Hours Utility
 *
 * Handles business hours validation, estimation, and scheduling logic
 */

export interface BusinessHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export interface DayHours {
  open: string; // HH:MM format (24-hour)
  close: string; // HH:MM format (24-hour)
  isClosed?: boolean;
}

export interface BusinessHoursInfo {
  hours: BusinessHours;
  isEstimated: boolean;
  source: 'google' | 'estimated';
}

/**
 * Default business hours by category
 * Based on typical operating hours for each business type
 */
const DEFAULT_HOURS_BY_CATEGORY: Record<string, BusinessHours> = {
  // Food & Drink
  restaurant: {
    monday: { open: '11:00', close: '22:00' },
    tuesday: { open: '11:00', close: '22:00' },
    wednesday: { open: '11:00', close: '22:00' },
    thursday: { open: '11:00', close: '22:00' },
    friday: { open: '11:00', close: '23:00' },
    saturday: { open: '11:00', close: '23:00' },
    sunday: { open: '11:00', close: '21:00' },
  },
  cafe: {
    monday: { open: '07:00', close: '18:00' },
    tuesday: { open: '07:00', close: '18:00' },
    wednesday: { open: '07:00', close: '18:00' },
    thursday: { open: '07:00', close: '18:00' },
    friday: { open: '07:00', close: '18:00' },
    saturday: { open: '08:00', close: '17:00' },
    sunday: { open: '08:00', close: '17:00' },
  },
  bar: {
    monday: { open: '16:00', close: '02:00' }, // 4pm - 2am next day
    tuesday: { open: '16:00', close: '02:00' },
    wednesday: { open: '16:00', close: '02:00' },
    thursday: { open: '16:00', close: '02:00' },
    friday: { open: '16:00', close: '03:00' },
    saturday: { open: '14:00', close: '03:00' },
    sunday: { open: '14:00', close: '00:00' },
  },

  // Shopping
  store: {
    monday: { open: '09:00', close: '20:00' },
    tuesday: { open: '09:00', close: '20:00' },
    wednesday: { open: '09:00', close: '20:00' },
    thursday: { open: '09:00', close: '20:00' },
    friday: { open: '09:00', close: '21:00' },
    saturday: { open: '09:00', close: '21:00' },
    sunday: { open: '10:00', close: '19:00' },
  },
  shopping_mall: {
    monday: { open: '10:00', close: '21:00' },
    tuesday: { open: '10:00', close: '21:00' },
    wednesday: { open: '10:00', close: '21:00' },
    thursday: { open: '10:00', close: '21:00' },
    friday: { open: '10:00', close: '21:00' },
    saturday: { open: '10:00', close: '21:00' },
    sunday: { open: '11:00', close: '19:00' },
  },

  // Entertainment
  movie_theater: {
    monday: { open: '10:00', close: '23:00' },
    tuesday: { open: '10:00', close: '23:00' },
    wednesday: { open: '10:00', close: '23:00' },
    thursday: { open: '10:00', close: '23:00' },
    friday: { open: '10:00', close: '01:00' },
    saturday: { open: '10:00', close: '01:00' },
    sunday: { open: '10:00', close: '23:00' },
  },
  museum: {
    monday: { isClosed: true },
    tuesday: { open: '10:00', close: '17:00' },
    wednesday: { open: '10:00', close: '17:00' },
    thursday: { open: '10:00', close: '17:00' },
    friday: { open: '10:00', close: '17:00' },
    saturday: { open: '10:00', close: '18:00' },
    sunday: { open: '10:00', close: '18:00' },
  },

  // Recreation
  gym: {
    monday: { open: '05:00', close: '23:00' },
    tuesday: { open: '05:00', close: '23:00' },
    wednesday: { open: '05:00', close: '23:00' },
    thursday: { open: '05:00', close: '23:00' },
    friday: { open: '05:00', close: '22:00' },
    saturday: { open: '07:00', close: '20:00' },
    sunday: { open: '07:00', close: '20:00' },
  },
  park: {
    // Parks are typically open sunrise to sunset, using generous hours
    monday: { open: '06:00', close: '22:00' },
    tuesday: { open: '06:00', close: '22:00' },
    wednesday: { open: '06:00', close: '22:00' },
    thursday: { open: '06:00', close: '22:00' },
    friday: { open: '06:00', close: '22:00' },
    saturday: { open: '06:00', close: '22:00' },
    sunday: { open: '06:00', close: '22:00' },
  },

  // Services
  library: {
    monday: { open: '09:00', close: '20:00' },
    tuesday: { open: '09:00', close: '20:00' },
    wednesday: { open: '09:00', close: '20:00' },
    thursday: { open: '09:00', close: '20:00' },
    friday: { open: '09:00', close: '18:00' },
    saturday: { open: '10:00', close: '17:00' },
    sunday: { open: '12:00', close: '17:00' },
  },

  // Default fallback
  default: {
    monday: { open: '09:00', close: '18:00' },
    tuesday: { open: '09:00', close: '18:00' },
    wednesday: { open: '09:00', close: '18:00' },
    thursday: { open: '09:00', close: '18:00' },
    friday: { open: '09:00', close: '18:00' },
    saturday: { open: '10:00', close: '17:00' },
    sunday: { isClosed: true },
  },
};

/**
 * Parse Google Places opening_hours.periods format into our BusinessHours format
 */
export function parseGoogleHours(periods?: any[]): BusinessHours | null {
  if (!periods || periods.length === 0) return null;

  const hours: BusinessHours = {};
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

  periods.forEach(period => {
    const dayIndex = period.open?.day ?? 0;
    const dayName = dayNames[dayIndex];

    if (period.open && period.close) {
      hours[dayName] = {
        open: formatGoogleTime(period.open.time),
        close: formatGoogleTime(period.close.time),
      };
    } else if (period.open && !period.close) {
      // Open 24 hours
      hours[dayName] = {
        open: '00:00',
        close: '23:59',
      };
    }
  });

  return Object.keys(hours).length > 0 ? hours : null;
}

/**
 * Format Google time (e.g., "1430") to HH:MM format
 */
function formatGoogleTime(time: string): string {
  if (!time || time.length !== 4) return '00:00';
  return `${time.substring(0, 2)}:${time.substring(2, 4)}`;
}

/**
 * Get business hours with fallback to estimated hours
 */
export function getBusinessHours(
  googleHours?: any,
  category?: string
): BusinessHoursInfo {
  // Try to parse Google hours first
  const parsedHours = googleHours?.periods ? parseGoogleHours(googleHours.periods) : null;

  if (parsedHours) {
    return {
      hours: parsedHours,
      isEstimated: false,
      source: 'google',
    };
  }

  // Fall back to estimated hours based on category
  const normalizedCategory = category?.toLowerCase().replace(/\s+/g, '_') || 'default';
  const estimatedHours = DEFAULT_HOURS_BY_CATEGORY[normalizedCategory] || DEFAULT_HOURS_BY_CATEGORY.default;

  return {
    hours: estimatedHours,
    isEstimated: true,
    source: 'estimated',
  };
}

/**
 * Check if a business is open at a specific date/time
 */
export function isOpenAt(hours: BusinessHours, dateTime: Date): boolean {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const dayName = dayNames[dateTime.getDay()];
  const dayHours = hours[dayName];

  if (!dayHours || dayHours.isClosed) return false;

  const currentTime = `${String(dateTime.getHours()).padStart(2, '0')}:${String(dateTime.getMinutes()).padStart(2, '0')}`;

  // Handle closing times after midnight (e.g., bar closes at 2am)
  if (dayHours.close < dayHours.open) {
    // Open time is today, close time is tomorrow
    return currentTime >= dayHours.open || currentTime <= dayHours.close;
  }

  return currentTime >= dayHours.open && currentTime <= dayHours.close;
}

/**
 * Get the next available opening time for a business
 * Returns null if business is currently open
 */
export function getNextOpeningTime(hours: BusinessHours, fromTime: Date = new Date()): Date | null {
  if (isOpenAt(hours, fromTime)) {
    return null; // Already open
  }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

  // Check next 7 days
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(fromTime);
    checkDate.setDate(checkDate.getDate() + i);

    const dayName = dayNames[checkDate.getDay()];
    const dayHours = hours[dayName];

    if (dayHours && !dayHours.isClosed) {
      const [openHour, openMinute] = dayHours.open.split(':').map(Number);
      const openingTime = new Date(checkDate);
      openingTime.setHours(openHour, openMinute, 0, 0);

      if (openingTime > fromTime) {
        return openingTime;
      }
    }
  }

  return null; // Couldn't find opening time in next 7 days
}

/**
 * Suggest best time to visit based on business hours and user preferences
 */
export function suggestVisitTime(
  hours: BusinessHours,
  preferredTime?: 'morning' | 'afternoon' | 'evening',
  fromTime: Date = new Date()
): Date {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

  // Try today first
  const todayName = dayNames[fromTime.getDay()];
  const todayHours = hours[todayName];

  if (todayHours && !todayHours.isClosed) {
    const [openHour] = todayHours.open.split(':').map(Number);
    const [closeHour] = todayHours.close.split(':').map(Number);

    let suggestedHour = openHour + 1; // Default: 1 hour after opening

    if (preferredTime === 'morning') {
      suggestedHour = Math.max(openHour, 9); // 9am or opening time
    } else if (preferredTime === 'afternoon') {
      suggestedHour = Math.max(openHour, 14); // 2pm or opening time
    } else if (preferredTime === 'evening') {
      suggestedHour = Math.min(closeHour - 2, 19); // 7pm or 2hrs before close
    }

    const suggestedTime = new Date(fromTime);
    suggestedTime.setHours(suggestedHour, 0, 0, 0);

    // Make sure it's actually during business hours
    if (isOpenAt(hours, suggestedTime)) {
      return suggestedTime;
    }
  }

  // Fall back to next opening time
  return getNextOpeningTime(hours, fromTime) || fromTime;
}

/**
 * Format business hours for display
 */
export function formatBusinessHours(dayHours: DayHours | undefined): string {
  if (!dayHours) return 'Hours unavailable';
  if (dayHours.isClosed) return 'Closed';

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
  };

  return `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}`;
}

/**
 * Get today's hours for display
 */
export function getTodayHours(hours: BusinessHours, date: Date = new Date()): DayHours | undefined {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const dayName = dayNames[date.getDay()];
  return hours[dayName];
}
