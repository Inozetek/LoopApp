import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, BorderRadius, Spacing } from '@/constants/brand';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function SkeletonLoader({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonLoaderProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function ActivityCardSkeleton() {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {/* Image skeleton */}
      <SkeletonLoader height={300} borderRadius={0} />

      <View style={styles.content}>
        {/* Title skeleton */}
        <SkeletonLoader width="80%" height={24} style={{ marginBottom: 8 }} />
        <SkeletonLoader width="40%" height={18} style={{ marginBottom: 16 }} />

        {/* Metadata row skeleton */}
        <View style={styles.metadataRow}>
          <SkeletonLoader width={60} height={16} />
          <SkeletonLoader width={40} height={16} />
          <SkeletonLoader width={70} height={16} />
        </View>

        {/* AI reason skeleton */}
        <View style={[styles.reasonBox, { backgroundColor: colors.backgroundSecondary }]}>
          <SkeletonLoader width="90%" height={16} style={{ marginBottom: 4 }} />
          <SkeletonLoader width="70%" height={16} />
        </View>

        {/* Button skeleton */}
        <SkeletonLoader height={52} borderRadius={BorderRadius.lg} />
      </View>
    </View>
  );
}

export function CalendarEventSkeleton() {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  return (
    <View style={[styles.eventCard, { backgroundColor: colors.card }]}>
      <View style={styles.eventRow}>
        {/* Icon circle */}
        <SkeletonLoader width={48} height={48} borderRadius={24} style={{ marginRight: Spacing.md }} />

        <View style={{ flex: 1 }}>
          {/* Title */}
          <SkeletonLoader width="70%" height={20} style={{ marginBottom: 6 }} />
          {/* Time */}
          <SkeletonLoader width="40%" height={16} style={{ marginBottom: 4 }} />
          {/* Location */}
          <SkeletonLoader width="60%" height={14} />
        </View>
      </View>
    </View>
  );
}

export function FriendCardSkeleton() {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  return (
    <View style={[styles.friendCard, { backgroundColor: colors.card }]}>
      <View style={styles.friendRow}>
        {/* Avatar */}
        <SkeletonLoader width={48} height={48} borderRadius={24} style={{ marginRight: Spacing.md }} />

        <View style={{ flex: 1 }}>
          {/* Name */}
          <SkeletonLoader width="60%" height={18} style={{ marginBottom: 6 }} />
          {/* Email */}
          <SkeletonLoader width="80%" height={14} />
        </View>

        {/* Loop score badge */}
        <SkeletonLoader width={60} height={28} borderRadius={BorderRadius.sm} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  card: {
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  content: {
    padding: Spacing.md,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  reasonBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  eventCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  friendCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
