/**
 * Bottom Sheet Menu Component
 *
 * YouTube-inspired bottom sheet menu system with Loop brand colors.
 * Provides smooth, gesture-driven interactions for contextual actions.
 *
 * Feature Flag: ENABLE_BOTTOM_SHEETS
 * When disabled, components should fall back to existing modals.
 *
 * Usage:
 * ```tsx
 * const bottomSheetRef = useRef<BottomSheet>(null);
 *
 * <BottomSheetMenu
 *   ref={bottomSheetRef}
 *   options={[
 *     {
 *       id: 'add-calendar',
 *       label: 'Add to Calendar',
 *       icon: 'calendar-outline',
 *       iconColor: BrandColors.sheetPrimaryAction,
 *       onPress: handleAddToCalendar,
 *     },
 *     {
 *       id: 'block',
 *       label: 'Block This Place',
 *       icon: 'ban-outline',
 *       destructive: true,
 *       onPress: handleBlock,
 *     },
 *   ]}
 *   title="Activity Options"
 * />
 *
 * // Open the sheet
 * bottomSheetRef.current?.snapToIndex(0);
 *
 * // Close the sheet
 * bottomSheetRef.current?.close();
 * ```
 */

import React, { useMemo, forwardRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors, Typography, Spacing } from '@/constants/brand';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

export interface BottomSheetMenuOption {
  /** Unique identifier for this option */
  id: string;

  /** Display text for the option */
  label: string;

  /** Optional Ionicons icon name */
  icon?: keyof typeof Ionicons.glyphMap;

  /** Optional custom icon color (defaults based on destructive flag) */
  iconColor?: string;

  /** Whether this is a destructive action (shows in red) */
  destructive?: boolean;

  /** Callback when option is pressed */
  onPress: () => void;
}

interface BottomSheetMenuProps {
  /** Array of menu options to display */
  options: BottomSheetMenuOption[];

  /** Optional title displayed at top of sheet */
  title?: string;

  /** Optional callback when sheet is closed */
  onClose?: () => void;
}

export const BottomSheetMenu = forwardRef<BottomSheet, BottomSheetMenuProps>(
  ({ options, title, onClose }, ref) => {
    // Calculate snap points based on number of options
    const snapPoints = useMemo(() => {
      const headerHeight = title ? 60 : 0;
      const optionHeight = 56; // YouTube-style 56px tap targets
      const bottomPadding = 40;
      const totalHeight = headerHeight + (options.length * optionHeight) + bottomPadding;

      return [totalHeight];
    }, [options.length, title]);

    // Render backdrop with tap-to-close functionality
    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          opacity={0.5}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
        />
      ),
      []
    );

    // Handle option press - close sheet and execute callback
    const handleOptionPress = useCallback(
      (option: BottomSheetMenuOption) => {
        option.onPress();

        // Close sheet after action
        if (typeof ref === 'object' && ref?.current) {
          ref.current.close();
        }
      },
      [ref]
    );

    return (
      <BottomSheet
        ref={ref}
        index={-1} // Start closed (-1 means sheet is dismissed)
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
        onClose={onClose}
      >
        <View style={styles.content}>
          {/* Optional Title */}
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
            </View>
          )}

          {/* Menu Options */}
          {options.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.option,
                index < options.length - 1 && styles.optionBorder,
              ]}
              onPress={() => handleOptionPress(option)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityHint={option.destructive ? 'Destructive action' : undefined}
            >
              {/* Icon */}
              {option.icon && (
                <Ionicons
                  name={option.icon}
                  size={24}
                  color={
                    option.destructive
                      ? BrandColors.sheetDestructive
                      : option.iconColor || BrandColors.sheetText
                  }
                  style={styles.icon}
                />
              )}

              {/* Label */}
              <Text
                style={[
                  styles.optionLabel,
                  option.destructive && styles.destructiveLabel,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
    );
  }
);

BottomSheetMenu.displayName = 'BottomSheetMenu';

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: BrandColors.sheetBackground,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handleIndicator: {
    backgroundColor: BrandColors.sheetHandle,
    width: 36,
    height: 5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 0,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: BrandColors.sheetBorder,
  },
  title: {
    ...Typography.bodyMedium,
    color: BrandColors.sheetSubtext,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 56, // YouTube-style tap target
  },
  optionBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: BrandColors.sheetBorder,
  },
  icon: {
    marginRight: Spacing.md,
  },
  optionLabel: {
    ...Typography.bodyLarge,
    color: BrandColors.sheetText,
    flex: 1,
  },
  destructiveLabel: {
    color: BrandColors.sheetDestructive,
  },
});
