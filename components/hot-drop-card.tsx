/**
 * Hot Drop Card — Time-limited business promotion feed card
 *
 * Visual treatment:
 * - Orange/red gradient border with breathing animation
 * - "HOT DROP" badge with flame icon
 * - Countdown timer updating every second
 * - Progress bar: "23/50 claimed" with fill
 * - "Claim" button (disabled when full or expired)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, BrandColors, Spacing, BorderRadius } from '@/constants/brand';
import type { HotDrop } from '@/types/hot-drop';
import { isHotDropClaimable, getHotDropTimeRemaining, getClaimsProgress } from '@/types/hot-drop';

// ============================================================================
// PROPS
// ============================================================================

interface HotDropCardProps {
  hotDrop: HotDrop;
  onClaim: (hotDropId: string) => void;
  onSeeDetails?: (hotDrop: HotDrop) => void;
  isPlusUser?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function HotDropCard({
  hotDrop,
  onClaim,
  onSeeDetails,
  isPlusUser = false,
}: HotDropCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? ThemeColors.dark : ThemeColors.light;

  const [timeRemaining, setTimeRemaining] = useState(getHotDropTimeRemaining(hotDrop.expiresAt));
  const [isClaiming, setIsClaiming] = useState(false);
  const claimable = isHotDropClaimable(hotDrop);
  const progress = getClaimsProgress(hotDrop);

  // Breathing animation for the border glow
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [glowAnim]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(getHotDropTimeRemaining(hotDrop.expiresAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [hotDrop.expiresAt]);

  const handleClaim = async () => {
    if (!claimable || isClaiming) return;
    setIsClaiming(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClaim(hotDrop.id);
    // Parent handles async result, we optimistically disable
    setTimeout(() => setIsClaiming(false), 2000);
  };

  const isExpired = timeRemaining === 'Expired';
  const isFull = hotDrop.currentClaims >= hotDrop.totalClaims;

  return (
    <Animated.View style={[styles.cardOuter, { opacity: glowAnim }]}>
      <LinearGradient
        colors={['#F97316', '#EF4444', '#F97316']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <View style={[styles.cardInner, { backgroundColor: colors.cardBackground }]}>
          {/* Header row */}
          <View style={styles.header}>
            <View style={styles.hotDropBadge}>
              <Text style={styles.flameBadgeText}>🔥 HOT DROP</Text>
            </View>
            <View style={styles.timerContainer}>
              <Ionicons name="time-outline" size={14} color={isExpired ? '#EF4444' : '#F97316'} />
              <Text style={[styles.timerText, { color: isExpired ? '#EF4444' : '#F97316' }]}>
                {timeRemaining}
              </Text>
            </View>
          </View>

          {/* Image */}
          {hotDrop.imageUrl && (
            <Image source={{ uri: hotDrop.imageUrl }} style={styles.image} />
          )}

          {/* Content */}
          <View style={styles.content}>
            <Text style={[styles.businessName, { color: colors.textSecondary }]}>
              {hotDrop.businessName}
            </Text>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {hotDrop.title}
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
              {hotDrop.description}
            </Text>

            {/* Claims progress bar */}
            <View style={styles.progressSection}>
              <View style={[styles.progressTrack, { backgroundColor: colors.textSecondary + '20' }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progress * 100}%`,
                      backgroundColor: isFull ? '#EF4444' : '#F97316',
                    },
                  ]}
                />
              </View>
              <Text style={[styles.claimsText, { color: colors.textSecondary }]}>
                {hotDrop.currentClaims}/{hotDrop.totalClaims} claimed
              </Text>
            </View>

            {/* Plus early access badge */}
            {isPlusUser && (
              <View style={styles.earlyAccessBadge}>
                <Ionicons name="flash" size={12} color={BrandColors.loopViolet} />
                <Text style={[styles.earlyAccessText, { color: BrandColors.loopViolet }]}>
                  Plus Early Access
                </Text>
              </View>
            )}

            {/* Claim button */}
            <Pressable
              style={[
                styles.claimButton,
                !claimable && styles.claimButtonDisabled,
              ]}
              onPress={handleClaim}
              disabled={!claimable || isClaiming}
              testID="hot-drop-claim-button"
            >
              <LinearGradient
                colors={claimable ? ['#F97316', '#EF4444'] : ['#9CA3AF', '#9CA3AF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.claimGradient}
              >
                <Text style={styles.claimButtonText}>
                  {isClaiming ? 'Claiming...' : isExpired ? 'Expired' : isFull ? 'Sold Out' : 'Claim Now'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  cardOuter: {
    marginHorizontal: 8,
    marginVertical: 6,
  },
  gradientBorder: {
    borderRadius: BorderRadius.xl + 2,
    padding: 2,
  },
  cardInner: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  hotDropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flameBadgeText: {
    fontSize: 13,
    fontFamily: 'Urbanist-SemiBold',
    color: '#F97316',
    letterSpacing: 1,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    fontSize: 14,
    fontFamily: 'Urbanist-SemiBold',
  },
  image: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  content: {
    padding: Spacing.md,
    gap: 6,
  },
  businessName: {
    fontSize: 12,
    fontFamily: 'Urbanist-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Urbanist-SemiBold',
  },
  description: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
    lineHeight: 20,
  },
  progressSection: {
    gap: 4,
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  claimsText: {
    fontSize: 12,
    fontFamily: 'Urbanist-Medium',
  },
  earlyAccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  earlyAccessText: {
    fontSize: 12,
    fontFamily: 'Urbanist-SemiBold',
  },
  claimButton: {
    marginTop: 8,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  claimButtonDisabled: {
    opacity: 0.6,
  },
  claimGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  claimButtonText: {
    fontSize: 16,
    fontFamily: 'Urbanist-SemiBold',
    color: '#FFFFFF',
  },
});
