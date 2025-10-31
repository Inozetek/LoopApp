/**
 * Schedule Plan Modal - Rich, Beautiful Scheduling Flow
 * Replaces generic iOS alerts with premium UX
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Activity, Recommendation } from '@/types/activity';
import { getBusinessHours, isOpenAt, getTodayHours, formatBusinessHours } from '@/utils/business-hours';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface SchedulePlanModalProps {
  visible: boolean;
  activity: Activity | null;
  recommendation?: Recommendation | null; // Full recommendation with business hours
  onClose: () => void;
  onSchedule: (scheduledTime: Date, notes?: string) => void;
  onShareWithFriend?: (friendId: string) => void;
}

// Mock friends data (will come from context later)
const MOCK_FRIENDS = [
  { id: '1', name: 'Sarah Chen', matchScore: 94 },
  { id: '2', name: 'Mike Johnson', matchScore: 87 },
  { id: '3', name: 'Emma Wilson', matchScore: 72 },
  { id: '4', name: 'David Lee', matchScore: 65 },
];

export function SchedulePlanModal({
  visible,
  activity,
  recommendation,
  onClose,
  onSchedule,
  onShareWithFriend,
}: SchedulePlanModalProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'schedule' | 'share'>('schedule');

  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelectedDate(new Date());
      setNotes('');
      setActiveTab('schedule');

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 600,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!activity) return null;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleSchedule = () => {
    // Validate business hours if recommendation data is available
    if (recommendation?.businessHours || recommendation?.hasEstimatedHours) {
      const businessHoursInfo = getBusinessHours(
        recommendation.businessHours,
        recommendation.category
      );

      const isOpen = isOpenAt(businessHoursInfo.hours, selectedDate);

      if (!isOpen) {
        const todayHours = getTodayHours(businessHoursInfo.hours, selectedDate);
        const hoursText = todayHours ? formatBusinessHours(todayHours) : 'Closed';

        const warningMessage = recommendation.hasEstimatedHours
          ? `⚠️ This place may be closed at this time.\n\nEstimated hours: ${hoursText}\n\n(Hours are estimated - actual hours may vary)`
          : `⚠️ This place appears to be closed at this time.\n\nHours: ${hoursText}\n\nSchedule anyway?`;

        Alert.alert(
          'Closed During This Time',
          warningMessage,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Schedule Anyway',
              onPress: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onSchedule(selectedDate, notes);
              },
            },
          ]
        );
        return;
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSchedule(selectedDate, notes);
  };

  const handleQuickTime = (label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newDate = new Date();

    switch (label) {
      case 'Now':
        break;
      case 'Later Today':
        newDate.setHours(newDate.getHours() + 3);
        break;
      case 'Tomorrow':
        newDate.setDate(newDate.getDate() + 1);
        newDate.setHours(14, 0, 0, 0);
        break;
      case 'This Weekend':
        const daysUntilSaturday = (6 - newDate.getDay() + 7) % 7 || 7;
        newDate.setDate(newDate.getDate() + daysUntilSaturday);
        newDate.setHours(12, 0, 0, 0);
        break;
    }

    setSelectedDate(newDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Animated.View
          style={[styles.overlayBackground, { opacity: fadeAnim }]}
        />
      </Pressable>

      <Animated.View
        style={[
          styles.modalContainer,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={[styles.modal, { backgroundColor: colors.card }]}>
            {/* Handle Bar */}
            <View style={styles.handleBar}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={[styles.activityName, Typography.titleLarge, { color: colors.text }]} numberOfLines={2}>
                  {activity.name}
                </Text>
                <Text style={[styles.activityCategory, { color: colors.textSecondary }]}>
                  {activity.category}
                </Text>
              </View>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <IconSymbol name="xmark.circle.fill" size={32} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              <Pressable
                style={[
                  styles.tab,
                  activeTab === 'schedule' && [styles.tabActive, { borderBottomColor: colors.primary }],
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab('schedule');
                }}
              >
                <Text style={[
                  styles.tabText,
                  { color: activeTab === 'schedule' ? colors.primary : colors.textSecondary },
                ]}>
                  Schedule
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.tab,
                  activeTab === 'share' && [styles.tabActive, { borderBottomColor: colors.primary }],
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab('share');
                }}
              >
                <Text style={[
                  styles.tabText,
                  { color: activeTab === 'share' ? colors.primary : colors.textSecondary },
                ]}>
                  Share
                </Text>
              </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {activeTab === 'schedule' ? (
                <>
                  {/* Quick Time Options */}
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>When?</Text>
                  <View style={styles.quickTimeGrid}>
                    {['Now', 'Later Today', 'Tomorrow', 'This Weekend'].map((label) => (
                      <Pressable
                        key={label}
                        style={[styles.quickTimeButton, { backgroundColor: colors.backgroundSecondary }]}
                        onPress={() => handleQuickTime(label)}
                      >
                        <Text style={[styles.quickTimeText, { color: colors.text }]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Custom Date/Time */}
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Or choose specific time</Text>
                  <View style={styles.dateTimeRow}>
                    <Pressable
                      style={[styles.dateTimeButton, { backgroundColor: colors.backgroundSecondary }]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <IconSymbol name="calendar" size={20} color={colors.primary} />
                      <Text style={[styles.dateTimeText, { color: colors.text }]}>
                        {formatDate(selectedDate)}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.dateTimeButton, { backgroundColor: colors.backgroundSecondary }]}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <IconSymbol name="clock" size={20} color={colors.primary} />
                      <Text style={[styles.dateTimeText, { color: colors.text }]}>
                        {formatTime(selectedDate)}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Date/Time Pickers */}
                  {showDatePicker && (
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display="inline"
                      onChange={(event, date) => {
                        setShowDatePicker(Platform.OS === 'ios');
                        if (date) setSelectedDate(date);
                      }}
                    />
                  )}

                  {showTimePicker && (
                    <DateTimePicker
                      value={selectedDate}
                      mode="time"
                      display="spinner"
                      onChange={(event, date) => {
                        setShowTimePicker(Platform.OS === 'ios');
                        if (date) setSelectedDate(date);
                      }}
                    />
                  )}

                  {/* Notes */}
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Add a note (optional)</Text>
                  <TextInput
                    style={[styles.notesInput, { backgroundColor: colors.backgroundSecondary, color: colors.text }]}
                    placeholder="e.g., Try the signature cocktail"
                    placeholderTextColor={colors.textSecondary}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                  />
                </>
              ) : (
                <>
                  {/* Share with Friends */}
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Send to a friend</Text>
                  <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
                    Loop Score shows how well this matches their interests
                  </Text>

                  {MOCK_FRIENDS.map((friend) => (
                    <Pressable
                      key={friend.id}
                      style={[styles.friendItem, { backgroundColor: colors.backgroundSecondary }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onShareWithFriend?.(friend.id);
                      }}
                    >
                      <View style={styles.friendInfo}>
                        <View style={[styles.friendAvatar, { backgroundColor: colors.primary }]}>
                          <Text style={styles.friendInitial}>{friend.name[0]}</Text>
                        </View>
                        <Text style={[styles.friendName, { color: colors.text }]}>
                          {friend.name}
                        </Text>
                      </View>
                      <View style={[styles.matchBadge, { backgroundColor: `${BrandColors.success}20` }]}>
                        <Text style={[styles.matchScore, { color: BrandColors.success }]}>
                          {friend.matchScore}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>

            {/* Action Button */}
            {activeTab === 'schedule' && (
              <View style={styles.footer}>
                <Pressable
                  style={[styles.scheduleButton, { backgroundColor: colors.primary }]}
                  onPress={handleSchedule}
                >
                  <IconSymbol name="checkmark.circle.fill" size={22} color="#FFFFFF" />
                  <Text style={styles.scheduleButtonText}>
                    Add to My Loop
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    maxHeight: '90%',
  },
  modal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  handleBar: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  activityName: {
    marginBottom: Spacing.xs,
  },
  activityCategory: {
    fontSize: 14,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingHorizontal: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    maxHeight: 500,
    padding: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  sectionHint: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  quickTimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickTimeButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  quickTimeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  dateTimeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  notesInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
  },
  matchBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  matchScore: {
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.md,
    shadowColor: BrandColors.loopBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  scheduleButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
