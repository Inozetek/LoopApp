/**
 * Card Action Menu — Lightweight bottom sheet with card actions
 *
 * Shown when user taps the three-dot menu on an activity card.
 * Options:
 *   - "Add to Radar" (purple icon) — opens AddRadarSheet prefilled
 *   - "Not Interested" (red icon) — removes card from feed
 *
 * Guarded by FEATURE_FLAGS.ENABLE_RADAR for the radar option.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, BrandColors, Spacing, BorderRadius } from '@/constants/brand';
import { FEATURE_FLAGS } from '@/constants/feature-flags';

// ============================================================================
// PROPS
// ============================================================================

export interface CardActionMenuProps {
  visible: boolean;
  onClose: () => void;
  onAddToRadar?: () => void;
  onNotInterested?: () => void;
  activityName?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CardActionMenu({
  visible,
  onClose,
  onAddToRadar,
  onNotInterested,
  activityName,
}: CardActionMenuProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? ThemeColors.dark : ThemeColors.light;

  const handleAddToRadar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    onAddToRadar?.();
  };

  const handleNotInterested = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    onNotInterested?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheetContainer}>
          <View style={[styles.sheet, { backgroundColor: colors.cardBackground }]}>
            {/* Handle bar */}
            <View style={[styles.handleBar, { backgroundColor: colors.textSecondary + '40' }]} />

            {/* Activity name header */}
            {activityName && (
              <Text style={[styles.headerText, { color: colors.textSecondary }]} numberOfLines={1}>
                {activityName}
              </Text>
            )}

            {/* Add to Radar option */}
            {FEATURE_FLAGS.ENABLE_RADAR && onAddToRadar && (
              <Pressable
                style={styles.menuItem}
                onPress={handleAddToRadar}
                testID="card-action-add-radar"
              >
                <View style={[styles.menuIcon, { backgroundColor: BrandColors.loopViolet + '20' }]}>
                  <Ionicons name="radio-outline" size={20} color={BrandColors.loopViolet} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>Add to Radar</Text>
                  <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                    Get alerts about this venue
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Not Interested option */}
            {onNotInterested && (
              <Pressable
                style={styles.menuItem}
                onPress={handleNotInterested}
                testID="card-action-not-interested"
              >
                <View style={[styles.menuIcon, { backgroundColor: '#EF444420' }]}>
                  <Ionicons name="eye-off-outline" size={20} color="#EF4444" />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>Not Interested</Text>
                  <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                    Hide this recommendation
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Cancel button */}
            <Pressable
              style={[styles.cancelButton, { borderTopColor: colors.textSecondary + '20' }]}
              onPress={onClose}
              testID="card-action-cancel"
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 34, // Safe area bottom
  },
  sheet: {
    borderRadius: BorderRadius.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    overflow: 'hidden',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  headerText: {
    fontSize: 13,
    fontFamily: 'Urbanist-Medium',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontFamily: 'Urbanist-SemiBold',
  },
  menuSubtitle: {
    fontSize: 13,
    fontFamily: 'Urbanist-Regular',
    marginTop: 1,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: 'Urbanist-Medium',
  },
});
