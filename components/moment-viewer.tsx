/**
 * Moment Viewer Component
 *
 * Full-screen Instagram/Snapchat-style story viewer.
 *
 * Features:
 * - Tap left/right to navigate between moments
 * - Long press to pause
 * - Swipe down to close
 * - Double-tap to like (heart animation)
 * - Progress bars at top
 * - Place info overlay at bottom
 * - "Add to Loop" CTA button
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableWithoutFeedback,
  Modal,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandColors, Spacing } from '@/constants/brand';
import { Moment, FriendWithMoments } from '@/types/moment';
import { markMomentViewed, toggleMomentLike } from '@/services/moments-service';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PROGRESS_BAR_HEIGHT = 2;
const PROGRESS_BAR_GAP = 4;
const STORY_DURATION = 5000; // 5 seconds per story

interface MomentViewerProps {
  visible: boolean;
  friends: FriendWithMoments[];
  initialFriendIndex: number;
  currentUserId: string;
  onClose: () => void;
  onAddToCalendar?: (moment: Moment) => void;
}

/**
 * Progress bar for current friend's moments
 */
function ProgressBars({
  count,
  currentIndex,
  progress,
}: {
  count: number;
  currentIndex: number;
  progress: number;
}) {
  const barWidth = (SCREEN_WIDTH - Spacing.md * 2 - PROGRESS_BAR_GAP * (count - 1)) / count;

  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.progressBarBackground,
            { width: barWidth },
          ]}
        >
          <View
            style={[
              styles.progressBarFill,
              {
                width:
                  index < currentIndex
                    ? '100%'
                    : index === currentIndex
                    ? `${progress * 100}%`
                    : '0%',
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Heart animation on double-tap
 */
function HeartAnimation({ visible }: { visible: boolean }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 10 }),
        withSpring(1, { damping: 15 })
      );
      opacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(1, { duration: 400 }),
        withTiming(0, { duration: 300 })
      );
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.heartContainer, animatedStyle]}>
      <Ionicons name="heart" size={100} color="white" />
    </Animated.View>
  );
}

export function MomentViewer({
  visible,
  friends,
  initialFriendIndex,
  currentUserId,
  onClose,
  onAddToCalendar,
}: MomentViewerProps) {
  const insets = useSafeAreaInsets();
  const [friendIndex, setFriendIndex] = useState(initialFriendIndex);
  const [momentIndex, setMomentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const lastTapRef = useRef<number>(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const translateY = useSharedValue(0);

  const currentFriend = friends[friendIndex];
  const currentMoment = currentFriend?.moments[momentIndex];

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setFriendIndex(initialFriendIndex);
      setMomentIndex(0);
      setProgress(0);
      setIsPaused(false);
      translateY.value = 0;
    }
  }, [visible, initialFriendIndex]);

  // Mark moment as viewed when it becomes current
  useEffect(() => {
    if (visible && currentMoment && !currentMoment.hasViewed) {
      markMomentViewed(currentMoment.id, currentUserId);
    }
  }, [visible, currentMoment?.id, currentUserId]);

  // Progress timer
  useEffect(() => {
    if (!visible || isPaused || !currentMoment) return;

    const interval = 50; // Update every 50ms
    const increment = interval / STORY_DURATION;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 1) {
          // Move to next moment or friend
          goToNext();
          return 0;
        }
        return next;
      });
    }, interval);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [visible, isPaused, friendIndex, momentIndex, currentMoment]);

  const goToNext = useCallback(() => {
    if (!currentFriend) return;

    if (momentIndex < currentFriend.moments.length - 1) {
      // Next moment in same friend
      setMomentIndex(momentIndex + 1);
      setProgress(0);
      setImageLoading(true);
    } else if (friendIndex < friends.length - 1) {
      // Next friend
      setFriendIndex(friendIndex + 1);
      setMomentIndex(0);
      setProgress(0);
      setImageLoading(true);
    } else {
      // End of all stories
      onClose();
    }
  }, [friendIndex, momentIndex, currentFriend, friends.length, onClose]);

  const goToPrevious = useCallback(() => {
    if (momentIndex > 0) {
      // Previous moment in same friend
      setMomentIndex(momentIndex - 1);
      setProgress(0);
      setImageLoading(true);
    } else if (friendIndex > 0) {
      // Previous friend (go to their last moment)
      const prevFriend = friends[friendIndex - 1];
      setFriendIndex(friendIndex - 1);
      setMomentIndex(prevFriend.moments.length - 1);
      setProgress(0);
      setImageLoading(true);
    }
    // If at very beginning, do nothing
  }, [friendIndex, momentIndex, friends]);

  // Handle tap (left/right navigation)
  const handleTap = useCallback(
    (x: number) => {
      const now = Date.now();
      const isDoubleTap = now - lastTapRef.current < 300;
      lastTapRef.current = now;

      if (isDoubleTap) {
        // Double tap = like
        handleDoubleTap();
        return;
      }

      // Single tap = navigate
      if (x < SCREEN_WIDTH / 3) {
        goToPrevious();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (x > (SCREEN_WIDTH * 2) / 3) {
        goToNext();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [goToNext, goToPrevious]
  );

  const handleDoubleTap = useCallback(async () => {
    if (!currentMoment) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 1000);

    await toggleMomentLike(currentMoment.id, currentUserId);
  }, [currentMoment, currentUserId]);

  // Long press to pause
  const handleLongPressStart = useCallback(() => {
    setIsPaused(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Swipe down to close gesture
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100) {
        // Close if swiped down far enough
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
        runOnJS(onClose)();
      } else {
        // Snap back
        translateY.value = withSpring(0);
      }
    });

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(
      translateY.value,
      [0, SCREEN_HEIGHT / 2],
      [1, 0.5],
      Extrapolate.CLAMP
    ),
  }));

  if (!visible || !currentFriend || !currentMoment) return null;

  const timeAgo = getTimeAgo(currentMoment.createdAt);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <GestureHandlerRootView style={styles.gestureRoot}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.container, animatedContainerStyle]}>
            <TouchableWithoutFeedback
              onPress={(e) => handleTap(e.nativeEvent.locationX)}
              onLongPress={handleLongPressStart}
              onPressOut={handleLongPressEnd}
              delayLongPress={200}
            >
              <View style={styles.imageContainer}>
                {/* Background image */}
                <Image
                  source={{ uri: currentMoment.photoUrl }}
                  style={styles.backgroundImage}
                  blurRadius={20}
                />

                {/* Main image */}
                <Image
                  source={{ uri: currentMoment.photoUrl }}
                  style={styles.mainImage}
                  resizeMode="contain"
                  onLoadStart={() => setImageLoading(true)}
                  onLoadEnd={() => setImageLoading(false)}
                />

                {imageLoading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="white" />
                  </View>
                )}

                {/* Heart animation */}
                <HeartAnimation visible={showHeart} />

                {/* Top gradient overlay */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.6)', 'transparent']}
                  style={[styles.topGradient, { paddingTop: insets.top }]}
                >
                  {/* Progress bars */}
                  <ProgressBars
                    count={currentFriend.moments.length}
                    currentIndex={momentIndex}
                    progress={progress}
                  />

                  {/* User info header */}
                  <View style={styles.header}>
                    <View style={styles.userInfo}>
                      {currentFriend.profilePictureUrl ? (
                        <Image
                          source={{ uri: currentFriend.profilePictureUrl }}
                          style={styles.userAvatar}
                        />
                      ) : (
                        <View style={styles.userAvatarPlaceholder}>
                          <Text style={styles.userAvatarInitial}>
                            {currentFriend.name.charAt(0)}
                          </Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.userName}>{currentFriend.name}</Text>
                        <Text style={styles.timeAgo}>{timeAgo}</Text>
                      </View>
                    </View>

                    <TouchableWithoutFeedback onPress={onClose}>
                      <View style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="white" />
                      </View>
                    </TouchableWithoutFeedback>
                  </View>
                </LinearGradient>

                {/* Bottom gradient overlay with place info */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={[styles.bottomGradient, { paddingBottom: insets.bottom + Spacing.md }]}
                >
                  {/* Place info */}
                  <View style={styles.placeInfo}>
                    <Ionicons name="location" size={20} color="white" />
                    <View style={styles.placeTextContainer}>
                      <Text style={styles.placeName} numberOfLines={1}>
                        {currentMoment.place.name}
                      </Text>
                      {currentMoment.place.address && (
                        <Text style={styles.placeAddress} numberOfLines={1}>
                          {currentMoment.place.address}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Caption */}
                  {currentMoment.caption && (
                    <Text style={styles.caption}>{currentMoment.caption}</Text>
                  )}

                  {/* Action buttons */}
                  <View style={styles.actionButtons}>
                    {onAddToCalendar && (
                      <TouchableWithoutFeedback
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          onAddToCalendar(currentMoment);
                        }}
                      >
                        <View style={styles.addToLoopButton}>
                          <LinearGradient
                            colors={[BrandColors.loopBlue, BrandColors.loopGreen] as [string, string]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.addToLoopGradient}
                          >
                            <Ionicons name="add-circle-outline" size={18} color="white" />
                            <Text style={styles.addToLoopText}>Add to Loop</Text>
                          </LinearGradient>
                        </View>
                      </TouchableWithoutFeedback>
                    )}
                  </View>

                  {/* Engagement stats */}
                  <View style={styles.stats}>
                    <View style={styles.statItem}>
                      <Ionicons name="eye-outline" size={16} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.statText}>{currentMoment.viewsCount}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="heart" size={16} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.statText}>{currentMoment.likesCount}</Text>
                    </View>
                  </View>
                </LinearGradient>

                {/* Pause indicator */}
                {isPaused && (
                  <View style={styles.pauseIndicator}>
                    <Ionicons name="pause" size={32} color="white" />
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * Get relative time string
 */
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
    backgroundColor: 'black',
  },
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  mainImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: PROGRESS_BAR_GAP,
    marginTop: Spacing.sm,
  },
  progressBarBackground: {
    height: PROGRESS_BAR_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: PROGRESS_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: PROGRESS_BAR_HEIGHT / 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'white',
  },
  userAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  userAvatarInitial: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  userName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  timeAgo: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
  },
  placeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  placeTextContainer: {
    flex: 1,
  },
  placeName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  placeAddress: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  caption: {
    color: 'white',
    fontSize: 14,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  addToLoopButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  addToLoopGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  addToLoopText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  pauseIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
  },
  heartContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
  },
});
