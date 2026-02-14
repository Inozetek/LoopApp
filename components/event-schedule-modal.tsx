/**
 * Event Schedule Modal
 *
 * Specialized modal for scheduling Ticketmaster events to calendar.
 * Pre-fills arrival time at event start - 10 minutes by default.
 * Blocks full event duration on calendar.
 *
 * Key Features:
 * - Pre-calculated arrival time (event start - 10 min)
 * - Shows event duration
 * - Displays ticket URL for purchase
 * - FREE badge for free events
 * - User can adjust arrival time if needed
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BrandColors, Typography, Spacing, BorderRadius } from '@/constants/brand';
import type { EventMetadata } from '@/types/activity';

interface EventScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (arrivalTime: Date, endTime: Date) => void;
  eventName: string;
  eventMetadata: EventMetadata;
  location: string;
}

export function EventScheduleModal({
  visible,
  onClose,
  onConfirm,
  eventName,
  eventMetadata,
  location,
}: EventScheduleModalProps) {
  // Parse event times
  const eventStartTime = new Date(eventMetadata.start_time);
  const eventEndTime = new Date(eventMetadata.end_time);

  // Calculate default arrival time (event start - 10 minutes)
  const defaultArrivalTime = new Date(eventStartTime.getTime() - 10 * 60 * 1000);

  // State
  const [arrivalTime, setArrivalTime] = useState(defaultArrivalTime);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Reset arrival time when modal opens
  useEffect(() => {
    if (visible) {
      setArrivalTime(defaultArrivalTime);
    }
  }, [visible, eventMetadata.start_time]);

  // Format time display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate time difference
  const minutesBeforeEvent = Math.round(
    (eventStartTime.getTime() - arrivalTime.getTime()) / (1000 * 60)
  );

  // Handle time change
  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }

    if (selectedDate) {
      setArrivalTime(selectedDate);
    }
  };

  // Handle confirm
  const handleConfirm = () => {
    onConfirm(arrivalTime, eventEndTime);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Schedule Event</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={BrandColors.almostBlack} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Event Info */}
            <View style={styles.section}>
              <View style={styles.eventHeader}>
                <Ionicons name="calendar" size={24} color={BrandColors.loopBlue} />
                <Text style={styles.eventName}>{eventName}</Text>
              </View>

              {eventMetadata.is_free && (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>FREE</Text>
                </View>
              )}
            </View>

            {/* Event Time */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Event Time</Text>
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={20} color={BrandColors.veryLightGray} />
                <Text style={styles.timeText}>
                  {formatDate(eventStartTime)} at {formatTime(eventStartTime)}
                </Text>
              </View>
              <Text style={styles.durationText}>
                Duration: {eventMetadata.duration_minutes} minutes
              </Text>
            </View>

            {/* Location */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Location</Text>
              <View style={styles.timeRow}>
                <Ionicons name="location-outline" size={20} color={BrandColors.veryLightGray} />
                <Text style={styles.locationText}>{location}</Text>
              </View>
              {eventMetadata.is_online && (
                <View style={styles.onlineBadge}>
                  <Ionicons name="videocam-outline" size={16} color={BrandColors.loopBlue} />
                  <Text style={styles.onlineBadgeText}>Online Event</Text>
                </View>
              )}
            </View>

            {/* Arrival Time */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Your Arrival Time</Text>
              <Text style={styles.helperText}>
                We&apos;ve set this {minutesBeforeEvent} minutes before the event starts to give you
                time for parking and walking.
              </Text>

              <TouchableOpacity
                style={styles.timePicker}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="alarm-outline" size={20} color={BrandColors.loopBlue} />
                <Text style={styles.timePickerText}>{formatTime(arrivalTime)}</Text>
                <Ionicons name="chevron-down" size={20} color={BrandColors.veryLightGray} />
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={arrivalTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleTimeChange}
                  maximumDate={eventStartTime} // Can't arrive after event starts
                />
              )}
            </View>

            {/* Ticket Info */}
            {eventMetadata.event_url && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Tickets</Text>
                {eventMetadata.ticket_price && !eventMetadata.is_free && (
                  <Text style={styles.priceText}>
                    ${(eventMetadata.ticket_price.min / 100).toFixed(2)}
                    {eventMetadata.ticket_price.max !== eventMetadata.ticket_price.min &&
                      ` - $${(eventMetadata.ticket_price.max / 100).toFixed(2)}`}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.ticketButton}
                  onPress={() => Linking.openURL(eventMetadata.event_url!)}
                >
                  <Ionicons name="ticket-outline" size={20} color="#fff" />
                  <Text style={styles.ticketButtonText}>
                    {eventMetadata.is_free ? 'Register for Free' : 'Buy Tickets'}
                  </Text>
                  <Ionicons name="open-outline" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {/* Organizer */}
            {eventMetadata.organizer && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Organized by</Text>
                <Text style={styles.organizerText}>{eventMetadata.organizer}</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Ionicons name="calendar-outline" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>Add to Calendar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: BrandColors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.lightBackground,
  },
  title: {
    ...Typography.headlineSmall,
    color: BrandColors.almostBlack,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    ...Typography.labelLarge,
    color: BrandColors.veryLightGray,
    marginBottom: Spacing.sm,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  eventName: {
    ...Typography.titleLarge,
    color: BrandColors.almostBlack,
    flex: 1,
  },
  freeBadge: {
    backgroundColor: BrandColors.success,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
  },
  freeBadgeText: {
    ...Typography.labelSmall,
    color: BrandColors.white,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timeText: {
    ...Typography.bodyLarge,
    color: BrandColors.almostBlack,
  },
  durationText: {
    ...Typography.bodySmall,
    color: BrandColors.veryLightGray,
    marginTop: Spacing.xs,
    marginLeft: 28, // Align with time text
  },
  locationText: {
    ...Typography.bodyMedium,
    color: BrandColors.almostBlack,
    flex: 1,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    backgroundColor: BrandColors.blueOverlay,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  onlineBadgeText: {
    ...Typography.labelSmall,
    color: BrandColors.loopBlue,
  },
  helperText: {
    ...Typography.bodySmall,
    color: BrandColors.veryLightGray,
    marginBottom: Spacing.md,
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: BrandColors.lightBackground,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  timePickerText: {
    ...Typography.bodyLarge,
    color: BrandColors.almostBlack,
    flex: 1,
  },
  priceText: {
    ...Typography.titleMedium,
    color: BrandColors.almostBlack,
    marginBottom: Spacing.sm,
  },
  ticketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: BrandColors.loopBlue,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  ticketButtonText: {
    ...Typography.labelLarge,
    color: BrandColors.white,
  },
  organizerText: {
    ...Typography.bodyMedium,
    color: BrandColors.almostBlack,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.lightBackground,
  },
  cancelButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.veryLightGray,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.labelLarge,
    color: BrandColors.almostBlack,
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.loopBlue,
  },
  confirmButtonText: {
    ...Typography.labelLarge,
    color: BrandColors.white,
  },
});
