/**
 * My Group Plans Section
 * Shows plans the current user created, with RSVP status of participants
 * and actions to confirm or cancel plans.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { supabase } from '@/lib/supabase';
import { BrandColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Participant {
  id: string;
  user_id: string;
  rsvp_status: 'invited' | 'accepted' | 'declined' | 'maybe' | 'no_response';
  name?: string;
}

interface MyGroupPlan {
  id: string;
  title: string;
  description?: string;
  suggested_time: string;
  meeting_address?: string;
  status: 'proposed' | 'confirmed' | 'completed' | 'cancelled';
  participants: Participant[];
}

interface MyGroupPlansSectionProps {
  userId: string;
  onRefresh?: () => void;
}

const RSVP_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  accepted: { color: BrandColors.loopGreen, icon: 'checkmark-circle', label: 'Going' },
  maybe: { color: BrandColors.loopOrange, icon: 'help-circle', label: 'Maybe' },
  declined: { color: BrandColors.error, icon: 'close-circle', label: 'No' },
  invited: { color: BrandColors.lightGray, icon: 'mail-outline', label: 'Pending' },
  no_response: { color: BrandColors.lightGray, icon: 'ellipse-outline', label: 'No reply' },
};

export function MyGroupPlansSection({ userId, onRefresh }: MyGroupPlansSectionProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];

  const [plans, setPlans] = useState<MyGroupPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);

      if (userId === 'demo-user-123') {
        // Mock data for demo
        setPlans([
          {
            id: 'demo-plan-1',
            title: 'Dinner at Deep Ellum',
            suggested_time: new Date(Date.now() + 86400000).toISOString(),
            meeting_address: 'Deep Ellum, Dallas',
            status: 'proposed',
            participants: [
              { id: 'p1', user_id: 'friend-1', rsvp_status: 'accepted', name: 'Sarah' },
              { id: 'p2', user_id: 'friend-2', rsvp_status: 'maybe', name: 'Mike' },
              { id: 'p3', user_id: 'friend-3', rsvp_status: 'invited', name: 'Alex' },
            ],
          },
        ]);
        setLoading(false);
        return;
      }

      // Fetch plans created by this user
      const { data: planData, error: planError } = await supabase
        .from('group_plans')
        .select(`
          id,
          title,
          description,
          suggested_time,
          meeting_address,
          status
        `)
        .eq('creator_id', userId)
        .in('status', ['proposed', 'confirmed'])
        .order('suggested_time', { ascending: true });

      if (planError) {
        if (planError.code === '42P01' || planError.code === '42P17') {
          setPlans([]);
          return;
        }
        throw planError;
      }

      if (!planData || planData.length === 0) {
        setPlans([]);
        return;
      }

      // Fetch participants for each plan
      const planIds = planData.map((p: any) => p.id);
      const { data: participantData, error: partError } = await supabase
        .from('plan_participants')
        .select(`
          id,
          plan_id,
          user_id,
          rsvp_status,
          users ( name )
        `)
        .in('plan_id', planIds);

      if (partError) {
        console.error('[MyPlans] Error loading participants:', partError);
      }

      // Group participants by plan
      const participantsByPlan: Record<string, Participant[]> = {};
      (participantData || []).forEach((p: any) => {
        if (!participantsByPlan[p.plan_id]) participantsByPlan[p.plan_id] = [];
        const userName = Array.isArray(p.users) ? p.users[0]?.name : p.users?.name;
        participantsByPlan[p.plan_id].push({
          id: p.id,
          user_id: p.user_id,
          rsvp_status: p.rsvp_status,
          name: userName || undefined,
        });
      });

      const result: MyGroupPlan[] = planData.map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        suggested_time: p.suggested_time,
        meeting_address: p.meeting_address,
        status: p.status,
        participants: participantsByPlan[p.id] || [],
      }));

      setPlans(result);
    } catch (error) {
      console.error('[MyPlans] Error:', error);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleUpdateStatus = async (planId: string, newStatus: 'confirmed' | 'cancelled') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUpdating(planId);

    try {
      if (userId === 'demo-user-123') {
        setPlans((prev) => prev.filter((p) => p.id !== planId));
        Alert.alert('Done', newStatus === 'confirmed' ? 'Plan confirmed!' : 'Plan cancelled.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onRefresh?.();
        return;
      }

      const { error } = await supabase
        .from('group_plans')
        .update({
          status: newStatus,
          ...(newStatus === 'confirmed' ? { confirmed_at: new Date().toISOString() } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (error) throw error;

      setPlans((prev) => prev.filter((p) => p.id !== planId));
      Alert.alert('Done', newStatus === 'confirmed' ? 'Plan confirmed!' : 'Plan cancelled.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRefresh?.();
    } catch (error) {
      console.error('[MyPlans] Update error:', error);
      Alert.alert('Error', 'Failed to update plan. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={BrandColors.loopBlue} />
      </View>
    );
  }

  if (plans.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="clipboard" size={20} color={BrandColors.loopBlue} />
        <Text style={[Typography.titleMedium, { color: colors.text, marginLeft: Spacing.sm }]}>
          My Group Plans
        </Text>
        <View style={[styles.badge, { backgroundColor: BrandColors.loopBlue }]}>
          <Text style={[Typography.labelSmall, { color: '#ffffff' }]}>{plans.length}</Text>
        </View>
      </View>

      {plans.map((plan) => (
        <View
          key={plan.id}
          style={[styles.card, { backgroundColor: isDark ? '#1f2123' : '#ffffff' }]}
        >
          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text style={[Typography.titleMedium, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                {plan.title}
              </Text>
              <View style={[styles.statusChip, { backgroundColor: plan.status === 'confirmed' ? BrandColors.loopGreen + '20' : BrandColors.loopOrange + '20' }]}>
                <Text style={[Typography.labelSmall, { color: plan.status === 'confirmed' ? BrandColors.loopGreen : BrandColors.loopOrange }]}>
                  {plan.status === 'confirmed' ? 'Confirmed' : 'Proposed'}
                </Text>
              </View>
            </View>

            <View style={styles.detailsRow}>
              <Ionicons name="time-outline" size={14} color={colors.icon} />
              <Text style={[Typography.bodySmall, { color: colors.icon, marginLeft: 4 }]}>
                {formatDate(plan.suggested_time)}
              </Text>
            </View>

            {plan.meeting_address && (
              <View style={styles.detailsRow}>
                <Ionicons name="location-outline" size={14} color={colors.icon} />
                <Text style={[Typography.bodySmall, { color: colors.icon, marginLeft: 4 }]} numberOfLines={1}>
                  {plan.meeting_address}
                </Text>
              </View>
            )}

            {/* Participant avatars with RSVP badges */}
            {plan.participants.length > 0 && (
              <View style={styles.participantsRow}>
                {plan.participants.map((participant) => {
                  const config = RSVP_CONFIG[participant.rsvp_status] || RSVP_CONFIG.invited;
                  return (
                    <View key={participant.id} style={styles.participantChip}>
                      <View style={[styles.participantAvatar, { borderColor: config.color, borderWidth: 2 }]}>
                        <Text style={[styles.participantInitials, { color: colors.text }]}>
                          {getInitials(participant.name)}
                        </Text>
                      </View>
                      <Text style={[Typography.labelSmall, { color: colors.icon }]} numberOfLines={1}>
                        {participant.name?.split(' ')[0] || 'Friend'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: BrandColors.loopGreen }]}
              onPress={() => handleUpdateStatus(plan.id, 'confirmed')}
              disabled={updating === plan.id || plan.status === 'confirmed'}
            >
              {updating === plan.id ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#ffffff" />
                  <Text style={[Typography.labelMedium, { color: '#ffffff', marginLeft: 4 }]}>Confirm</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton, { borderColor: BrandColors.error }]}
              onPress={() => {
                Alert.alert(
                  'Cancel Plan?',
                  'This will notify all participants.',
                  [
                    { text: 'Keep', style: 'cancel' },
                    { text: 'Cancel Plan', style: 'destructive', onPress: () => handleUpdateStatus(plan.id, 'cancelled') },
                  ]
                );
              }}
              disabled={updating === plan.id}
            >
              <Ionicons name="close" size={18} color={BrandColors.error} />
              <Text style={[Typography.labelMedium, { color: BrandColors.error, marginLeft: 4 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  loadingContainer: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: Spacing.sm,
  },
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  cardContent: {
    marginBottom: Spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  participantsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  participantChip: {
    alignItems: 'center',
    gap: 2,
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantInitials: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    minHeight: 40,
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
});
