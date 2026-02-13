/**
 * Stacked Avatars Component
 * Shows overlapping avatars with a counter for overflow
 * Inspired by Atlassian Avatar Group pattern
 */

import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { ThemeColors, BrandColors } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface AvatarUser {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface StackedAvatarsProps {
  users: AvatarUser[];
  maxVisible?: number;
  size?: 'small' | 'medium' | 'large';
}

const SIZES = {
  small: { avatar: 24, border: 2, font: 10, offset: -8 },
  medium: { avatar: 32, border: 2, font: 11, offset: -10 },
  large: { avatar: 44, border: 3, font: 12, offset: -12 },
};

export function StackedAvatars({
  users,
  maxVisible = 3,
  size = 'medium',
}: StackedAvatarsProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const sizeConfig = SIZES[size];

  const visibleUsers = users.slice(0, maxVisible);
  const overflowCount = users.length - maxVisible;

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

  return (
    <View style={styles.container}>
      {visibleUsers.map((user, index) => (
        <View
          key={user.id}
          style={[
            styles.avatarWrapper,
            {
              width: sizeConfig.avatar,
              height: sizeConfig.avatar,
              borderRadius: sizeConfig.avatar / 2,
              borderWidth: sizeConfig.border,
              borderColor: colors.card,
              marginLeft: index > 0 ? sizeConfig.offset : 0,
              zIndex: maxVisible - index,
            },
          ]}
        >
          {user.avatarUrl ? (
            <Image
              source={{ uri: user.avatarUrl }}
              style={[
                styles.avatar,
                {
                  width: sizeConfig.avatar - sizeConfig.border * 2,
                  height: sizeConfig.avatar - sizeConfig.border * 2,
                  borderRadius: (sizeConfig.avatar - sizeConfig.border * 2) / 2,
                },
              ]}
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                {
                  width: sizeConfig.avatar - sizeConfig.border * 2,
                  height: sizeConfig.avatar - sizeConfig.border * 2,
                  borderRadius: (sizeConfig.avatar - sizeConfig.border * 2) / 2,
                  backgroundColor: getAvatarColor(user.name),
                },
              ]}
            >
              <Text
                style={[
                  styles.initials,
                  { fontSize: sizeConfig.font },
                ]}
              >
                {getInitials(user.name)}
              </Text>
            </View>
          )}
        </View>
      ))}

      {/* Overflow counter */}
      {overflowCount > 0 && (
        <View
          style={[
            styles.avatarWrapper,
            styles.counterWrapper,
            {
              width: sizeConfig.avatar,
              height: sizeConfig.avatar,
              borderRadius: sizeConfig.avatar / 2,
              borderWidth: sizeConfig.border,
              borderColor: colors.card,
              marginLeft: sizeConfig.offset,
              backgroundColor: colors.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.counterText,
              { fontSize: sizeConfig.font },
            ]}
          >
            +{overflowCount}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
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
  counterWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
