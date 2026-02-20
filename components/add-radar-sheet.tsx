/**
 * Add Radar Bottom Sheet
 *
 * Two-step flow:
 * 1. Select radar type (Artist, Film, Category, Venue, Friends)
 * 2. Search/configure the specific entity
 *
 * Tier gating: shows upgrade prompt when user hits limit
 * or tries to use a Plus-only feature (venue, proximity).
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { ThemeColors, BrandColors, Spacing, BorderRadius } from '@/constants/brand';
import {
  createRadar,
  checkRadarLimit,
} from '@/services/radar-service';
import {
  HOOK_TYPE_META,
  RADAR_LIMITS,
} from '@/types/radar';
import type { HookType, CreateRadarParams } from '@/types/radar';
import type { SubscriptionTier } from '@/types/subscription';
import type { InterestCategory } from '@/types/activity';
import { UpgradePromptModal } from '@/components/upgrade-prompt-modal';
import type { GatedFeature } from '@/utils/tier-gate';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Interest categories available for category radars */
const CATEGORY_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: 'live_music', label: 'Live Music', icon: '🎵' },
  { value: 'comedy', label: 'Comedy Shows', icon: '😂' },
  { value: 'arts', label: 'Art Exhibitions', icon: '🎨' },
  { value: 'sports', label: 'Sports Events', icon: '🏟️' },
  { value: 'dining', label: 'Food Festivals', icon: '🍽️' },
  { value: 'shopping', label: 'Pop-up Shops', icon: '🛍️' },
  { value: 'outdoor', label: 'Outdoor Events', icon: '🏕️' },
  { value: 'nightlife', label: 'Nightlife', icon: '🌙' },
  { value: 'wellness', label: 'Wellness', icon: '🧘' },
  { value: 'culture', label: 'Cultural Events', icon: '🏛️' },
  { value: 'family', label: 'Family Activities', icon: '👨‍👩‍👧' },
  { value: 'events', label: 'Community Events', icon: '🤝' },
];

/** Radar types available for selection */
const RADAR_TYPES: { type: HookType; plusOnly: boolean }[] = [
  { type: 'artist', plusOnly: false },
  { type: 'film_talent', plusOnly: false },
  { type: 'category', plusOnly: false },
  { type: 'venue', plusOnly: true },
  { type: 'proximity', plusOnly: true },
];

// ============================================================================
// PROPS
// ============================================================================

export interface RadarPrefillData {
  hookType: HookType;
  entityName?: string;
  category?: string;
}

interface AddRadarSheetProps {
  visible: boolean;
  onClose: () => void;
  onRadarCreated: () => void;
  tier: SubscriptionTier;
  onUpgrade?: () => void;
  /** Pre-fill data from activity card "Add to Radar" flow */
  prefillData?: RadarPrefillData;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AddRadarSheet({
  visible,
  onClose,
  onRadarCreated,
  tier,
  onUpgrade,
  prefillData,
}: AddRadarSheetProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? ThemeColors.dark : ThemeColors.light;
  const { user } = useAuth();

  const [step, setStep] = useState<'type' | 'configure'>('type');
  const [selectedType, setSelectedType] = useState<HookType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<GatedFeature>('radar_limit');

  const userId = user?.id || 'demo-user-123';
  const limits = RADAR_LIMITS[tier];

  // Handle prefill data (from activity card "Add to Radar" flow)
  useEffect(() => {
    if (visible && prefillData) {
      setSelectedType(prefillData.hookType);
      if (prefillData.entityName) {
        setSearchQuery(prefillData.entityName);
      }
      if (prefillData.category) {
        setSelectedCategory(prefillData.category);
      }
      setStep('configure');
    }
  }, [visible, prefillData]);

  const handleClose = () => {
    setStep('type');
    setSelectedType(null);
    setSearchQuery('');
    setSelectedCategory(null);
    onClose();
  };

  const showUpgradeModal = (feature: GatedFeature) => {
    setUpgradeFeature(feature);
    setUpgradeModalVisible(true);
  };

  const handleUpgradeFromModal = () => {
    setUpgradeModalVisible(false);
    onUpgrade?.();
  };

  const handleSelectType = async (hookType: HookType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Check if Plus only — show upgrade prompt modal
    const typeConfig = RADAR_TYPES.find(t => t.type === hookType);
    if (typeConfig?.plusOnly && tier === 'free') {
      const feature: GatedFeature = hookType === 'venue' ? 'radar_venue' : 'radar_proximity';
      showUpgradeModal(feature);
      return;
    }

    // Check limit
    const limitCheck = await checkRadarLimit(userId, hookType, tier);
    if (!limitCheck.canCreate) {
      if (limitCheck.upgradeRequired) {
        showUpgradeModal('radar_limit');
      } else {
        Alert.alert(
          'Radar Limit Reached',
          limitCheck.reason || 'You have reached the maximum number of radars.',
          [{ text: 'OK' }]
        );
      }
      return;
    }

    setSelectedType(hookType);
    setStep('configure');
  };

  const handleCreate = async () => {
    if (!selectedType) return;

    const params: CreateRadarParams = {
      userId,
      hookType: selectedType,
    };

    // Configure based on type
    switch (selectedType) {
      case 'artist':
      case 'film_talent':
      case 'venue':
        if (!searchQuery.trim()) {
          Alert.alert('Required', 'Please enter a name to track.');
          return;
        }
        params.entityName = searchQuery.trim();
        break;
      case 'category':
        if (!selectedCategory) {
          Alert.alert('Required', 'Please select a category.');
          return;
        }
        params.category = selectedCategory;
        params.entityName = CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.label;
        break;
      case 'proximity':
        // TODO: friend selection UI
        params.entityName = 'Friends Nearby';
        break;
    }

    setCreating(true);
    const result = await createRadar(params, tier);
    setCreating(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRadarCreated();
      handleClose();
    } else {
      Alert.alert('Error', result.error || 'Failed to create radar.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.modal, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View style={styles.sheetHeader}>
          <Pressable onPress={step === 'configure' ? () => setStep('type') : handleClose}>
            <Ionicons
              name={step === 'configure' ? 'arrow-back' : 'close'}
              size={24}
              color={colors.text}
            />
          </Pressable>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            {step === 'type' ? 'Add a Radar' : `New ${HOOK_TYPE_META[selectedType!]?.label} Radar`}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {step === 'type' ? (
          <TypeSelectionStep
            colors={colors}
            isDark={isDark}
            tier={tier}
            onSelectType={handleSelectType}
          />
        ) : (
          <ConfigureStep
            colors={colors}
            isDark={isDark}
            hookType={selectedType!}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            onCreate={handleCreate}
            creating={creating}
          />
        )}
      </KeyboardAvoidingView>

      {/* Upgrade Prompt Modal */}
      <UpgradePromptModal
        visible={upgradeModalVisible}
        onClose={() => setUpgradeModalVisible(false)}
        feature={upgradeFeature}
        onUpgrade={handleUpgradeFromModal}
      />
    </Modal>
  );
}

// ============================================================================
// STEP 1: TYPE SELECTION
// ============================================================================

function TypeSelectionStep({
  colors,
  isDark,
  tier,
  onSelectType,
}: {
  colors: typeof ThemeColors.light;
  isDark: boolean;
  tier: SubscriptionTier;
  onSelectType: (type: HookType) => void;
}) {
  return (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent}>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        What do you want to track?
      </Text>

      <View style={styles.typeGrid}>
        {RADAR_TYPES.map(({ type, plusOnly }) => {
          const meta = HOOK_TYPE_META[type];
          const isLocked = plusOnly && tier === 'free';

          return (
            <Pressable
              key={type}
              style={[
                styles.typeCard,
                {
                  backgroundColor: colors.cardBackground,
                  opacity: isLocked ? 0.6 : 1,
                },
              ]}
              onPress={() => onSelectType(type)}
            >
              <Text style={styles.typeIcon}>{meta.icon}</Text>
              <Text style={[styles.typeLabel, { color: colors.text }]}>{meta.label}</Text>
              {isLocked && (
                <View style={styles.plusBadge}>
                  <Text style={styles.plusBadgeText}>PLUS</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ============================================================================
// STEP 2: CONFIGURE
// ============================================================================

function ConfigureStep({
  colors,
  isDark,
  hookType,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategorySelect,
  onCreate,
  creating,
}: {
  colors: typeof ThemeColors.light;
  isDark: boolean;
  hookType: HookType;
  searchQuery: string;
  onSearchChange: (text: string) => void;
  selectedCategory: string | null;
  onCategorySelect: (category: string) => void;
  onCreate: () => void;
  creating: boolean;
}) {
  const isSearchType = hookType === 'artist' || hookType === 'film_talent' || hookType === 'venue';
  const isCategoryType = hookType === 'category';

  const placeholder = {
    artist: 'Search for an artist...',
    film_talent: 'Search actors, directors...',
    venue: 'Search for a venue...',
    category: '',
    proximity: '',
  }[hookType];

  return (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent}>
      {/* Search input for artist/film/venue */}
      {isSearchType && (
        <View style={[styles.searchContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoFocus
            returnKeyType="done"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => onSearchChange('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}

      {/* Category grid */}
      {isCategoryType && (
        <View style={styles.categoryGrid}>
          {CATEGORY_OPTIONS.map(cat => (
            <Pressable
              key={cat.value}
              style={[
                styles.categoryChip,
                {
                  backgroundColor:
                    selectedCategory === cat.value
                      ? 'rgba(139, 92, 246, 0.15)'
                      : colors.cardBackground,
                  borderColor:
                    selectedCategory === cat.value
                      ? BrandColors.loopPurple
                      : 'transparent',
                  borderWidth: selectedCategory === cat.value ? 1.5 : 0,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onCategorySelect(cat.value);
              }}
            >
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  {
                    color:
                      selectedCategory === cat.value
                        ? BrandColors.loopPurple
                        : colors.text,
                    fontWeight: selectedCategory === cat.value ? '600' : '400',
                  },
                ]}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Proximity placeholder */}
      {hookType === 'proximity' && (
        <View style={[styles.proximityPlaceholder, { backgroundColor: colors.cardBackground }]}>
          <Ionicons name="people-outline" size={40} color={colors.textSecondary} />
          <Text style={[styles.proximityText, { color: colors.textSecondary }]}>
            Friend proximity radars will alert you when selected friends are nearby and both have free time.
          </Text>
        </View>
      )}

      {/* Create button */}
      <Pressable
        style={[
          styles.createButton,
          {
            backgroundColor: BrandColors.loopPurple,
            opacity: creating ? 0.6 : 1,
          },
        ]}
        onPress={onCreate}
        disabled={creating}
      >
        <Ionicons name="radio-outline" size={18} color="#FFFFFF" />
        <Text style={styles.createButtonText}>
          {creating ? 'Creating...' : 'Create Radar'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  modal: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  stepContainer: {
    flex: 1,
  },
  stepContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  stepDescription: {
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeCard: {
    width: '47%',
    aspectRatio: 1.2,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    position: 'relative',
  },
  typeIcon: {
    fontSize: 32,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  plusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: BrandColors.loopPurple,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  plusBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryLabel: {
    fontSize: 14,
  },
  proximityPlaceholder: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  proximityText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddRadarSheet;
