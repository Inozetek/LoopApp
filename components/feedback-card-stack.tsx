/**
 * FeedbackCardStack — Swipeable card stack for rapid-fire activity rating
 *
 * Replaces the inline feedback card on the recommendation feed.
 * Opened from the "Rate Activities" menu item in the calendar/Loop drawer.
 *
 * Features:
 * - Stacked cards with peek/scale for depth illusion
 * - Pan gesture to swipe-skip (moves card to back of stack)
 * - Thumbs up/down with optional quick tags
 * - Blur backdrop overlay
 * - "All caught up!" celebration on completion
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BrandColors, Typography, Spacing, BorderRadius } from '@/constants/brand';
import type { CompletedActivity } from '@/services/feedback-service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.88;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const STACK_OFFSET = 8;
const STACK_SCALE_STEP = 0.04;
const MAX_VISIBLE_CARDS = 3;

const POSITIVE_TAGS = [
  { id: 'great_value', label: 'Great value' },
  { id: 'loved_it', label: 'Loved it' },
  { id: 'great_vibe', label: 'Great vibe' },
  { id: 'will_return', label: 'Will return' },
];

const NEGATIVE_TAGS = [
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'too_far', label: 'Too far' },
  { id: 'too_crowded', label: 'Too crowded' },
  { id: 'boring', label: 'Boring' },
  { id: 'bad_weather', label: 'Bad weather' },
];

interface FeedbackCardStackProps {
  visible: boolean;
  activities: CompletedActivity[];
  onClose: () => void;
  onSubmitFeedback: (activityId: string, feedback: {
    rating: 'thumbs_up' | 'thumbs_down';
    tags?: string[];
  }) => void;
}

export function FeedbackCardStack({
  visible,
  activities,
  onClose,
  onSubmitFeedback,
}: FeedbackCardStackProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];

  const [stack, setStack] = useState<CompletedActivity[]>([]);
  const [allDone, setAllDone] = useState(false);
  // Tag selection phase: which rating was chosen, waiting for tags
  const [tagPhase, setTagPhase] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Pan animation for top card
  const translateX = useSharedValue(0);
  const cardScale = useSharedValue(1);

  // Reset state when opening
  useEffect(() => {
    if (visible && activities.length > 0) {
      setStack([...activities]);
      setAllDone(false);
      setTagPhase(null);
      setSelectedTags([]);
      translateX.value = 0;
      cardScale.value = 1;
    }
  }, [visible, activities]);

  const removeTopCard = useCallback(() => {
    setStack(prev => {
      const next = prev.slice(1);
      if (next.length === 0) {
        setAllDone(true);
      }
      return next;
    });
    setTagPhase(null);
    setSelectedTags([]);
    translateX.value = 0;
    cardScale.value = 1;
  }, []);

  const skipTopCard = useCallback(() => {
    setStack(prev => {
      if (prev.length <= 1) return prev;
      // Move first card to end
      const [first, ...rest] = prev;
      return [...rest, first];
    });
    setTagPhase(null);
    setSelectedTags([]);
    translateX.value = 0;
    cardScale.value = 1;
  }, []);

  const handleRate = useCallback((rating: 'thumbs_up' | 'thumbs_down') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTagPhase(rating);
    setSelectedTags([]);
  }, []);

  const handleSubmitWithTags = useCallback(() => {
    if (!stack[0] || !tagPhase) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const activity = stack[0];
    onSubmitFeedback(activity.activityId || activity.eventId, {
      rating: tagPhase,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    });
    // Animate card out to the right
    translateX.value = withTiming(SCREEN_WIDTH * 1.2, { duration: 250 }, () => {
      runOnJS(removeTopCard)();
    });
  }, [stack, tagPhase, selectedTags, onSubmitFeedback, removeTopCard]);

  const toggleTag = useCallback((tagId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  }, []);

  // Pan gesture for swipe-to-skip
  const panGesture = Gesture.Pan()
    .enabled(!tagPhase) // Disable swiping during tag selection
    .onUpdate((e) => {
      translateX.value = e.translationX;
      cardScale.value = interpolate(
        Math.abs(e.translationX),
        [0, SWIPE_THRESHOLD],
        [1, 0.95],
        Extrapolate.CLAMP,
      );
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        // Swipe completed — skip card (move to back)
        const direction = e.translationX > 0 ? 1 : -1;
        translateX.value = withTiming(direction * SCREEN_WIDTH * 1.2, { duration: 200 }, () => {
          runOnJS(skipTopCard)();
        });
      } else {
        // Snap back
        translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
        cardScale.value = withSpring(1, { damping: 15, stiffness: 200 });
      }
    });

  // Top card animated style
  const topCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: cardScale.value },
      { rotate: `${interpolate(translateX.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-8, 0, 8], Extrapolate.CLAMP)}deg` },
    ],
  }));

  const topCard = stack[0];
  const remaining = stack.length - 1;
  const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';
  const tagBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const tagBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BlurView intensity={50} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
          <Pressable style={styles.backdrop} onPress={onClose}>
            <Pressable style={styles.stackArea} onPress={e => e.stopPropagation()}>
              {/* Close button */}
              <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
              </Pressable>

              {allDone ? (
                /* All caught up celebration */
                <View style={[styles.doneContainer, { backgroundColor: cardBg }]}>
                  <Text style={styles.doneEmoji}>🎉</Text>
                  <Text style={[styles.doneTitle, { color: colors.text }]}>All caught up!</Text>
                  <Text style={[styles.doneSubtitle, { color: colors.textSecondary }]}>
                    Thanks for rating your activities.{'\n'}This helps us suggest better picks.
                  </Text>
                  <Pressable
                    style={[styles.doneButton, { backgroundColor: BrandColors.loopBlue }]}
                    onPress={onClose}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </Pressable>
                </View>
              ) : topCard ? (
                <>
                  {/* Background cards (peek effect) */}
                  {stack.slice(1, MAX_VISIBLE_CARDS).map((_, i) => {
                    const offset = (i + 1) * STACK_OFFSET;
                    const scale = 1 - (i + 1) * STACK_SCALE_STEP;
                    return (
                      <View
                        key={`bg-${i}`}
                        style={[
                          styles.card,
                          {
                            backgroundColor: cardBg,
                            position: 'absolute',
                            top: offset,
                            transform: [{ scale }],
                            opacity: 1 - (i + 1) * 0.15,
                            zIndex: -i - 1,
                          },
                        ]}
                      />
                    );
                  })}

                  {/* Top card */}
                  <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.card, { backgroundColor: cardBg, zIndex: 10 }, topCardStyle]}>
                      {/* Activity info */}
                      <View style={styles.cardHeader}>
                        <View style={[styles.categoryBadge, { backgroundColor: BrandColors.loopBlue + '18' }]}>
                          <Ionicons name="location" size={14} color={BrandColors.loopBlue} />
                          <Text style={[styles.categoryText, { color: BrandColors.loopBlue }]}>
                            {topCard.activityCategory || 'Activity'}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.activityName, { color: colors.text }]} numberOfLines={2}>
                        {topCard.activityName}
                      </Text>

                      {topCard.completedAt && (
                        <Text style={[styles.visitDate, { color: colors.textSecondary }]}>
                          Visited {new Date(topCard.completedAt).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      )}

                      {/* Tag selection phase */}
                      {tagPhase ? (
                        <View style={styles.tagSection}>
                          <Text style={[styles.tagPrompt, { color: colors.textSecondary }]}>
                            {tagPhase === 'thumbs_up' ? 'What did you like? (optional)' : 'What went wrong? (optional)'}
                          </Text>
                          <View style={styles.tagsRow}>
                            {(tagPhase === 'thumbs_up' ? POSITIVE_TAGS : NEGATIVE_TAGS).map(tag => {
                              const isSelected = selectedTags.includes(tag.id);
                              return (
                                <Pressable
                                  key={tag.id}
                                  style={[
                                    styles.tag,
                                    { backgroundColor: tagBg, borderColor: tagBorder },
                                    isSelected && { backgroundColor: BrandColors.loopBlue, borderColor: BrandColors.loopBlue },
                                  ]}
                                  onPress={() => toggleTag(tag.id)}
                                >
                                  <Text style={[
                                    styles.tagText,
                                    { color: colors.text },
                                    isSelected && { color: '#FFFFFF' },
                                  ]}>
                                    {tag.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                          <Pressable
                            style={[styles.submitBtn, { backgroundColor: BrandColors.loopBlue }]}
                            onPress={handleSubmitWithTags}
                          >
                            <Text style={styles.submitBtnText}>
                              {selectedTags.length > 0 ? 'Submit' : 'Skip tags'}
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        /* Rating buttons */
                        <View style={styles.ratingRow}>
                          <Pressable
                            style={[styles.rateBtn, { backgroundColor: BrandColors.loopGreen + '15' }]}
                            onPress={() => handleRate('thumbs_up')}
                          >
                            <Ionicons name="thumbs-up" size={24} color={BrandColors.loopGreen} />
                            <Text style={[styles.rateBtnText, { color: BrandColors.loopGreen }]}>Loved it</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.rateBtn, { backgroundColor: '#FF6B6B15' }]}
                            onPress={() => handleRate('thumbs_down')}
                          >
                            <Ionicons name="thumbs-down" size={24} color="#FF6B6B" />
                            <Text style={[styles.rateBtnText, { color: '#FF6B6B' }]}>Not great</Text>
                          </Pressable>
                        </View>
                      )}

                      {/* Remaining count */}
                      {remaining > 0 && (
                        <Text style={[styles.remainingText, { color: colors.textSecondary }]}>
                          {remaining} more to rate
                        </Text>
                      )}
                    </Animated.View>
                  </GestureDetector>
                </>
              ) : null}
            </Pressable>
          </Pressable>
        </BlurView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  stackArea: {
    width: CARD_WIDTH,
    alignItems: 'center',
    position: 'relative',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(128,128,128,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activityName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  visitDate: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  rateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  rateBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tagSection: {
    marginTop: Spacing.sm,
  },
  tagPrompt: {
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  tag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  submitBtn: {
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  remainingText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  // All-done state
  doneContainer: {
    width: CARD_WIDTH,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  doneEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  doneSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  doneButton: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xl * 2,
    borderRadius: BorderRadius.md,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
});
