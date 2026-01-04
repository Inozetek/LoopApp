import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';

export interface ConflictWarningModalProps {
  visible: boolean;
  conflictType: 'double-booking' | 'travel-time' | null;
  conflictingTask?: {
    title: string;
    start_time: Date;
    end_time: Date;
  };
  travelDetails?: {
    previousTask: string;
    travelMinutes: number;
    arrivalTime: Date;
    minutesLate: number;
  };
  onCancel: () => void;
  onReplaceTask?: () => void;
  onChangeTime: () => void;
  onDeletePrevious?: () => void;
}

export function ConflictWarningModal({
  visible,
  conflictType,
  conflictingTask,
  travelDetails,
  onCancel,
  onReplaceTask,
  onChangeTime,
  onDeletePrevious,
}: ConflictWarningModalProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  const handleReplaceTask = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onReplaceTask?.();
  };

  const handleChangeTime = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChangeTime();
  };

  const handleDeletePrevious = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDeletePrevious?.();
  };

  const renderDoubleBookingContent = () => {
    if (!conflictingTask) return null;

    return (
      <>
        <Ionicons name="calendar-outline" size={48} color={BrandColors.warning} />

        <Text style={[Typography.headlineSmall, { color: colors.text, marginTop: Spacing.md, textAlign: 'center' }]}>
          Time Slot Already Booked
        </Text>

        <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
          You already have "{conflictingTask.title}" scheduled at{' '}
          {conflictingTask.start_time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </Text>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={handleCancel}
          >
            <Text style={[Typography.labelLarge, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.changeTimeButton, { backgroundColor: BrandColors.loopBlue }]}
            onPress={handleChangeTime}
          >
            <Text style={[Typography.labelLarge, { color: '#FFFFFF' }]}>Change Time</Text>
          </TouchableOpacity>

          {onReplaceTask && (
            <TouchableOpacity
              style={[styles.button, styles.replaceButton, { backgroundColor: BrandColors.warning }]}
              onPress={handleReplaceTask}
            >
              <Text style={[Typography.labelLarge, { color: '#FFFFFF' }]}>Replace Task</Text>
            </TouchableOpacity>
          )}
        </View>
      </>
    );
  };

  const renderTravelTimeContent = () => {
    if (!travelDetails) return null;

    return (
      <>
        <Ionicons name="car-outline" size={48} color={BrandColors.error} />

        <Text style={[Typography.headlineSmall, { color: colors.text, marginTop: Spacing.md, textAlign: 'center' }]}>
          Can't Make It On Time
        </Text>

        <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
          "{travelDetails.previousTask}" ends at{' '}
          {travelDetails.arrivalTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.
          {'\n'}
          With {travelDetails.travelMinutes} min travel time, you'll arrive at{' '}
          {travelDetails.arrivalTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}{' '}
          ({travelDetails.minutesLate} min late).
        </Text>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={handleCancel}
          >
            <Text style={[Typography.labelLarge, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.changeTimeButton, { backgroundColor: BrandColors.loopBlue }]}
            onPress={handleChangeTime}
          >
            <Text style={[Typography.labelLarge, { color: '#FFFFFF' }]}>Change Time</Text>
          </TouchableOpacity>

          {onDeletePrevious && (
            <TouchableOpacity
              style={[styles.button, styles.deleteButton, { backgroundColor: BrandColors.error }]}
              onPress={handleDeletePrevious}
            >
              <Text style={[Typography.labelLarge, { color: '#FFFFFF' }]}>Delete Previous</Text>
            </TouchableOpacity>
          )}
        </View>
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
          {conflictType === 'double-booking' && renderDoubleBookingContent()}
          {conflictType === 'travel-time' && renderTravelTimeContent()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: Spacing.xl * 1.5,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  actionButtons: {
    marginTop: Spacing.xl,
    width: '100%',
    gap: Spacing.md,
  },
  button: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  changeTimeButton: {},
  replaceButton: {},
  deleteButton: {},
});
