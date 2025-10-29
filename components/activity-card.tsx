import { View, Text, StyleSheet, Image, Pressable, Alert } from 'react-native';
import { Activity } from '@/types/activity';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface ActivityCardProps {
  activity: Activity;
  onAddToCalendar: (activity: Activity) => void;
  onSeeDetails: (activity: Activity) => void;
  reason?: string;
}

export function ActivityCard({ activity, onAddToCalendar, onSeeDetails, reason }: ActivityCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const getPriceDisplay = (priceRange: number) => {
    return '$'.repeat(Math.max(1, priceRange));
  };

  const getDistanceText = (distance?: number) => {
    if (!distance) return '';
    return distance < 1 ? `${(distance * 5280).toFixed(0)} ft` : `${distance.toFixed(1)} mi`;
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Image */}
      <Image
        source={{ uri: activity.photoUrl }}
        style={styles.image}
        resizeMode="cover"
      />

      {/* Sponsored Badge */}
      {activity.isSponsored && (
        <View style={[styles.sponsoredBadge, { backgroundColor: colors.tint }]}>
          <Text style={styles.sponsoredText}>Sponsored</Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Title and Category */}
        <View style={styles.header}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
            {activity.name}
          </Text>
          <View style={styles.categoryBadge}>
            <Text style={[styles.category, { color: colors.icon }]}>
              {activity.category}
            </Text>
          </View>
        </View>

        {/* Rating, Price, Distance */}
        <View style={styles.metadata}>
          {activity.rating && (
            <View style={styles.metaItem}>
              <IconSymbol name="star.fill" size={14} color={colors.tint} />
              <Text style={[styles.metaText, { color: colors.text }]}>
                {activity.rating.toFixed(1)}
              </Text>
              {activity.reviewsCount && (
                <Text style={[styles.metaTextLight, { color: colors.icon }]}>
                  ({activity.reviewsCount.toLocaleString()})
                </Text>
              )}
            </View>
          )}

          <View style={styles.metaItem}>
            <Text style={[styles.metaText, { color: colors.text }]}>
              {getPriceDisplay(activity.priceRange)}
            </Text>
          </View>

          {activity.distance && (
            <View style={styles.metaItem}>
              <IconSymbol name="location.fill" size={14} color={colors.icon} />
              <Text style={[styles.metaText, { color: colors.text }]}>
                {getDistanceText(activity.distance)}
              </Text>
            </View>
          )}
        </View>

        {/* AI Reason */}
        {reason && (
          <View style={[styles.reasonContainer, { backgroundColor: colors.background }]}>
            <IconSymbol name="sparkles" size={16} color={colors.tint} />
            <Text style={[styles.reason, { color: colors.text }]} numberOfLines={2}>
              {reason}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.tint }]}
            onPress={() => onAddToCalendar(activity)}
          >
            <IconSymbol name="calendar.badge.plus" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Add to Calendar</Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={() => onSeeDetails(activity)}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>
              See Details
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#e0e0e0',
  },
  sponsoredBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sponsoredText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
  },
  category: {
    fontSize: 14,
    fontWeight: '500',
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  metaTextLight: {
    fontSize: 12,
    marginLeft: 2,
  },
  reasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  reason: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
