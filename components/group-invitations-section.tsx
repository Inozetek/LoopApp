/**
 * Group Invitations Section
 * Displays pending group activity invitations with RSVP options
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { supabase } from '@/lib/supabase';
import { BrandColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { parseLocation } from '@/utils/location-parser';

interface GroupInvitation {
  id: string;
  plan_id: string;
  rsvp_status: 'invited' | 'accepted' | 'declined' | 'maybe';
  invited_at: string;
  plan: {
    id: string;
    title: string;
    description?: string;
    suggested_time: string;
    meeting_address?: string;
    meeting_location?: { latitude: number; longitude: number } | null;
    creator_id: string;
    creator_name?: string;
  };
}

interface GroupInvitationsSectionProps {
  userId: string;
  onRefresh?: () => void;
}

export function GroupInvitationsSection({ userId, onRefresh }: GroupInvitationsSectionProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];

  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    try {
      setLoading(true);

      // For demo user, show mock invitations
      if (userId === 'demo-user-123') {
        const mockInvitations: GroupInvitation[] = [
          {
            id: 'invite-1',
            plan_id: 'plan-1',
            rsvp_status: 'invited',
            invited_at: new Date().toISOString(),
            plan: {
              id: 'plan-1',
              title: 'Dinner at Deep Ellum',
              description: 'Trying out the new Italian place',
              suggested_time: new Date(Date.now() + 86400000).toISOString(),
              meeting_address: 'Deep Ellum, Dallas',
              creator_id: 'friend-1',
              creator_name: 'Sarah Johnson',
            },
          },
          {
            id: 'invite-2',
            plan_id: 'plan-2',
            rsvp_status: 'invited',
            invited_at: new Date(Date.now() - 3600000).toISOString(),
            plan: {
              id: 'plan-2',
              title: 'Weekend Hike',
              description: 'Exploring the trails at Cedar Ridge',
              suggested_time: new Date(Date.now() + 172800000).toISOString(),
              meeting_address: 'Cedar Ridge Preserve',
              creator_id: 'friend-2',
              creator_name: 'Mike Chen',
            },
          },
        ];
        setInvitations(mockInvitations);
        setLoading(false);
        return;
      }

      // Fetch real invitations with meeting_location and creator name
      const { data, error } = await supabase
        .from('plan_participants')
        .select(`
          id,
          plan_id,
          rsvp_status,
          invited_at,
          group_plans (
            id,
            title,
            description,
            suggested_time,
            meeting_address,
            meeting_location,
            creator_id,
            users!group_plans_creator_id_fkey ( name )
          )
        `)
        .eq('user_id', userId)
        .eq('rsvp_status', 'invited')
        .order('invited_at', { ascending: false });

      if (error) {
        console.error('[Invitations] Error fetching:', error);
        // Handle known database errors gracefully:
        // - 42P01: table doesn't exist
        // - 42P17: infinite recursion in RLS policy (needs DB fix)
        // - PGRST301: RLS policy violation
        if (error.code === '42P01' || error.code === '42P17' || error.code === 'PGRST301') {
          setInvitations([]);
          return;
        }
        throw error;
      }

      // Transform data — parse meeting_location and resolve creator name
      const invitationsList: GroupInvitation[] = (data || []).map((item: any) => {
        const plan = item.group_plans;
        // Creator name from the joined users table (may be nested object or array)
        const creatorUser = plan?.users;
        const creatorName = Array.isArray(creatorUser)
          ? creatorUser[0]?.name
          : creatorUser?.name;

        return {
          id: item.id,
          plan_id: item.plan_id,
          rsvp_status: item.rsvp_status,
          invited_at: item.invited_at,
          plan: {
            id: plan?.id || item.plan_id,
            title: plan?.title || 'Group Activity',
            description: plan?.description,
            suggested_time: plan?.suggested_time || new Date().toISOString(),
            meeting_address: plan?.meeting_address,
            meeting_location: parseLocation(plan?.meeting_location),
            creator_id: plan?.creator_id || '',
            creator_name: creatorName || 'A friend',
          },
        };
      });

      setInvitations(invitationsList);
    } catch (error) {
      console.error('[Invitations] Error:', error);
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const handleRSVP = async (invitationId: string, planId: string, response: 'accepted' | 'declined' | 'maybe') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResponding(invitationId);

    try {
      // For demo user, just update local state
      if (userId === 'demo-user-123') {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));

        const responseText = response === 'accepted' ? 'See you there!' :
                            response === 'declined' ? 'Maybe next time!' :
                            'Noted as maybe!';

        Alert.alert('RSVP Sent', responseText);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onRefresh?.();
        return;
      }

      // Update RSVP in database
      const { error } = await supabase
        .from('plan_participants')
        .update({
          rsvp_status: response,
          responded_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      if (error) throw error;

      // If accepted, create a calendar event for this group plan
      if (response === 'accepted') {
        const invitation = invitations.find((inv) => inv.id === invitationId);
        if (invitation) {
          const plan = invitation.plan;
          const startTime = new Date(plan.suggested_time);
          // Default duration: 2 hours
          const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

          // Use meeting_location from the plan, fallback to 0,0 only as last resort
          const loc = plan.meeting_location;
          const locationWKT = loc
            ? `POINT(${loc.longitude} ${loc.latitude})`
            : `POINT(0 0)`;

          try {
            await supabase.from('calendar_events').insert({
              user_id: userId,
              title: plan.title || 'Group Activity',
              description: plan.description || `Group plan with friends`,
              category: 'social',
              location: locationWKT,
              address: plan.meeting_address || 'TBD',
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              source: 'group_plan',
              status: 'scheduled',
            } as any);
          } catch (calError) {
            console.error('[Invitations] Error creating calendar event:', calError);
            // Non-blocking: still show success for the RSVP
          }
        }
      }

      // Remove from local list
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));

      const responseText = response === 'accepted' ? 'See you there! Added to your calendar.' :
                          response === 'declined' ? 'Maybe next time!' :
                          'Noted as maybe!';

      Alert.alert('RSVP Sent', responseText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRefresh?.();
    } catch (error) {
      console.error('[Invitations] Error updating RSVP:', error);
      Alert.alert('Error', 'Failed to update RSVP. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setResponding(null);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={BrandColors.loopBlue} />
      </View>
    );
  }

  if (invitations.length === 0) {
    return null; // Don't show section if no invitations
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="mail-unread" size={20} color={BrandColors.loopGreen} />
        <Text style={[Typography.titleMedium, { color: colors.text, marginLeft: Spacing.sm }]}>
          Group Invitations
        </Text>
        <View style={[styles.badge, { backgroundColor: BrandColors.loopGreen }]}>
          <Text style={[Typography.labelSmall, { color: '#ffffff' }]}>{invitations.length}</Text>
        </View>
      </View>

      {invitations.map((invitation) => (
        <View
          key={invitation.id}
          style={[
            styles.card,
            { backgroundColor: isDark ? '#1f2123' : '#ffffff' },
          ]}
        >
          <View style={styles.cardContent}>
            <Text style={[Typography.titleMedium, { color: colors.text }]}>
              {invitation.plan.title}
            </Text>

            {invitation.plan.creator_name && (
              <Text style={[Typography.bodySmall, { color: colors.icon, marginTop: 4 }]}>
                From {invitation.plan.creator_name}
              </Text>
            )}

            <View style={styles.detailsRow}>
              <Ionicons name="time-outline" size={14} color={colors.icon} />
              <Text style={[Typography.bodySmall, { color: colors.icon, marginLeft: 4 }]}>
                {formatDate(invitation.plan.suggested_time)}
              </Text>
            </View>

            {invitation.plan.meeting_address && (
              <View style={styles.detailsRow}>
                <Ionicons name="location-outline" size={14} color={colors.icon} />
                <Text style={[Typography.bodySmall, { color: colors.icon, marginLeft: 4 }]} numberOfLines={1}>
                  {invitation.plan.meeting_address}
                </Text>
              </View>
            )}

            {invitation.plan.description && (
              <Text style={[Typography.bodySmall, { color: colors.text, marginTop: Spacing.sm }]} numberOfLines={2}>
                {invitation.plan.description}
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton, { backgroundColor: BrandColors.loopGreen }]}
              onPress={() => handleRSVP(invitation.id, invitation.plan_id, 'accepted')}
              disabled={responding === invitation.id}
            >
              {responding === invitation.id ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#ffffff" />
                  <Text style={[Typography.labelMedium, { color: '#ffffff', marginLeft: 4 }]}>Accept</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.maybeButton, { borderColor: colors.icon }]}
              onPress={() => handleRSVP(invitation.id, invitation.plan_id, 'maybe')}
              disabled={responding === invitation.id}
            >
              <Ionicons name="help-outline" size={18} color={colors.icon} />
              <Text style={[Typography.labelMedium, { color: colors.icon, marginLeft: 4 }]}>Maybe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton, { borderColor: BrandColors.error }]}
              onPress={() => handleRSVP(invitation.id, invitation.plan_id, 'declined')}
              disabled={responding === invitation.id}
            >
              <Ionicons name="close" size={18} color={BrandColors.error} />
              <Text style={[Typography.labelMedium, { color: BrandColors.error, marginLeft: 4 }]}>Decline</Text>
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
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
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
  acceptButton: {},
  maybeButton: {
    borderWidth: 1,
  },
  declineButton: {
    borderWidth: 1,
  },
});
