/**
 * Empty State Components Library
 *
 * Reusable empty states for different scenarios across the app
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';

interface BaseEmptyStateProps {
  title: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}

function BaseEmptyState({ title, message, icon, actionLabel, onAction }: BaseEmptyStateProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: colors.backgroundSecondary }]}>
        <Ionicons name={icon} size={48} color={colors.textSecondary} />
      </View>

      <Text style={[styles.title, Typography.titleLarge, { color: colors.text }]}>
        {title}
      </Text>

      <Text style={[styles.message, Typography.bodyMedium, { color: colors.textSecondary }]}>
        {message}
      </Text>

      {actionLabel && onAction && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: BrandColors.loopBlue }]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={[Typography.labelLarge, { color: '#ffffff' }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Specific empty states for different screens

export function NoRecommendationsEmpty({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <BaseEmptyState
      title="No Recommendations Yet"
      message="Pull down to refresh and discover amazing activities near you!"
      icon="sparkles-outline"
      actionLabel={onRefresh ? "Refresh Now" : undefined}
      onAction={onRefresh}
    />
  );
}

export function NoFriendsEmpty({ onAddFriend }: { onAddFriend?: () => void }) {
  return (
    <BaseEmptyState
      title="No Friends Yet"
      message="Add friends to share your Loop and plan activities together!"
      icon="people-outline"
      actionLabel={onAddFriend ? "Add Friends" : undefined}
      onAction={onAddFriend}
    />
  );
}

export function NoEventsEmpty({ onCreateEvent }: { onCreateEvent?: () => void }) {
  return (
    <BaseEmptyState
      title="No Events Scheduled"
      message="Start planning your day by adding activities to your calendar!"
      icon="calendar-outline"
      actionLabel={onCreateEvent ? "Create Event" : undefined}
      onAction={onCreateEvent}
    />
  );
}

export function NoFriendRequestsEmpty() {
  return (
    <BaseEmptyState
      title="No Pending Requests"
      message="You're all caught up! No friend requests at the moment."
      icon="checkmark-circle-outline"
    />
  );
}

export function NoSearchResultsEmpty() {
  return (
    <BaseEmptyState
      title="No Results Found"
      message="Try searching with a different name or email address."
      icon="search-outline"
    />
  );
}

export function LocationPermissionEmpty({ onEnableLocation }: { onEnableLocation?: () => void }) {
  return (
    <BaseEmptyState
      title="Location Access Needed"
      message="Enable location services to discover activities near you and get personalized recommendations."
      icon="location-outline"
      actionLabel={onEnableLocation ? "Enable Location" : undefined}
      onAction={onEnableLocation}
    />
  );
}

export function ConnectionErrorEmpty({ onRetry }: { onRetry?: () => void }) {
  return (
    <BaseEmptyState
      title="Connection Error"
      message="Unable to load data. Please check your internet connection and try again."
      icon="cloud-offline-outline"
      actionLabel={onRetry ? "Retry" : undefined}
      onAction={onRetry}
    />
  );
}

export function GenericErrorEmpty({ onRetry }: { onRetry?: () => void }) {
  return (
    <BaseEmptyState
      title="Something Went Wrong"
      message="We encountered an error. Please try again in a moment."
      icon="alert-circle-outline"
      actionLabel={onRetry ? "Try Again" : undefined}
      onAction={onRetry}
    />
  );
}

export function NoGroupPlansEmpty({ onCreate }: { onCreate?: () => void }) {
  return (
    <BaseEmptyState
      title="No Group Plans"
      message="Create a group plan to coordinate activities with your friends!"
      icon="people-circle-outline"
      actionLabel={onCreate ? "Create Plan" : undefined}
      onAction={onCreate}
    />
  );
}

export function NoNotificationsEmpty() {
  return (
    <BaseEmptyState
      title="All Caught Up"
      message="You have no new notifications. Check back later!"
      icon="notifications-off-outline"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    minHeight: 400,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
});
