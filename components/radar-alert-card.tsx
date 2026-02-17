/**
 * Radar Alert Card — Special feed card for radar matches
 *
 * Visual treatment:
 * - Gradient border (brand purple → coral) with breathing/pulsing animation
 * - "ON YOUR RADAR" badge with radar icon
 * - Shows WHY it matched: "Matched your Artist Radar"
 * - Same card structure as regular activity cards but visually distinct
 *
 * Uses react-native-reanimated for the pulsing border animation.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  Linking,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, BrandColors, Shadows, Spacing, BorderRadius } from '@/constants/brand';
import type { HookNotification } from '@/types/radar';
import type { RadarMatch } from '@/types/radar';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_MARGIN = 8;
const CARD_WIDTH = SCREEN_WIDTH - (CARD_MARGIN * 2);
const IMAGE_HEIGHT = 200;

// ============================================================================
// PROPS
// ============================================================================

interface RadarAlertCardProps {
  notification: HookNotification;
  radarMatch: RadarMatch;
  onDismiss?: () => void;
  onGetTickets?: () => void;
  onSave?: () => void;
  index: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RadarAlertCard({
  notification,
  radarMatch,
  onDismiss,
  onGetTickets,
  onSave,
  index,
}: RadarAlertCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? ThemeColors.dark : ThemeColors.light;

  // Breathing/pulsing border animation
  const borderOpacity = useSharedValue(0.4);

  useEffect(() => {
    borderOpacity.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1, // infinite
      true // reverse
    );
  }, []);

  const animatedBorderStyle = useAnimatedStyle(() => ({
    opacity: borderOpacity.value,
  }));

  const event = notification.eventData;
  const hasImage = !!event?.imageUrl;
  const hasPrice = event?.priceMin != null;
  const hasTicketUrl = !!event?.ticketUrl;

  const handleGetTickets = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (hasTicketUrl && event?.ticketUrl) {
      Linking.openURL(event.ticketUrl).catch(() => {});
    }
    onGetTickets?.();
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss?.();
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSave?.();
  };

  const priceText = hasPrice
    ? event!.priceMax && event!.priceMax !== event!.priceMin
      ? `$${event!.priceMin} - $${event!.priceMax}`
      : `From $${event!.priceMin}`
    : null;

  return (
    <View style={[styles.outerContainer, { marginHorizontal: CARD_MARGIN }]}>
      {/* Animated gradient border */}
      <Animated.View style={[styles.gradientBorderWrapper, animatedBorderStyle]}>
        <LinearGradient
          colors={['#8B5CF6', '#EC4899', '#F59E0B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        />
      </Animated.View>

      {/* Card content */}
      <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
        {/* ON YOUR RADAR badge */}
        <View style={styles.radarBadgeRow}>
          <View style={styles.radarBadge}>
            <Ionicons name="radio-outline" size={14} color={BrandColors.loopPurple} />
            <Text style={styles.radarBadgeText}>ON YOUR RADAR</Text>
          </View>
          <Pressable onPress={handleDismiss} hitSlop={12}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Event image */}
        {hasImage && (
          <Image
            source={{ uri: event!.imageUrl }}
            style={styles.eventImage}
            resizeMode="cover"
          />
        )}

        {/* Event details */}
        <View style={styles.detailsContainer}>
          <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={2}>
            {event?.name || notification.title}
          </Text>

          {event?.venue && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
                {event.venue}
              </Text>
            </View>
          )}

          {event?.date && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                {formatEventDate(event.date)}{event.time ? `, ${formatEventTime(event.time)}` : ''}
              </Text>
            </View>
          )}

          <View style={styles.metaRow}>
            {priceText && (
              <View style={styles.priceBadge}>
                <Text style={styles.priceText}>{priceText}</Text>
              </View>
            )}
            {event?.distanceMiles != null && (
              <Text style={[styles.distanceText, { color: colors.textSecondary }]}>
                {event.distanceMiles.toFixed(1)} mi away
              </Text>
            )}
          </View>

          {/* Match reason */}
          <View style={styles.matchReasonRow}>
            <Ionicons name="radio" size={12} color={BrandColors.loopPurple} />
            <Text style={[styles.matchReasonText, { color: BrandColors.loopPurple }]}>
              {radarMatch.matchReason}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {hasTicketUrl && (
            <Pressable style={styles.primaryButton} onPress={handleGetTickets}>
              <Ionicons name="ticket-outline" size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Get Tickets</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={handleSave}
          >
            <Ionicons name="bookmark-outline" size={16} color={colors.text} />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Save</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatEventDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatEventTime(timeStr: string): string {
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return minutes > 0 ? `${displayHour}:${String(minutes).padStart(2, '0')} ${period}` : `${displayHour} ${period}`;
  } catch {
    return timeStr;
  }
}

// ============================================================================
// STYLES
// ============================================================================

const loopPurple = '#8B5CF6';

const styles = StyleSheet.create({
  outerContainer: {
    marginBottom: Spacing.md,
    position: 'relative',
  },
  gradientBorderWrapper: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.lg + 2,
    overflow: 'hidden',
  },
  gradientBorder: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    margin: 2, // Creates the gradient border effect
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.md,
  },
  radarBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  radarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  radarBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: loopPurple,
    textTransform: 'uppercase',
  },
  eventImage: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  detailsContainer: {
    padding: Spacing.md,
    gap: 6,
  },
  eventName: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  priceBadge: {
    backgroundColor: 'rgba(9, 219, 152, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '600',
    color: BrandColors.loopGreen,
  },
  distanceText: {
    fontSize: 14,
  },
  matchReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  matchReasonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: loopPurple,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RadarAlertCard;
