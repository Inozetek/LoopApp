/**
 * Recommendation History Modal
 *
 * Accessible from Profile Drawer ("History" row).
 * Right-side AnimatedDrawer with 3 tabs: Accepted, Passed, All
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { getRecommendationHistory, type HistoryItem } from '@/services/recommendation-persistence';
import { AnimatedDrawer } from '@/components/animated-drawer';

type HistoryTab = 'accepted' | 'passed' | 'feedback';

interface RecommendationHistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

function HistoryItemCard({ item, colors }: { item: HistoryItem; colors: any }) {
  const statusIcon = item.status === 'accepted' ? 'checkmark-circle' :
                     item.status === 'declined' ? 'close-circle' :
                     item.status === 'not_interested' ? 'ban' : 'time';
  const statusColor = item.status === 'accepted' ? BrandColors.success :
                      item.status === 'declined' ? BrandColors.loopOrange :
                      item.status === 'not_interested' ? BrandColors.error : colors.textSecondary;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={[styles.historyCard, { backgroundColor: colors.cardBackground }]}>
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.historyPhoto} />
      ) : (
        <View style={[styles.historyPhotoPlaceholder, { backgroundColor: colors.border }]}>
          <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.historyContent}>
        <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.historyCategory, { color: colors.textSecondary }]}>
          {item.category}
        </Text>
        <View style={styles.historyMeta}>
          <Ionicons name={statusIcon as any} size={14} color={statusColor} />
          <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function RecommendationHistoryModal({ visible, onClose }: RecommendationHistoryModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<HistoryTab>('accepted');
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async (tab: HistoryTab) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const mappedTab = tab === 'feedback' ? 'all' : tab;
      const data = await getRecommendationHistory(user.id, mappedTab, 50, 0);
      setItems(data);
    } catch (error) {
      console.error('Error fetching history:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (visible) {
      fetchHistory(activeTab);
    }
  }, [visible, activeTab, fetchHistory]);

  const handleTabChange = (tab: HistoryTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const tabs: { key: HistoryTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'accepted', label: 'Accepted', icon: 'checkmark-circle-outline' },
    { key: 'passed', label: 'Passed', icon: 'close-circle-outline' },
    { key: 'feedback', label: 'All', icon: 'list-outline' },
  ];

  return (
    <AnimatedDrawer
      visible={visible}
      onClose={onClose}
      side="right"
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>History</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Tab Bar */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => handleTabChange(tab.key)}
              style={[
                styles.tab,
                activeTab === tab.key && styles.tabActive,
                activeTab === tab.key && { borderBottomColor: BrandColors.loopBlue },
              ]}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={activeTab === tab.key ? BrandColors.loopBlue : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === tab.key ? BrandColors.loopBlue : colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BrandColors.loopBlue} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No {activeTab === 'accepted' ? 'accepted' : activeTab === 'passed' ? 'passed' : ''} recommendations yet
            </Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              {activeTab === 'accepted'
                ? 'Activities you add to your calendar will appear here'
                : activeTab === 'passed'
                ? 'Recommendations you pass on will appear here'
                : 'Your recommendation history will appear here'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={({ item }) => <HistoryItemCard item={item} colors={colors} />}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </AnimatedDrawer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    ...Typography.headlineMedium,
    fontFamily: 'Urbanist-Bold',
  },
  closeButton: {
    padding: Spacing.xs,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabLabel: {
    ...Typography.labelMedium,
    fontFamily: 'Urbanist-SemiBold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.titleMedium,
    fontFamily: 'Urbanist-Bold',
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptyMessage: {
    ...Typography.bodyMedium,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  historyCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  historyPhoto: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
  },
  historyPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyContent: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: 'center',
  },
  historyTitle: {
    ...Typography.bodyMedium,
    fontFamily: 'Urbanist-SemiBold',
  },
  historyCategory: {
    ...Typography.bodySmall,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  historyDate: {
    ...Typography.bodySmall,
  },
});
