/**
 * Calendar constants, category colors, and utilities
 */

import { BrandColors, CategoryColors } from './brand';

export const CATEGORY_COLORS: Record<string, string> = {
  work: CategoryColors.work,             // #6366F1 (Indigo)
  personal: CategoryColors.personal,     // #F59E0B (Orange)
  social: CategoryColors.social,         // #8B5CF6 (Purple)
  dining: CategoryColors.dining,         // #EF4444 (Red)
  fitness: CategoryColors.fitness,       // #09DB98 (Green)
  entertainment: CategoryColors.entertainment, // #00A6D9 (Blue)
  travel: CategoryColors.travel,         // #14B8A6 (Teal)
  other: CategoryColors.other,           // #8E8E93 (Gray)
};

export const CATEGORY_ICONS = {
  work: '💼',
  personal: '✨',
  social: '👥',
  dining: '🍽️',
  fitness: '💪',
  entertainment: '🎭',
  travel: '✈️',
  other: '📌',
};

export const CATEGORY_LABELS = {
  work: 'Work',
  personal: 'Personal',
  social: 'Social',
  dining: 'Dining',
  fitness: 'Fitness',
  entertainment: 'Entertainment',
  travel: 'Travel',
  other: 'Other',
};

export type EventCategory = keyof typeof CATEGORY_COLORS;

export const CATEGORIES = Object.keys(CATEGORY_COLORS) as EventCategory[];

export interface MarkedDate {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
  selectedTextColor?: string;
  disabled?: boolean;
  disableTouchEvent?: boolean;
  activeOpacity?: number;
  dots?: Array<{
    key: string;
    color: string;
    selectedDotColor?: string;
  }>;
  /** Number of events beyond the 3 visible dots (shown as "+N" badge) */
  extraCount?: number;
}

export interface EventWithColor {
  id: string;
  title: string;
  category: EventCategory | null;
  startTime: Date;
  endTime: Date;
  color: string;
  icon: string;
  address: string;
  description?: string;
}
