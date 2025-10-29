/**
 * Calendar constants, category colors, and utilities
 */

import { BrandColors } from './brand';

export const CATEGORY_COLORS = {
  work: '#0066FF',      // Loop Blue
  personal: '#00D9A3',  // Loop Green
  social: '#FF3B6C',    // Like/Heart red
  dining: '#FF9500',    // Warning orange
  fitness: '#00D9A3',   // Green
  entertainment: '#9C27B0', // Purple
  travel: '#2196F3',    // Sky blue
  other: '#8E8E93',     // Gray
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
