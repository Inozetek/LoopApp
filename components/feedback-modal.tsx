/**
 * Feedback Modal Component
 *
 * Prompts users for feedback after completing activities.
 * Collects thumbs up/down ratings and optional tags/notes.
 * Feeds data to ML learning system for improved recommendations.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/theme';
import { BrandColors } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { DragHandle } from '@/components/drag-handle';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  eventId: string; // Calendar event ID - required for marking event as completed
  activityId: string | null; // Can be null for manually created calendar events
  activityName: string;
  activityCategory: string;
  userId: string;
  recommendationId?: string;
  /** Called when user wants to share a positive experience as a Moment */
  onShareToLoop?: (context: {
    activityName: string;
    activityCategory: string;
    eventId: string;
    activityId: string | null;
  }) => void;
}

const FEEDBACK_TAGS = [
  { id: 'too_expensive', label: 'Too expensive', icon: 'cash-outline' },
  { id: 'too_far', label: 'Too far', icon: 'location-outline' },
  { id: 'too_crowded', label: 'Too crowded', icon: 'people-outline' },
  { id: 'boring', label: 'Boring', icon: 'sad-outline' },
  { id: 'bad_weather', label: 'Bad weather', icon: 'rainy-outline' },
  { id: 'great_value', label: 'Great value', icon: 'star' },
  { id: 'convenient', label: 'Convenient', icon: 'checkmark-circle' },
  { id: 'loved_it', label: 'Loved it!', icon: 'heart' },
];

export function FeedbackModal({
  visible,
  onClose,
  eventId,
  activityId,
  activityName,
  activityCategory,
  userId,
  recommendationId,
  onShareToLoop,
}: FeedbackModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [rating, setRating] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);

  // Reset submission states when modal closes
  useEffect(() => {
    if (!visible) {
      setSubmitting(false);
      setHasSubmitted(false);
      setShowSharePrompt(false);
    }
  }, [visible]);

  const handleRating = (newRating: 'thumbs_up' | 'thumbs_down') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRating(newRating);
    setSelectedTags([]); // Reset tags when changing rating
  };

  const toggleTag = (tagId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = async () => {
    // Prevent duplicate submissions
    if (submitting || hasSubmitted) {
      console.warn('⚠️ Duplicate submission attempt blocked:', { submitting, hasSubmitted });
      return;
    }

    if (!rating) {
      Alert.alert('Rating Required', 'Please select thumbs up or thumbs down');
      return;
    }

    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      console.log('📝 Feedback submission flow started:', {
        eventId,
        activityId,
        activityName,
        rating,
        timestamp: new Date().toISOString(),
      });

      // Check for duplicate feedback (prevent accidental double-submission)
      const completedAt = new Date().toISOString();
      const { data: existingFeedback } = await supabase
        .from('feedback')
        .select('id')
        .eq('user_id', userId)
        .eq('activity_id', activityId || '')
        .eq('rating', rating)
        .gte('completed_at', new Date(Date.now() - 60000).toISOString()) // Within last 60 seconds
        .single();

      if (existingFeedback) {
        console.warn('⚠️ Duplicate feedback detected, skipping submission');
        setHasSubmitted(true);
        onClose();
        return;
      }

      // Save feedback to database
      // Note: activity_id can be null for manually created calendar events
      const { error: feedbackError } = await supabase.from('feedback').insert({
        user_id: userId,
        activity_id: activityId || null, // Null for manual calendar events
        recommendation_id: recommendationId || null,
        rating,
        feedback_tags: selectedTags,
        feedback_notes: notes.trim() || null,
        completed_at: completedAt,
      } as any);

      if (feedbackError) throw feedbackError;

      console.log('✅ Feedback saved to database');

      // Update user's AI profile based on feedback
      await updateAIProfile(userId, rating, activityCategory, selectedTags);

      // Mark calendar event as completed
      // This prevents the feedback modal from reopening after closing
      if (eventId) {
        console.log('📅 Marking calendar event as completed:', eventId);
        const { error: updateError } = await supabase
          .from('calendar_events')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', eventId);

        if (updateError) {
          console.error('❌ Failed to update event status:', updateError);
          // Don't throw - feedback was already saved successfully
        } else {
          console.log('✅ Event marked as completed:', eventId);
        }
      }

      setHasSubmitted(true); // Prevent any future submissions
      console.log('✅ Feedback submission complete');

      // If thumbs up and share callback exists, show share prompt instead of closing
      if (rating === 'thumbs_up' && onShareToLoop) {
        setShowSharePrompt(true);
        return;
      }

      Alert.alert(
        'Thanks for your feedback!',
        'Your feedback helps us suggest better activities for you.'
      );

      onClose();
      resetForm();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setRating(null);
    setSelectedTags([]);
    setNotes('');
    setShowSharePrompt(false);
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    resetForm();
  };

  const relevantTags = rating === 'thumbs_down'
    ? FEEDBACK_TAGS.filter((tag) =>
        ['too_expensive', 'too_far', 'too_crowded', 'boring', 'bad_weather'].includes(tag.id)
      )
    : FEEDBACK_TAGS.filter((tag) =>
        ['great_value', 'convenient', 'loved_it'].includes(tag.id)
      );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <DragHandle onClose={handleClose} />
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              How was it?
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={28} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Activity name */}
            <Text style={[styles.activityName, { color: colors.text }]}>
              {activityName}
            </Text>

            {/* Rating buttons */}
            <View style={styles.ratingContainer}>
              <TouchableOpacity
                onPress={() => handleRating('thumbs_up')}
                style={[
                  styles.ratingButton,
                  rating === 'thumbs_up' && styles.ratingButtonActive,
                  {
                    backgroundColor: rating === 'thumbs_up' ? BrandColors.success : colors.card,
                    borderColor: rating === 'thumbs_up' ? BrandColors.success : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="thumbs-up"
                  size={32}
                  color={rating === 'thumbs_up' ? BrandColors.white : colors.icon}
                />
                <Text
                  style={[
                    styles.ratingText,
                    { color: rating === 'thumbs_up' ? BrandColors.white : colors.text },
                  ]}
                >
                  Loved it
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleRating('thumbs_down')}
                style={[
                  styles.ratingButton,
                  rating === 'thumbs_down' && styles.ratingButtonActive,
                  {
                    backgroundColor: rating === 'thumbs_down' ? BrandColors.error : colors.card,
                    borderColor: rating === 'thumbs_down' ? BrandColors.error : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="thumbs-down"
                  size={32}
                  color={rating === 'thumbs_down' ? BrandColors.white : colors.icon}
                />
                <Text
                  style={[
                    styles.ratingText,
                    { color: rating === 'thumbs_down' ? BrandColors.white : colors.text },
                  ]}
                >
                  Not great
                </Text>
              </TouchableOpacity>
            </View>

            {/* Feedback tags (show after rating selected) */}
            {rating && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  What made it {rating === 'thumbs_up' ? 'great' : 'not so great'}? (Optional)
                </Text>
                <View style={styles.tagsContainer}>
                  {relevantTags.map((tag) => (
                    <TouchableOpacity
                      key={tag.id}
                      onPress={() => toggleTag(tag.id)}
                      style={[
                        styles.tag,
                        selectedTags.includes(tag.id) && styles.tagActive,
                        {
                          backgroundColor: selectedTags.includes(tag.id)
                            ? colors.tint
                            : colors.card,
                          borderColor: selectedTags.includes(tag.id)
                            ? colors.tint
                            : colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={tag.icon as any}
                        size={16}
                        color={selectedTags.includes(tag.id) ? BrandColors.white : colors.icon}
                      />
                      <Text
                        style={[
                          styles.tagText,
                          {
                            color: selectedTags.includes(tag.id) ? BrandColors.white : colors.text,
                          },
                        ]}
                      >
                        {tag.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Optional notes */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Any other thoughts? (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.notesInput,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Tell us more..."
                  placeholderTextColor={colors.icon}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </>
            )}
          </ScrollView>

          {/* Share to Loop prompt — shown after positive feedback */}
          {showSharePrompt ? (
            <View style={styles.sharePrompt}>
              <View style={styles.sharePromptIcon}>
                <Ionicons name="checkmark-circle" size={48} color={BrandColors.success} />
              </View>
              <Text style={[styles.sharePromptTitle, { color: colors.text }]}>
                Thanks for the feedback!
              </Text>
              <Text style={[styles.sharePromptSubtitle, { color: colors.icon }]}>
                Share your experience with friends?
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onShareToLoop?.({
                    activityName,
                    activityCategory,
                    eventId,
                    activityId,
                  });
                  onClose();
                  resetForm();
                }}
                style={[styles.shareButton, { backgroundColor: BrandColors.loopBlue }]}
              >
                <Ionicons name="share-outline" size={20} color="#ffffff" />
                <Text style={styles.shareButtonText}>Share to Loop</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  resetForm();
                }}
                style={styles.skipShareButton}
              >
                <Text style={[styles.skipShareText, { color: colors.icon }]}>Maybe later</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Submit button */
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!rating || submitting || hasSubmitted}
              style={[
                styles.submitButton,
                {
                  backgroundColor: rating ? colors.tint : colors.border,
                  opacity: rating && !submitting && !hasSubmitted ? 1 : 0.5,
                },
              ]}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Submitting...' : hasSubmitted ? 'Submitted!' : 'Submit Feedback'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Update user's AI profile based on feedback
 * This function learns from user preferences to improve future recommendations
 */
async function updateAIProfile(
  userId: string,
  rating: 'thumbs_up' | 'thumbs_down',
  category: string,
  tags: string[]
) {
  try {
    // Fetch current user profile
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('ai_profile')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const currentProfile = (userData as any)?.ai_profile || {
      preferred_distance_miles: 5.0,
      budget_level: 2,
      favorite_categories: [],
      disliked_categories: [],
      price_sensitivity: 'medium',
      time_preferences: [],
      distance_tolerance: 'medium',
    };

    // Update profile based on feedback
    const updatedProfile = { ...currentProfile };

    if (rating === 'thumbs_up') {
      // Add to favorite categories if not already there
      if (!updatedProfile.favorite_categories.includes(category)) {
        updatedProfile.favorite_categories = [
          ...updatedProfile.favorite_categories,
          category,
        ].slice(0, 10); // Keep top 10
      }

      // Remove from disliked if it was there
      updatedProfile.disliked_categories = updatedProfile.disliked_categories.filter(
        (cat: string) => cat !== category
      );

      // Adjust preferences based on tags
      if (tags.includes('great_value')) {
        updatedProfile.price_sensitivity = 'low';
      }
      if (tags.includes('convenient')) {
        updatedProfile.distance_tolerance = 'low';
        updatedProfile.preferred_distance_miles = Math.max(
          3.0,
          updatedProfile.preferred_distance_miles - 0.5
        );
      }
    } else {
      // thumbs_down
      // Add to disliked categories if not already there
      if (!updatedProfile.disliked_categories.includes(category)) {
        updatedProfile.disliked_categories = [
          ...updatedProfile.disliked_categories,
          category,
        ].slice(0, 5); // Keep top 5
      }

      // Remove from favorites if it was there
      updatedProfile.favorite_categories = updatedProfile.favorite_categories.filter(
        (cat: string) => cat !== category
      );

      // Adjust preferences based on tags
      if (tags.includes('too_expensive')) {
        updatedProfile.budget_level = Math.max(0, updatedProfile.budget_level - 1);
        updatedProfile.price_sensitivity = 'high';
      }
      if (tags.includes('too_far')) {
        updatedProfile.distance_tolerance = 'low';
        updatedProfile.preferred_distance_miles = Math.max(
          2.0,
          updatedProfile.preferred_distance_miles - 1.0
        );
      }
      if (tags.includes('too_crowded')) {
        // Future: could track preference for quieter venues
      }
    }

    // Save updated profile
    const { error: updateError } = await (supabase
      .from('users') as any)
      .update({ ai_profile: updatedProfile })
      .eq('id', userId);

    if (updateError) throw updateError;

    console.log('AI profile updated successfully:', updatedProfile);
  } catch (error) {
    console.error('Error updating AI profile:', error);
    // Don't throw - feedback is saved even if profile update fails
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  activityName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  ratingButton: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ratingButtonActive: {
    transform: [{ scale: 1.02 }],
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagActive: {
    transform: [{ scale: 1.02 }],
  },
  tagText: {
    fontSize: 14,
    fontWeight: '500',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  sharePrompt: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sharePromptIcon: {
    marginBottom: 12,
  },
  sharePromptTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sharePromptSubtitle: {
    fontSize: 15,
    marginBottom: 20,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
  },
  shareButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  skipShareButton: {
    paddingVertical: 10,
  },
  skipShareText: {
    fontSize: 15,
  },
});
