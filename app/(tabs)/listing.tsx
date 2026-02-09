/**
 * Business Listing Management Tab
 *
 * Allows business owners to view and edit their listing details.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, BrandColors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';

export default function ListingScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = ThemeColors[colorScheme];
  const insets = useSafeAreaInsets();
  const { businessProfile, updateBusinessProfile } = useAuth();

  const [businessName, setBusinessName] = useState(businessProfile?.business_name || '');
  const [businessDescription, setBusinessDescription] = useState(businessProfile?.business_description || '');
  const [phone, setPhone] = useState(businessProfile?.phone || '');
  const [website, setWebsite] = useState(businessProfile?.website || '');
  const [address, setAddress] = useState(businessProfile?.address || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (businessProfile) {
      setBusinessName(businessProfile.business_name || '');
      setBusinessDescription(businessProfile.business_description || '');
      setPhone(businessProfile.phone || '');
      setWebsite(businessProfile.website || '');
      setAddress(businessProfile.address || '');
    }
  }, [businessProfile]);

  async function handleSave() {
    if (!businessName.trim()) {
      Alert.alert('Error', 'Business name is required');
      return;
    }

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { error } = await updateBusinessProfile({
        business_name: businessName.trim(),
        business_description: businessDescription.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        address: address.trim() || null,
      } as any);

      if (error) {
        Alert.alert('Error', 'Failed to save changes');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Saved', 'Your listing has been updated');
      }
    } catch {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={[styles.headerTitle, { color: colors.text }]}>Your Listing</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Edit how your business appears to Loop users
        </Text>

        {/* Form */}
        <View style={styles.formSection}>
          <Text style={[styles.label, { color: colors.text }]}>Business Name *</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.cardBackground }]}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Your business name"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[styles.label, { color: colors.text }]}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.text, backgroundColor: colors.cardBackground }]}
            value={businessDescription}
            onChangeText={setBusinessDescription}
            placeholder="Tell customers what makes your business special"
            placeholderTextColor={colors.textSecondary}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>Category</Text>
          <View style={[styles.readOnlyField, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.readOnlyText, { color: colors.textSecondary }]}>
              {businessProfile?.business_category || 'Not set'}
            </Text>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Phone</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.cardBackground }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="(555) 123-4567"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />

          <Text style={[styles.label, { color: colors.text }]}>Website</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.cardBackground }]}
            value={website}
            onChangeText={setWebsite}
            placeholder="https://yourbusiness.com"
            placeholderTextColor={colors.textSecondary}
            keyboardType="url"
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: colors.text }]}>Address</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.cardBackground }]}
            value={address}
            onChangeText={setAddress}
            placeholder="123 Main St, City, State"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: BrandColors.loopBlue }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Preview Section */}
        <View style={[styles.previewCard, { backgroundColor: colors.cardBackground, ...Shadows.sm }]}>
          <View style={styles.previewHeader}>
            <Ionicons name="eye-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.previewTitle, { color: colors.textSecondary }]}>
              How users see your listing
            </Text>
          </View>
          <Text style={[styles.previewName, { color: colors.text }]}>{businessName || 'Business Name'}</Text>
          <Text style={[styles.previewCategory, { color: BrandColors.loopBlue }]}>
            {businessProfile?.business_category || 'Category'}
          </Text>
          {businessDescription ? (
            <Text style={[styles.previewDesc, { color: colors.textSecondary }]} numberOfLines={2}>
              {businessDescription}
            </Text>
          ) : null}
          <View style={styles.previewMeta}>
            {address ? (
              <View style={styles.previewMetaItem}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.previewMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {address}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl * 2,
  },
  headerTitle: {
    ...Typography.headlineMedium,
    marginBottom: 4,
  },
  headerSubtitle: {
    ...Typography.bodyMedium,
    marginBottom: Spacing.lg,
  },
  formSection: {
    gap: 4,
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.labelMedium,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    paddingTop: Spacing.sm,
    textAlignVertical: 'top',
  },
  readOnlyField: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  readOnlyText: {
    fontSize: 16,
  },
  saveButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  previewCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  previewTitle: {
    ...Typography.labelSmall,
  },
  previewName: {
    ...Typography.titleLarge,
    marginBottom: 4,
  },
  previewCategory: {
    ...Typography.labelMedium,
    marginBottom: Spacing.sm,
  },
  previewDesc: {
    ...Typography.bodySmall,
    marginBottom: Spacing.sm,
  },
  previewMeta: {
    gap: 4,
  },
  previewMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewMetaText: {
    ...Typography.bodySmall,
    flex: 1,
  },
});
