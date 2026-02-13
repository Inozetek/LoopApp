/**
 * Countdown Badge Component
 * Shows time remaining with urgency-based styling
 * Inspired by Android Time-Sensitive Notifications
 */

import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, BrandColors } from '@/constants/brand';

type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

interface CountdownBadgeProps {
  deadline: Date;
  prefix?: string; // e.g., "Respond in", "Starts in"
  showIcon?: boolean;
  onExpire?: () => void;
}

const getUrgencyLevel = (deadline: Date): UrgencyLevel => {
  const hoursRemaining = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursRemaining <= 0) return 'none';
  if (hoursRemaining <= 1) return 'critical';
  if (hoursRemaining <= 3) return 'high';
  if (hoursRemaining <= 12) return 'medium';
  if (hoursRemaining <= 24) return 'low';
  return 'none';
};

const getUrgencyStyle = (level: UrgencyLevel) => {
  switch (level) {
    case 'critical':
      return {
        backgroundColor: BrandColors.error,
        textColor: '#FFFFFF',
        borderColor: BrandColors.error,
        animate: true,
      };
    case 'high':
      return {
        backgroundColor: BrandColors.warning,
        textColor: '#000000',
        borderColor: BrandColors.warning,
        animate: false,
      };
    case 'medium':
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        textColor: BrandColors.warning,
        borderColor: BrandColors.warning,
        animate: false,
      };
    case 'low':
      return {
        backgroundColor: 'rgba(0, 166, 217, 0.15)',
        textColor: BrandColors.loopBlue,
        borderColor: BrandColors.loopBlue,
        animate: false,
      };
    default:
      return null;
  }
};

const formatTimeLeft = (deadline: Date): string => {
  const now = Date.now();
  const diff = deadline.getTime() - now;

  if (diff <= 0) return 'Expired';

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return '<1m';
  }
};

/**
 * Format deadline in natural language (Outlook-inspired)
 * Examples: "by 7pm", "4h left", "by Sat"
 */
const formatDeadlineNatural = (deadline: Date): string => {
  const now = new Date();
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursLeft <= 0) return 'Expired';
  if (hoursLeft <= 1) return `${Math.round(hoursLeft * 60)}m left`;
  if (hoursLeft <= 6) return `${Math.round(hoursLeft)}h left`;

  // Show actual time for same day
  if (deadline.toDateString() === now.toDateString()) {
    return `by ${deadline.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: deadline.getMinutes() > 0 ? '2-digit' : undefined,
      hour12: true,
    }).toLowerCase()}`;
  }

  // Tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (deadline.toDateString() === tomorrow.toDateString()) {
    return `by tomorrow ${deadline.toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true,
    }).toLowerCase()}`;
  }

  // Show weekday for this week
  return `by ${deadline.toLocaleDateString('en-US', { weekday: 'short' })}`;
};

export function CountdownBadge({
  deadline,
  prefix = 'Respond in',
  showIcon = true,
  onExpire,
}: CountdownBadgeProps) {
  const [timeLeft, setTimeLeft] = useState(formatTimeLeft(deadline));
  const [urgency, setUrgency] = useState<UrgencyLevel>(getUrgencyLevel(deadline));

  // Pulse animation for critical urgency
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      const newTimeLeft = formatTimeLeft(deadline);
      const newUrgency = getUrgencyLevel(deadline);

      setTimeLeft(newTimeLeft);
      setUrgency(newUrgency);

      if (newTimeLeft === 'Expired') {
        clearInterval(interval);
        onExpire?.();
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  // Pulse animation for critical items
  useEffect(() => {
    if (urgency === 'critical') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [urgency, pulseAnim]);

  const style = getUrgencyStyle(urgency);

  if (!style || urgency === 'none') {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          opacity: pulseAnim,
        },
      ]}
    >
      {showIcon && (
        <Ionicons
          name="time"
          size={14}
          color={style.textColor}
        />
      )}
      <Text style={[styles.text, { color: style.textColor }]}>
        {prefix} {timeLeft}
      </Text>
    </Animated.View>
  );
}

// Urgency header variant for card top (inside card with matching border radius)
export function UrgencyHeader({
  deadline,
  prefix = 'Respond',
}: {
  deadline: Date;
  prefix?: string;
}) {
  const [timeDisplay, setTimeDisplay] = useState(formatDeadlineNatural(deadline));
  const urgency = getUrgencyLevel(deadline);
  const style = getUrgencyStyle(urgency);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeDisplay(formatDeadlineNatural(deadline));
    }, 60000);
    return () => clearInterval(interval);
  }, [deadline]);

  useEffect(() => {
    if (urgency === 'critical') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.85,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [urgency]);

  if (!style || urgency === 'none') return null;

  return (
    <Animated.View
      style={[
        styles.headerContainer,
        {
          backgroundColor: style.backgroundColor,
          opacity: pulseAnim,
          // Match card's top border radius
          borderTopLeftRadius: BorderRadius.xl,
          borderTopRightRadius: BorderRadius.xl,
        },
      ]}
    >
      <Ionicons name="time-outline" size={14} color={style.textColor} />
      <Text style={[styles.headerText, { color: style.textColor }]}>
        {prefix} {timeDisplay}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
