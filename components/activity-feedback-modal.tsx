/**
 * Activity Feedback Modal
 * Collects user feedback after completing activities to improve recommendations
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { BrandColors, ThemeColors, Typography, Spacing, BorderRadius } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ActivityFeedbackModalProps {
  visible: boolean;
  activityName: string;
  activityId: string;
  onClose: () => void;
  onSubmit: (feedback: {
    rating: 'thumbs_up' | 'thumbs_down';
    tags?: string[];
    notes?: string;
  }) => void;
}

const NEGATIVE_TAGS = [
  { id: 'too_expensive', label: 'Too expensive', icon: 'cash-outline' },
  { id: 'too_far', label: 'Too far', icon: 'location-outline' },
  { id: 'too_crowded', label: 'Too crowded', icon: 'people-outline' },
  { id: 'boring', label: 'Boring', icon: 'sad-outline' },
  { id: 'bad_weather', label: 'Bad weather', icon: 'rainy-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

export function ActivityFeedbackModal({
  visible,
  activityName,
  activityId,
  onClose,
  onSubmit,
}: ActivityFeedbackModalProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const [rating, setRating] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);

  const handleRating = (selectedRating: 'thumbs_up' | 'thumbs_down') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRating(selectedRating);

    if (selectedRating === 'thumbs_down') {
      setShowFollowUp(true);
    } else {
      // For thumbs up, submit immediately
      handleSubmit(selectedRating, [], '');
    }
  };

  const toggleTag = (tagId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = (
    finalRating: 'thumbs_up' | 'thumbs_down',
    finalTags: string[],
    finalNotes: string
  ) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit({
      rating: finalRating,
      tags: finalTags.length > 0 ? finalTags : undefined,
      notes: finalNotes.trim() || undefined,
    });
    handleClose();
  };

  const handleClose = () => {
    // Reset state
    setRating(null);
    setSelectedTags([]);
    setNotes('');
    setShowFollowUp(false);
    onClose();
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      {visible && (
        <BlurView intensity={40} style={styles.backdrop}>
          <Pressable style={styles.backdrop} onPress={handleClose}>
            <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {showFollowUp ? "What didn't work?" : 'How was it?'}
              </Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
            >
              {/* Activity Name */}
              <View style={[styles.activityNameContainer, { backgroundColor: colors.card }]}>
                <Ionicons name="location" size={20} color={BrandColors.loopBlue} />
                <Text style={[styles.activityName, { color: colors.text }]} numberOfLines={2}>
                  {activityName}
                </Text>
              </View>

              {!showFollowUp ? (
                // Initial Rating
                <>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Your feedback helps us suggest better activities 🎯
                  </Text>

                  <View style={styles.ratingButtons}>
                    <TouchableOpacity
                      style={[
                        styles.ratingButton,
                        styles.thumbsUpButton,
                        rating === 'thumbs_up' && styles.ratingButtonSelected,
                      ]}
                      onPress={() => handleRating('thumbs_up')}
                    >
                      <Ionicons
                        name={rating === 'thumbs_up' ? 'thumbs-up' : 'thumbs-up-outline'}
                        size={40}
                        color={rating === 'thumbs_up' ? '#fff' : '#10B981'}
                      />
                      <Text
                        style={[
                          styles.ratingButtonText,
                          rating === 'thumbs_up' && styles.ratingButtonTextSelected,
                        ]}
                      >
                        Loved it
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.ratingButton,
                        styles.thumbsDownButton,
                        rating === 'thumbs_down' && styles.ratingButtonSelected,
                      ]}
                      onPress={() => handleRating('thumbs_down')}
                    >
                      <Ionicons
                        name={rating === 'thumbs_down' ? 'thumbs-down' : 'thumbs-down-outline'}
                        size={40}
                        color={rating === 'thumbs_down' ? '#fff' : '#EF4444'}
                      />
                      <Text
                        style={[
                          styles.ratingButtonText,
                          rating === 'thumbs_down' && styles.ratingButtonTextSelected,
                        ]}
                      >
                        Not great
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                    <Text style={styles.skipButtonText}>Skip</Text>
                  </TouchableOpacity>
                </>
              ) : (
                // Follow-up Questions (for thumbs down)
                <>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Help us understand what went wrong (optional)
                  </Text>

                  {/* Tags */}
                  <View style={styles.tagsContainer}>
                    {NEGATIVE_TAGS.map((tag) => {
                      const isSelected = selectedTags.includes(tag.id);
                      return (
                        <TouchableOpacity
                          key={tag.id}
                          style={[
                            styles.tag,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            isSelected && styles.tagSelected,
                          ]}
                          onPress={() => toggleTag(tag.id)}
                        >
                          <Ionicons
                            name={tag.icon as any}
                            size={18}
                            color={isSelected ? '#fff' : colors.icon}
                          />
                          <Text
                            style={[
                              styles.tagText,
                              { color: colors.text },
                              isSelected && styles.tagTextSelected,
                            ]}
                          >
                            {tag.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Optional Notes */}
                  <TextInput
                    style={[
                      styles.notesInput,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder="Tell us more (optional)"
                    placeholderTextColor={colors.icon}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    maxLength={300}
                  />

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={() => handleSubmit('thumbs_down', selectedTags, notes)}
                  >
                    <Text style={styles.submitButtonText}>Submit Feedback</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                    <Text style={styles.skipButtonText}>Skip</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </BlurView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: '#000',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
  },
  activityNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  ratingButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: Spacing.sm,
  },
  thumbsUpButton: {
    backgroundColor: '#10B98110',
    borderColor: '#10B981',
  },
  thumbsDownButton: {
    backgroundColor: '#EF444410',
    borderColor: '#EF4444',
  },
  ratingButtonSelected: {
    backgroundColor: BrandColors.loopBlue,
    borderColor: BrandColors.loopBlue,
  },
  ratingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  ratingButtonTextSelected: {
    color: '#fff',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  tagSelected: {
    backgroundColor: BrandColors.loopBlue,
    borderColor: BrandColors.loopBlue,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tagTextSelected: {
    color: '#fff',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    minHeight: 100,
    marginBottom: Spacing.lg,
  },
  submitButton: {
    backgroundColor: BrandColors.loopBlue,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    color: '#888',
  },
});
