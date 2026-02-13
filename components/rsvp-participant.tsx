/**
 * RSVP Participant Component
 * Shows avatar with status indicator (Outlook-style)
 * Used in group planning cards
 */

import React from 'react';
import { View, Image, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type RSVPStatus = 'accepted' | 'pending' | 'declined' | 'tentative';

export interface GroupParticipant {
  id: string;
  name: string;
  avatarUrl?: string;
  status: RSVPStatus;
  isCurrentUser: boolean;
}

interface RSVPParticipantProps {
  participant: GroupParticipant;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
}

const SIZES = {
  small: { avatar: 36, badge: 14, nameFont: 10, statusFont: 8 },
  medium: { avatar: 44, badge: 18, nameFont: 11, statusFont: 9 },
  large: { avatar: 56, badge: 22, nameFont: 12, statusFont: 10 },
};

const getStatusStyle = (status: RSVPStatus) => {
  switch (status) {
    case 'accepted':
      return {
        borderColor: BrandColors.success,
        badgeColor: BrandColors.success,
        opacity: 1,
        icon: 'checkmark' as const,
        label: 'Going',
      };
    case 'declined':
      return {
        borderColor: BrandColors.error,
        badgeColor: BrandColors.error,
        opacity: 0.5,
        icon: 'close' as const,
        label: "Can't go",
      };
    case 'tentative':
      return {
        borderColor: BrandColors.warning,
        badgeColor: BrandColors.warning,
        opacity: 0.7,
        icon: 'help' as const,
        label: 'Maybe',
      };
    default: // pending
      return {
        borderColor: BrandColors.veryLightGray,
        badgeColor: BrandColors.veryLightGray,
        opacity: 0.6,
        icon: 'time' as const,
        label: 'Pending',
      };
  }
};

// Generate initials for fallback avatar
const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Generate consistent color from name
const getAvatarColor = (name: string) => {
  const colors = [
    BrandColors.loopBlue,
    BrandColors.loopGreen,
    BrandColors.loopOrange,
    BrandColors.loopPurple,
    BrandColors.loopPink,
    BrandColors.loopTeal,
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export function RSVPParticipant({
  participant,
  onPress,
  size = 'medium',
}: RSVPParticipantProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const sizeConfig = SIZES[size];
  const statusStyle = getStatusStyle(participant.status);

  const displayName = participant.isCurrentUser
    ? 'You'
    : participant.name.split(' ')[0];

  const isHighlighted = participant.isCurrentUser && participant.status === 'accepted';

  const content = (
    <View style={styles.container}>
      {/* Status badge */}
      <View
        style={[
          styles.statusBadge,
          {
            width: sizeConfig.badge,
            height: sizeConfig.badge,
            borderRadius: sizeConfig.badge / 2,
            backgroundColor: statusStyle.badgeColor,
          },
        ]}
      >
        <Ionicons
          name={statusStyle.icon}
          size={sizeConfig.badge - 6}
          color="#FFFFFF"
        />
      </View>

      {/* Avatar with colored border */}
      <View
        style={[
          styles.avatarWrapper,
          {
            width: sizeConfig.avatar,
            height: sizeConfig.avatar,
            borderRadius: sizeConfig.avatar / 2,
            borderWidth: 3,
            borderColor: statusStyle.borderColor,
            opacity: statusStyle.opacity,
          },
          isHighlighted && {
            borderColor: BrandColors.loopBlue,
            shadowColor: BrandColors.loopBlue,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 6,
            elevation: 4,
          },
        ]}
      >
        {participant.avatarUrl ? (
          <Image
            source={{ uri: participant.avatarUrl }}
            style={[
              styles.avatar,
              {
                width: sizeConfig.avatar - 6,
                height: sizeConfig.avatar - 6,
                borderRadius: (sizeConfig.avatar - 6) / 2,
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              {
                width: sizeConfig.avatar - 6,
                height: sizeConfig.avatar - 6,
                borderRadius: (sizeConfig.avatar - 6) / 2,
                backgroundColor: getAvatarColor(participant.name),
              },
            ]}
          >
            <Text
              style={[
                styles.initials,
                { fontSize: sizeConfig.nameFont + 2 },
              ]}
            >
              {getInitials(participant.name)}
            </Text>
          </View>
        )}
      </View>

      {/* Name label */}
      <Text
        style={[
          styles.name,
          {
            fontSize: sizeConfig.nameFont,
            color: participant.status === 'accepted' ? colors.text : colors.textSecondary,
          },
        ]}
        numberOfLines={1}
      >
        {displayName}
      </Text>

      {/* Status label */}
      <Text
        style={[
          styles.status,
          {
            fontSize: sizeConfig.statusFont,
            color: statusStyle.borderColor,
          },
        ]}
      >
        {participant.isCurrentUser && participant.status === 'accepted'
          ? 'GOING'
          : statusStyle.label.toUpperCase()}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return content;
}

/**
 * RSVP Participant Grid
 * Shows all participants in a centered grid
 */
interface RSVPParticipantGridProps {
  participants: GroupParticipant[];
  size?: 'small' | 'medium' | 'large';
  onParticipantPress?: (participant: GroupParticipant) => void;
}

export function RSVPParticipantGrid({
  participants,
  size = 'medium',
  onParticipantPress,
}: RSVPParticipantGridProps) {
  const colorScheme = useColorScheme();

  return (
    <View style={[
      styles.gridContainer,
      { backgroundColor: colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.05)' },
    ]}>
      {participants.map((participant) => (
        <RSVPParticipant
          key={participant.id}
          participant={participant}
          size={size}
          onPress={onParticipantPress ? () => onParticipantPress(participant) : undefined}
        />
      ))}
    </View>
  );
}

/**
 * Outlook-Style Avatar Stack
 * Compact horizontal overlapping avatars with status badges
 * No verbose labels - status communicated through icons only
 */
interface OutlookAvatarStackProps {
  participants: GroupParticipant[];
  maxVisible?: number;  // Default 5
  size?: number;        // Avatar size, default 32
  onPress?: () => void;
}

const STATUS_BADGE_SIZE = 14;

const getStatusBadgeIcon = (status: RSVPStatus): keyof typeof Ionicons.glyphMap => {
  switch (status) {
    case 'accepted': return 'checkmark';
    case 'declined': return 'close';
    case 'tentative': return 'help';
    default: return 'time-outline'; // pending
  }
};

const getStatusBadgeColor = (status: RSVPStatus): string => {
  switch (status) {
    case 'accepted': return '#22c55e';   // Green
    case 'declined': return '#ef4444';   // Red
    case 'tentative': return '#f59e0b';  // Orange
    default: return '#9ca3af';           // Gray (pending)
  }
};

export function OutlookAvatarStack({
  participants,
  maxVisible = 5,
  size = 32,
  onPress,
}: OutlookAvatarStackProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const visibleParticipants = participants.slice(0, maxVisible);
  const overflowCount = Math.max(0, participants.length - maxVisible);
  const offset = -(size * 0.35); // Overlap amount

  const content = (
    <View style={outlookStyles.container}>
      {visibleParticipants.map((participant, index) => (
        <View
          key={participant.id}
          style={[
            outlookStyles.avatarWrapper,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: index > 0 ? offset : 0,
              zIndex: maxVisible - index,
              borderColor: colors.card,
            },
          ]}
        >
          {/* Avatar */}
          {participant.avatarUrl ? (
            <Image
              source={{ uri: participant.avatarUrl }}
              style={[
                outlookStyles.avatar,
                {
                  width: size - 4,
                  height: size - 4,
                  borderRadius: (size - 4) / 2,
                },
              ]}
            />
          ) : (
            <View
              style={[
                outlookStyles.avatarFallback,
                {
                  width: size - 4,
                  height: size - 4,
                  borderRadius: (size - 4) / 2,
                  backgroundColor: getAvatarColor(participant.name),
                },
              ]}
            >
              <Text style={[outlookStyles.initials, { fontSize: size * 0.35 }]}>
                {getInitials(participant.name)}
              </Text>
            </View>
          )}

          {/* Status Badge (bottom-right) */}
          <View
            style={[
              outlookStyles.statusBadge,
              {
                backgroundColor: getStatusBadgeColor(participant.status),
              },
            ]}
          >
            <Ionicons
              name={getStatusBadgeIcon(participant.status)}
              size={STATUS_BADGE_SIZE - 4}
              color="#FFFFFF"
            />
          </View>
        </View>
      ))}

      {/* Overflow counter */}
      {overflowCount > 0 && (
        <View
          style={[
            outlookStyles.avatarWrapper,
            outlookStyles.overflowCounter,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: offset,
              backgroundColor: colors.primary,
              borderColor: colors.card,
            },
          ]}
        >
          <Text style={[outlookStyles.overflowText, { fontSize: size * 0.35 }]}>
            +{overflowCount}
          </Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={outlookStyles.pressable}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const outlookStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressable: {
    alignSelf: 'flex-start',
  },
  avatarWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 2,
    position: 'relative',
  },
  avatar: {
    resizeMode: 'cover',
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: STATUS_BADGE_SIZE,
    height: STATUS_BADGE_SIZE,
    borderRadius: STATUS_BADGE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  overflowCounter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflowText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 2,
  },
  statusBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  avatarWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  avatar: {
    resizeMode: 'cover',
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  name: {
    fontWeight: '600',
    marginTop: 4,
  },
  status: {
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  gridContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
});
