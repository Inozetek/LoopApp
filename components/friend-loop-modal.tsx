/**
 * Friend Loop Modal
 * Displays a friend's daily loop - their scheduled activities and recent history
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { BrandColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { DragHandle } from '@/components/drag-handle';

interface Friend {
  id: string;
  name: string;
  email: string;
  profile_picture_url: string | null;
  loop_score: number;
}

interface LoopActivity {
  id: string;
  title: string;
  category: string;
  start_time: string;
  end_time?: string;
  location_address?: string;
  status: 'scheduled' | 'completed' | 'in_progress';
}

interface FriendLoopModalProps {
  visible: boolean;
  onClose: () => void;
  friend: Friend;
}

export function FriendLoopModal({ visible, onClose, friend }: FriendLoopModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];

  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<LoopActivity[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadFriendActivities();
    }
  }, [visible, friend.id]);

  const loadFriendActivities = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // For demo friend IDs, use mock data
      if (friend.id.startsWith('friend-')) {
        const mockActivities: LoopActivity[] = generateMockActivities(friend.name);
        setActivities(mockActivities);
        setLoading(false);
        return;
      }

      // Query friend's calendar events for today
      const { data, error: queryError } = await supabase
        .from('calendar_events')
        .select('id, title, category, start_time, end_time, address, status')
        .eq('user_id', friend.id)
        .gte('start_time', today.toISOString())
        .lt('start_time', tomorrow.toISOString())
        .order('start_time', { ascending: true });

      if (queryError) throw queryError;

      const loopActivities: LoopActivity[] = (data || []).map((event: any) => ({
        id: event.id,
        title: event.title,
        category: event.category || 'other',
        start_time: event.start_time,
        end_time: event.end_time,
        location_address: event.address,
        status: getActivityStatus(event.start_time, event.end_time, event.status),
      }));

      setActivities(loopActivities);
    } catch (err) {
      console.error('Error loading friend activities:', err);
      setError('Unable to load activities');
      // Fall back to mock data
      setActivities(generateMockActivities(friend.name));
    } finally {
      setLoading(false);
    }
  };

  const getActivityStatus = (
    startTime: string,
    endTime?: string,
    storedStatus?: string
  ): 'scheduled' | 'completed' | 'in_progress' => {
    if (storedStatus === 'completed') return 'completed';

    const now = new Date();
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date(start.getTime() + 60 * 60 * 1000); // Default 1 hour

    if (now < start) return 'scheduled';
    if (now >= start && now <= end) return 'in_progress';
    return 'completed';
  };

  const generateMockActivities = (friendName: string): LoopActivity[] => {
    const today = new Date();
    const activities: LoopActivity[] = [];

    // Generate 3-5 mock activities based on friend name hash
    const hash = friendName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const numActivities = 3 + (hash % 3);

    const categories = ['coffee', 'dining', 'fitness', 'entertainment', 'work', 'outdoor'];
    const titles = [
      ['Morning Coffee', 'Starbucks'],
      ['Team Standup', 'Office'],
      ['Lunch Break', 'Chipotle'],
      ['Gym Session', 'Equinox'],
      ['Grocery Run', 'Whole Foods'],
      ['Dinner with Friends', 'Italian Bistro'],
    ];

    for (let i = 0; i < numActivities; i++) {
      const hour = 8 + (i * 3);
      const startTime = new Date(today);
      startTime.setHours(hour, 0, 0, 0);

      const now = new Date();
      let status: 'scheduled' | 'completed' | 'in_progress' = 'scheduled';
      if (startTime.getTime() + 60 * 60 * 1000 < now.getTime()) {
        status = 'completed';
      } else if (startTime.getTime() <= now.getTime()) {
        status = 'in_progress';
      }

      activities.push({
        id: `mock-${i}`,
        title: titles[(hash + i) % titles.length][0],
        category: categories[(hash + i) % categories.length],
        start_time: startTime.toISOString(),
        location_address: titles[(hash + i) % titles.length][1],
        status,
      });
    }

    return activities;
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      coffee: 'cafe',
      dining: 'restaurant',
      fitness: 'fitness',
      entertainment: 'film',
      work: 'briefcase',
      outdoor: 'leaf',
      other: 'ellipsis-horizontal',
    };
    return icons[category] || icons.other;
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      coffee: BrandColors.accentGold,
      dining: BrandColors.loopOrange,
      fitness: BrandColors.loopGreen,
      entertainment: BrandColors.loopPurple,
      work: BrandColors.loopBlue,
      outdoor: BrandColors.loopGreenDark,
      other: BrandColors.gray,
    };
    return colors[category] || colors.other;
  };

  const getStatusBadge = (status: 'scheduled' | 'completed' | 'in_progress') => {
    const configs: Record<typeof status, { color: string; icon: string; label: string }> = {
      scheduled: { color: BrandColors.loopBlue, icon: 'time-outline', label: 'Upcoming' },
      in_progress: { color: BrandColors.loopGreen, icon: 'play-circle', label: 'Now' },
      completed: { color: colors.icon, icon: 'checkmark-circle', label: 'Done' },
    };
    return configs[status];
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
          <DragHandle onClose={handleClose} />
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.icon + '20' }]}>
            <View style={styles.headerContent}>
              {friend.profile_picture_url ? (
                <Image source={{ uri: friend.profile_picture_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: BrandColors.loopBlue }]}>
                  <Text style={styles.avatarText}>{getInitials(friend.name)}</Text>
                </View>
              )}

              <View style={styles.headerInfo}>
                <Text style={[Typography.headlineMedium, { color: colors.text }]}>
                  {friend.name}&apos;s Loop
                </Text>
                <View style={styles.scoreRow}>
                  <Ionicons name="flash" size={16} color={BrandColors.star} />
                  <Text style={[Typography.bodyMedium, { color: BrandColors.star, marginLeft: 4 }]}>
                    {friend.loop_score} Loop Score
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {/* Date Header */}
          <View style={[styles.dateHeader, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.text} />
            <Text style={[Typography.titleMedium, { color: colors.text, marginLeft: 8 }]}>
              Today&apos;s Schedule
            </Text>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={BrandColors.loopBlue} />
                <Text style={[Typography.bodyMedium, { color: colors.icon, marginTop: 12 }]}>
                  Loading {friend.name}&apos;s activities...
                </Text>
              </View>
            ) : error && activities.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.icon} />
                <Text style={[Typography.bodyMedium, { color: colors.icon, marginTop: 12 }]}>
                  {error}
                </Text>
              </View>
            ) : activities.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={48} color={colors.icon} />
                <Text style={[Typography.bodyMedium, { color: colors.icon, marginTop: 12 }]}>
                  No activities scheduled for today
                </Text>
              </View>
            ) : (
              <View style={styles.timeline}>
                {activities.map((activity, index) => {
                  const statusBadge = getStatusBadge(activity.status);
                  const categoryColor = getCategoryColor(activity.category);

                  return (
                    <View key={activity.id} style={styles.timelineItem}>
                      {/* Timeline connector */}
                      {index < activities.length - 1 && (
                        <View
                          style={[
                            styles.timelineConnector,
                            { backgroundColor: activity.status === 'completed' ? colors.icon + '40' : BrandColors.loopBlue + '40' },
                          ]}
                        />
                      )}

                      {/* Time */}
                      <View style={styles.timeColumn}>
                        <Text style={[Typography.titleSmall, { color: colors.text }]}>
                          {formatTime(activity.start_time)}
                        </Text>
                      </View>

                      {/* Category Icon */}
                      <View
                        style={[
                          styles.categoryDot,
                          {
                            backgroundColor: categoryColor + '20',
                            borderColor: categoryColor,
                          },
                        ]}
                      >
                        <Ionicons
                          name={getCategoryIcon(activity.category) as any}
                          size={16}
                          color={categoryColor}
                        />
                      </View>

                      {/* Activity Card */}
                      <View
                        style={[
                          styles.activityCard,
                          {
                            backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
                            opacity: activity.status === 'completed' ? 0.6 : 1,
                          },
                        ]}
                      >
                        <View style={styles.activityHeader}>
                          <Text
                            style={[
                              Typography.titleMedium,
                              {
                                color: colors.text,
                                textDecorationLine: activity.status === 'completed' ? 'line-through' : 'none',
                              },
                            ]}
                          >
                            {activity.title}
                          </Text>

                          <View style={[styles.statusBadge, { backgroundColor: statusBadge.color + '20' }]}>
                            <Ionicons name={statusBadge.icon as any} size={12} color={statusBadge.color} />
                            <Text
                              style={[
                                Typography.labelSmall,
                                { color: statusBadge.color, marginLeft: 4 },
                              ]}
                            >
                              {statusBadge.label}
                            </Text>
                          </View>
                        </View>

                        {activity.location_address && (
                          <View style={styles.locationRow}>
                            <Ionicons name="location-outline" size={14} color={colors.icon} />
                            <Text
                              style={[
                                Typography.bodySmall,
                                { color: colors.icon, marginLeft: 4, flex: 1 },
                              ]}
                              numberOfLines={1}
                            >
                              {activity.location_address}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Summary Stats */}
            {!loading && activities.length > 0 && (
              <View style={[styles.statsContainer, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
                <View style={styles.statItem}>
                  <Text style={[Typography.headlineLarge, { color: BrandColors.loopBlue }]}>
                    {activities.length}
                  </Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon }]}>Activities</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Text style={[Typography.headlineLarge, { color: BrandColors.loopGreen }]}>
                    {activities.filter((a) => a.status === 'completed').length}
                  </Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon }]}>Completed</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Text style={[Typography.headlineLarge, { color: BrandColors.star }]}>
                    {activities.filter((a) => a.status === 'in_progress').length}
                  </Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon }]}>In Progress</Text>
                </View>
              </View>
            )}
          </ScrollView>
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
  container: {
    maxHeight: '85%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: Spacing.md,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    ...Typography.titleMedium,
    color: '#ffffff',
  },
  headerInfo: {
    flex: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    left: 76,
    top: 36,
    width: 2,
    height: 44,
    zIndex: -1,
  },
  timeColumn: {
    width: 60,
    marginRight: Spacing.sm,
    paddingTop: 4,
  },
  categoryDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  activityCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
});
