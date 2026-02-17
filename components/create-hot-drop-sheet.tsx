/**
 * Create Hot Drop Sheet — Business-facing creation modal
 *
 * Allows Boosted/Premium businesses to create time-limited promotions.
 * Fields: title, description, duration, total claims, category.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, BrandColors, Spacing, BorderRadius } from '@/constants/brand';
import { createHotDrop, canBusinessCreateHotDrop } from '@/services/hot-drop-service';
import type { BusinessTier } from '@/services/hot-drop-service';
import type { CreateHotDropParams } from '@/types/hot-drop';

// ============================================================================
// DURATION OPTIONS
// ============================================================================

const DURATION_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '2 hours', hours: 2 },
  { label: '4 hours', hours: 4 },
  { label: 'Today only', hours: 8 },
];

const CLAIMS_OPTIONS = [10, 25, 50, 100];

// ============================================================================
// PROPS
// ============================================================================

interface CreateHotDropSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  businessId: string;
  businessName: string;
  businessTier: BusinessTier;
  businessAddress?: string;
  businessLatitude?: number;
  businessLongitude?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CreateHotDropSheet({
  visible,
  onClose,
  onCreated,
  businessId,
  businessName,
  businessTier,
  businessAddress,
  businessLatitude,
  businessLongitude,
}: CreateHotDropSheetProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? ThemeColors.dark : ThemeColors.light;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(2); // hours
  const [totalClaims, setTotalClaims] = useState(50);
  const [category, setCategory] = useState('dining');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title for your Hot Drop.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please enter a description.');
      return;
    }

    // Check business tier
    const tierCheck = canBusinessCreateHotDrop(businessTier);
    if (!tierCheck.allowed) {
      Alert.alert('Upgrade Required', tierCheck.reason);
      return;
    }

    setCreating(true);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + selectedDuration * 60 * 60 * 1000);

    const params: CreateHotDropParams = {
      businessId,
      businessName,
      title: title.trim(),
      description: description.trim(),
      category,
      startsAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      totalClaims,
      address: businessAddress,
      latitude: businessLatitude,
      longitude: businessLongitude,
    };

    const result = await createHotDrop(params, businessTier);
    setCreating(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCreated();
      handleClose();
    } else {
      Alert.alert('Error', result.error || 'Failed to create Hot Drop.');
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setSelectedDuration(2);
    setTotalClaims(50);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.textSecondary + '20' }]}>
          <Pressable onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Create Hot Drop</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
          {/* Title */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Title</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.textSecondary + '30' }]}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., 50% Off Brisket Plate"
              placeholderTextColor={colors.textSecondary + '80'}
              maxLength={80}
              testID="hot-drop-title-input"
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.textSecondary + '30' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="What's the deal?"
              placeholderTextColor={colors.textSecondary + '80'}
              multiline
              numberOfLines={3}
              maxLength={200}
              testID="hot-drop-description-input"
            />
          </View>

          {/* Duration */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Duration</Text>
            <View style={styles.optionRow}>
              {DURATION_OPTIONS.map(opt => (
                <Pressable
                  key={opt.hours}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: selectedDuration === opt.hours
                        ? '#F97316' + '20'
                        : colors.cardBackground,
                      borderColor: selectedDuration === opt.hours
                        ? '#F97316'
                        : colors.textSecondary + '30',
                    },
                  ]}
                  onPress={() => setSelectedDuration(opt.hours)}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: selectedDuration === opt.hours ? '#F97316' : colors.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Total Claims */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Total Claims Available</Text>
            <View style={styles.optionRow}>
              {CLAIMS_OPTIONS.map(count => (
                <Pressable
                  key={count}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: totalClaims === count
                        ? '#F97316' + '20'
                        : colors.cardBackground,
                      borderColor: totalClaims === count
                        ? '#F97316'
                        : colors.textSecondary + '30',
                    },
                  ]}
                  onPress={() => setTotalClaims(count)}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: totalClaims === count ? '#F97316' : colors.textSecondary },
                    ]}
                  >
                    {count}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Pricing info */}
          <View style={[styles.pricingInfo, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.pricingText, { color: colors.textSecondary }]}>
              Cost: $1.50 per claim ({totalClaims} claims = ${(totalClaims * 1.5).toFixed(2)} max)
            </Text>
          </View>

          {/* Create button */}
          <Pressable
            style={[styles.createButton, creating && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={creating}
            testID="create-hot-drop-button"
          >
            <Text style={styles.createButtonText}>
              {creating ? 'Creating...' : '🔥 Launch Hot Drop'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 56,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Urbanist-SemiBold',
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: 40,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'Urbanist-SemiBold',
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Urbanist-Regular',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionLabel: {
    fontSize: 14,
    fontFamily: 'Urbanist-Medium',
  },
  pricingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  pricingText: {
    fontSize: 13,
    fontFamily: 'Urbanist-Regular',
    flex: 1,
  },
  createButton: {
    backgroundColor: '#F97316',
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontFamily: 'Urbanist-SemiBold',
    color: '#FFFFFF',
  },
});
