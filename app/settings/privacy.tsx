/**
 * Privacy Settings Screen
 * Controls Loop visibility, discoverability, location sharing, group invites
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Spacing, BorderRadius, BrandColors } from '@/constants/brand';

type LoopVisibility = 'nobody' | 'friends' | 'everyone';
type InviteSetting = 'no_one' | 'close_friends' | 'friends' | 'everyone';

export default function PrivacyScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user, updateUserProfile } = useAuth();

  const privacy = user?.privacy_settings || {};
  const groupInviteSettings = privacy.group_invite_settings || {};

  const [shareLoopWith, setShareLoopWith] = useState<LoopVisibility>(privacy.share_loop_with || 'friends');
  const [discoverable, setDiscoverable] = useState(privacy.discoverable !== false);
  const [shareLocation, setShareLocation] = useState(privacy.share_location !== false);
  const [whoCanInvite, setWhoCanInvite] = useState<InviteSetting>(groupInviteSettings.who_can_invite || 'friends');

  const persist = async (updates: Record<string, any>) => {
    const merged = { ...(user?.privacy_settings || {}), ...updates };
    await updateUserProfile({ privacy_settings: merged });
  };

  const handleShareLoop = (val: LoopVisibility) => {
    setShareLoopWith(val);
    persist({ share_loop_with: val });
  };

  const handleDiscoverable = (val: boolean) => {
    setDiscoverable(val);
    persist({ discoverable: val });
  };

  const handleShareLocation = (val: boolean) => {
    setShareLocation(val);
    persist({ share_location: val });
  };

  const handleWhoCanInvite = (val: InviteSetting) => {
    setWhoCanInvite(val);
    const existingGroupSettings = user?.privacy_settings?.group_invite_settings || {};
    persist({
      group_invite_settings: { ...existingGroupSettings, who_can_invite: val },
    });
  };

  const SegmentedControl = ({
    options,
    selected,
    onSelect,
  }: {
    options: { label: string; value: string }[];
    selected: string;
    onSelect: (v: any) => void;
  }) => (
    <View style={[styles.segmented, { backgroundColor: colors.border }]}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[
            styles.segmentedOption,
            selected === opt.value && { backgroundColor: BrandColors.loopBlue },
          ]}
          onPress={() => onSelect(opt.value)}
        >
          <Text
            style={[
              styles.segmentedText,
              { color: selected === opt.value ? '#fff' : colors.text },
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Who Can See My Loop */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Who Can See My Loop</Text>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            Controls who can view your daily activity loop.
          </Text>
          <SegmentedControl
            options={[
              { label: 'Nobody', value: 'nobody' },
              { label: 'Friends', value: 'friends' },
              { label: 'Everyone', value: 'everyone' },
            ]}
            selected={shareLoopWith}
            onSelect={handleShareLoop}
          />
        </View>

        {/* Discoverable */}
        <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowContent}>
            <View style={[styles.rowIcon, { backgroundColor: BrandColors.loopBlue + '20' }]}>
              <Ionicons name="search" size={22} color={BrandColors.loopBlue} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Discoverable</Text>
              <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                Allow other users to find you by email or phone
              </Text>
            </View>
          </View>
          <Switch
            value={discoverable}
            onValueChange={handleDiscoverable}
            trackColor={{ true: BrandColors.loopBlue }}
          />
        </View>

        {/* Share Location */}
        <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowContent}>
            <View style={[styles.rowIcon, { backgroundColor: BrandColors.loopGreen + '20' }]}>
              <Ionicons name="location" size={22} color={BrandColors.loopGreen} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Share Location</Text>
              <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                Share your location with friends for group planning
              </Text>
            </View>
          </View>
          <Switch
            value={shareLocation}
            onValueChange={handleShareLocation}
            trackColor={{ true: BrandColors.loopBlue }}
          />
        </View>

        {/* Group Invites */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Group Invites</Text>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            Controls who can invite you to group activities.
          </Text>
          <SegmentedControl
            options={[
              { label: 'Nobody', value: 'no_one' },
              { label: 'Close', value: 'close_friends' },
              { label: 'Friends', value: 'friends' },
              { label: 'Everyone', value: 'everyone' },
            ]}
            selected={whoCanInvite}
            onSelect={handleWhoCanInvite}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.xs },
  sectionDescription: { fontSize: 13, lineHeight: 18, marginBottom: Spacing.md },
  segmented: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  segmentedOption: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedText: { fontSize: 14, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  rowContent: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: Spacing.md },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowDescription: { fontSize: 12, lineHeight: 16 },
});
