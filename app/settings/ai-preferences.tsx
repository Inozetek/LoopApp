/**
 * AI Preferences Screen
 * Controls discovery mode, social context, calendar learning, etc.
 */

import React, { useState, useEffect } from 'react';
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

type DiscoveryMode = 'for_you' | 'explore';
type DataSharingLevel = 'minimal' | 'standard' | 'full';

export default function AIPreferencesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user, updateUserProfile } = useAuth();

  const prefs = user?.preferences || {};

  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>(prefs.discovery_mode === 'explore' ? 'explore' : 'for_you');
  const [friendSocialRecs, setFriendSocialRecs] = useState(prefs.friend_social_recs_enabled !== false);
  const [calendarLearning, setCalendarLearning] = useState(prefs.calendar_learning_enabled !== false);
  const [smartScheduling, setSmartScheduling] = useState(prefs.smart_scheduling_enabled ?? false);
  const [dataSharingLevel, setDataSharingLevel] = useState<DataSharingLevel>(prefs.data_sharing_level || 'standard');

  const persist = async (updates: Record<string, any>) => {
    const merged = { ...(user?.preferences || {}), ...updates };
    await updateUserProfile({ preferences: merged });
  };

  const handleDiscoveryMode = (mode: DiscoveryMode) => {
    setDiscoveryMode(mode);
    persist({ discovery_mode: mode });
  };

  const handleFriendSocialRecs = (val: boolean) => {
    setFriendSocialRecs(val);
    persist({ friend_social_recs_enabled: val });
  };

  const handleCalendarLearning = (val: boolean) => {
    setCalendarLearning(val);
    persist({ calendar_learning_enabled: val });
  };

  const handleSmartScheduling = (val: boolean) => {
    setSmartScheduling(val);
    persist({ smart_scheduling_enabled: val });
  };

  const handleDataSharing = (level: DataSharingLevel) => {
    setDataSharingLevel(level);
    persist({ data_sharing_level: level });
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>AI Preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Discovery Mode */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Discovery Mode</Text>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            For You shows personalized picks. Explore surfaces more adventurous suggestions.
          </Text>
          <SegmentedControl
            options={[
              { label: 'For You', value: 'for_you' },
              { label: 'Explore', value: 'explore' },
            ]}
            selected={discoveryMode}
            onSelect={handleDiscoveryMode}
          />
        </View>

        {/* Friend Social Context */}
        <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowContent}>
            <View style={[styles.rowIcon, { backgroundColor: BrandColors.loopGreen + '20' }]}>
              <Ionicons name="people" size={22} color={BrandColors.loopGreen} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Friend Social Context</Text>
              <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                Boost recommendations based on friends activity
              </Text>
            </View>
          </View>
          <Switch
            value={friendSocialRecs}
            onValueChange={handleFriendSocialRecs}
            trackColor={{ true: BrandColors.loopBlue }}
          />
        </View>

        {/* Calendar Learning */}
        <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowContent}>
            <View style={[styles.rowIcon, { backgroundColor: BrandColors.loopOrange + '20' }]}>
              <Ionicons name="calendar" size={22} color={BrandColors.loopOrange} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Calendar Learning</Text>
              <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                Use your calendar patterns to improve suggestions
              </Text>
            </View>
          </View>
          <Switch
            value={calendarLearning}
            onValueChange={handleCalendarLearning}
            trackColor={{ true: BrandColors.loopBlue }}
          />
        </View>

        {/* Smart Scheduling */}
        <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowContent}>
            <View style={[styles.rowIcon, { backgroundColor: BrandColors.loopPurple + '20' }]}>
              <Ionicons name="time" size={22} color={BrandColors.loopPurple} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Smart Scheduling</Text>
              <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                Automatically detect routines from location data (coming soon)
              </Text>
            </View>
          </View>
          <Switch
            value={smartScheduling}
            onValueChange={handleSmartScheduling}
            trackColor={{ true: BrandColors.loopBlue }}
          />
        </View>

        {/* Data Sharing */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Data Sharing</Text>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            Controls how much behavioral data is used for recommendations.
          </Text>
          <SegmentedControl
            options={[
              { label: 'Minimal', value: 'minimal' },
              { label: 'Standard', value: 'standard' },
              { label: 'Full', value: 'full' },
            ]}
            selected={dataSharingLevel}
            onSelect={handleDataSharing}
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
