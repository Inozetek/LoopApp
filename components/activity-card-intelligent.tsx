/**
 * Activity Card - Instagram-Style Social Card Redesign
 * Features: Hero images, social action bar (like/comment/share/loop), trending badges
 * Phase 2: Group RSVP, friend activity indicators, urgency badges
 * Research-backed: Grok AI aesthetic, Instagram engagement patterns, Outlook RSVP
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Image,
  Dimensions,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Recommendation, EventMetadata } from '@/types/activity';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors, Shadows } from '@/constants/brand';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import { StackedAvatars, AvatarUser } from '@/components/stacked-avatars';
import { UrgencyHeader } from '@/components/countdown-badge';
import { OutlookAvatarStack, GroupParticipant, RSVPStatus } from '@/components/rsvp-participant';
import {
  toggleLike,
  checkIfLiked,
  getPlaceRating,
  type LikeResult,
  type FriendWhoLiked,
} from '@/services/likes-service';
import { CardActionMenu } from '@/components/card-action-menu';
import { FEATURE_FLAGS } from '@/constants/feature-flags';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_MARGIN = 8; // Minimal margins for near edge-to-edge cards
const CARD_WIDTH = SCREEN_WIDTH - (CARD_MARGIN * 2);
const IMAGE_HEIGHT = Math.min(400, Math.max(280, Math.round(SCREEN_HEIGHT * 0.42))); // Responsive: 280-400px

/**
 * Instagram-Style Photo Carousel Component
 * Horizontal scrollable photos with dot indicators
 */
interface PhotoCarouselProps {
  photos: string[];
  imageError: boolean;
  onImageError: () => void;
}

function PhotoCarousel({ photos, imageError, onImageError }: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<FlatList>(null);

  const onScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CARD_WIDTH);
    setCurrentIndex(index);
  };

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        ref={scrollViewRef}
        data={photos}
        horizontal
        pagingEnabled={false}
        snapToInterval={CARD_WIDTH}
        decelerationRate="fast"
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={styles.carouselImage}
            resizeMode="cover"
            onError={onImageError}
          />
        )}
        keyExtractor={(item, index) => `photo-${index}`}
        getItemLayout={(data, index) => ({
          length: CARD_WIDTH,
          offset: CARD_WIDTH * index,
          index,
        })}
      />

      {/* Photo counter (top right) */}
      {photos.length > 1 && (
        <View style={styles.photoCounter}>
          <Text style={styles.photoCounterText}>{currentIndex + 1}/{photos.length}</Text>
        </View>
      )}

      {/* Instagram-style dot indicators */}
      <View style={styles.paginationContainer}>
        {photos.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              { opacity: index === currentIndex ? 1 : 0.4 }
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// StackedScoreBar removed in redesign - replaced with cleaner Instagram-style social bar

// Match score label removed in redesign - trending badge and social proof replace it

/**
 * Format count for social display (e.g., 1.2K, 5K)
 */
function formatCount(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
}

// Friend activity data for showing social proof
interface FriendActivityData {
  friendsWhoVisited: AvatarUser[];
  friendsWithInLoop: AvatarUser[];
}

// Group plan data for RSVP cards
interface GroupPlanData {
  planId: string;
  participants: GroupParticipant[];
  suggestedTime: string;
  deadline?: Date;
  userStatus: RSVPStatus;
}

interface ActivityCardIntelligentProps {
  recommendation: Recommendation;
  onAddToCalendar: () => void;
  onSeeDetails: () => void;
  onNotInterested?: () => void;
  onAddToRadar?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  likesCount?: number;
  commentsCount?: number;
  index: number;
  isRemoving?: boolean; // Trigger slide-out animation when added to calendar

  // Phase 2: Group & Social Features
  friendActivity?: FriendActivityData;
  groupPlan?: GroupPlanData;
  onAcceptRSVP?: () => void;
  onDeclineRSVP?: () => void;
  onMaybeRSVP?: () => void;

  // Pending invitation state (for pulsing border)
  hasPendingInvitation?: boolean;

  // Card type — kept for analytics tracking
  cardType?: 'ai_curated' | 'discovery';

  // Whether to show AI insight elements (match score, explanation, time chip, Loop Pick)
  showInsights?: boolean;
}

function ActivityCardIntelligentComponent({
  recommendation,
  onAddToCalendar,
  onSeeDetails,
  onNotInterested,
  onAddToRadar,
  onLike,
  onComment,
  onShare,
  likesCount,
  commentsCount,
  index,
  isRemoving = false,
  // Phase 2: Group & Social Features
  friendActivity,
  groupPlan,
  onAcceptRSVP,
  onDeclineRSVP,
  onMaybeRSVP,
  hasPendingInvitation = false,
  cardType = 'ai_curated',
  showInsights = true,
}: ActivityCardIntelligentProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];
  const router = useRouter();
  const { user } = useAuth();

  // Use flat Recommendation structure
  const score = recommendation.scoreBreakdown || {
    baseScore: 0,
    locationScore: 0,
    timeScore: 0,
    feedbackScore: 0,
    collaborativeScore: 0,
    sponsorBoost: 0,
    finalScore: recommendation.score || 0,
  };

  // Action menu state (three-dot menu)
  const [actionMenuVisible, setActionMenuVisible] = useState(false);

  // Animation - entrance
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Animation - exit (slide left toward calendar when added)
  const exitSlideAnim = useRef(new Animated.Value(0)).current;
  const exitFadeAnim = useRef(new Animated.Value(1)).current;

  // Animation - pulsing border for pending invitations
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const [imageError, setImageError] = useState(false);

  // Real like state (persisted)
  const [likeState, setLikeState] = useState<{
    isLiked: boolean;
    totalLikes: number;
    friendsWhoLiked: FriendWhoLiked[];
    isLoading: boolean;
    totalThumbsUp: number;
    totalThumbsDown: number;
  }>({
    isLiked: false,
    totalLikes: 0,
    friendsWhoLiked: [],
    isLoading: true,
    totalThumbsUp: 0,
    totalThumbsDown: 0,
  });

  // Get place ID for likes (prefer Google Place ID)
  const placeId = recommendation.activity?.googlePlaceId ||
    (recommendation as any).google_place_id ||
    recommendation.id;

  // Load like state on mount
  useEffect(() => {
    if (!user?.id || !placeId) {
      setLikeState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const loadLikeState = async () => {
      try {
        const rating = await getPlaceRating(user.id, placeId);
        setLikeState({
          isLiked: rating.isLiked,
          totalLikes: rating.totalLikes,
          friendsWhoLiked: rating.friendsWhoLiked,
          isLoading: false,
          totalThumbsUp: rating.totalThumbsUp,
          totalThumbsDown: rating.totalThumbsDown,
        });
      } catch (error) {
        console.error('Error loading like state:', error);
        setLikeState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadLikeState();
  }, [user?.id, placeId]);

  // Handle like toggle with persistence
  const handleLikeToggle = useCallback(async () => {
    if (!user?.id || !placeId) return;

    // Optimistic update
    const previousState = { ...likeState };
    setLikeState(prev => ({
      ...prev,
      isLiked: !prev.isLiked,
      totalLikes: prev.isLiked ? prev.totalLikes - 1 : prev.totalLikes + 1,
    }));

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await toggleLike({
        userId: user.id,
        placeId,
        placeName: recommendation.title,
        placeCategory: recommendation.category,
        placeAddress: recommendation.location,
        recommendationId: recommendation.id,
        source: 'feed',
      });

      // Update with server state (preserve thumbs data — likes don't change them)
      setLikeState(prev => ({
        ...prev,
        isLiked: result.isLiked,
        totalLikes: result.totalLikes,
        friendsWhoLiked: result.friendsWhoLiked,
        isLoading: false,
      }));

      // Call parent callback if provided
      onLike?.();
    } catch (error) {
      // Revert on error
      console.error('Error toggling like:', error);
      setLikeState(previousState);
    }
  }, [user?.id, placeId, likeState, recommendation, onLike]);

  // Navigate to likers list
  const handleOpenLikersList = useCallback(() => {
    if (likeState.totalLikes === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/likers-list',
      params: {
        placeId,
        placeName: recommendation.title,
      },
    });
  }, [placeId, recommendation.title, likeState.totalLikes, router]);

  // Honest engagement: Loop likes/comments at real values (no Google seeding)
  const displayLikes = likeState.totalLikes;
  const displayComments = commentsCount ?? 0;
  // Google review count shown separately in metadata row (A2)

  // Pulsing border animation for pending invitations
  useEffect(() => {
    if (hasPendingInvitation) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [hasPendingInvitation, pulseAnim]);

  // Interpolate pulsing border color
  const pulseBorderColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', BrandColors.loopGreen],
  });

  // Check if activity is trending (high engagement)
  const isTrending = (recommendation.activity?.reviewsCount ?? 0) > 300 &&
    (recommendation.rating ?? 0) >= 4.3;

  // Check if this is a curated "Loop Pick"
  const isCurated = recommendation.isCurated === true;

  // Calculate AI match score (for border glow only)
  const matchScore = score.finalScore || recommendation.score || 0;
  const isStrongMatch = matchScore >= 55;

  // Descriptive insight tag — max 1 per card, derived from scoreBreakdown
  const getInsightTag = (): { icon: keyof typeof Ionicons.glyphMap; label: string } | null => {
    if (!showInsights) return null;
    if (hasFriendActivity) return { icon: 'people', label: 'Popular with friends' };
    if (score.feedbackScore >= 12) return { icon: 'thumbs-up', label: 'Based on places you liked' };
    if (score.locationScore >= 18) return { icon: 'navigate', label: 'Near your route' };
    if (score.baseScore >= 35) return { icon: 'sparkles-outline' as any, label: 'Matches your interests' };
    if (score.timeScore >= 12) return { icon: 'time', label: 'Great timing' };
    return null;
  };
  const insightTag = getInsightTag();

  // Phase 2: Check card type for conditional rendering
  const isGroupPlan = Boolean(groupPlan);
  const hasFriendActivity = friendActivity &&
    (friendActivity.friendsWhoVisited.length > 0 || friendActivity.friendsWithInLoop.length > 0);
  const hasUrgentDeadline = groupPlan?.deadline && new Date(groupPlan.deadline) > new Date();
  const userHasAccepted = groupPlan?.userStatus === 'accepted';

  // Get friend activity text
  const getFriendActivityText = () => {
    if (!friendActivity) return '';
    const { friendsWhoVisited, friendsWithInLoop } = friendActivity;

    if (friendsWhoVisited.length > 0) {
      if (friendsWhoVisited.length === 1) {
        return `${friendsWhoVisited[0].name.split(' ')[0]} visited here`;
      }
      return `${friendsWhoVisited.length} friends visited`;
    }

    if (friendsWithInLoop.length > 0) {
      if (friendsWithInLoop.length === 1) {
        return `${friendsWithInLoop[0].name.split(' ')[0]} has this in their Loop`;
      }
      return `${friendsWithInLoop.length} friends have this looped`;
    }

    return '';
  };

  // Entrance animation — staggered spring for premium feel
  useEffect(() => {
    const staggerDelay = Math.min(index * 60, 300); // Cap at 300ms for cards deep in list
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: staggerDelay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: staggerDelay,
        friction: 9,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Exit animation - slide left toward Calendar tab when added to calendar
  useEffect(() => {
    if (isRemoving) {
      Animated.parallel([
        Animated.timing(exitSlideAnim, {
          toValue: -SCREEN_WIDTH * 1.2, // Slide left (toward Calendar tab) - slightly beyond screen for smooth exit
          duration: 800, // Fast and snappy - no perceived delay
          useNativeDriver: true,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Smooth ease-in-out curve
        }),
        Animated.timing(exitFadeAnim, {
          toValue: 0,
          duration: 800, // Match slide duration for perfect sync
          useNativeDriver: true,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Same easing for fluid motion
        }),
      ]).start();
    }
  }, [isRemoving]);

  const getPriceDisplay = (priceRange?: number) => {
    if (!priceRange || priceRange === 0) return 'Free';
    return '$'.repeat(Math.max(1, priceRange));
  };

  const getDistanceText = (distanceStr?: string) => {
    if (!distanceStr) return 'Nearby';
    // distanceStr is already formatted as "2.7 mi" from the feed screen
    return distanceStr;
  };

  // AI Explanation — backward-looking (verifiable references, not predictions)
  // Research: Spotify "Because you listened to [Artist]" pattern builds more trust
  const getAIExplanation = () => {
    // Prefer server-generated explanation if it's substantive and backward-looking
    if (recommendation.aiExplanation &&
        recommendation.aiExplanation.length > 20 &&
        !recommendation.aiExplanation.includes('Recommended for you')) {
      return recommendation.aiExplanation;
    }

    const parts: string[] = [];
    const reviewCount = recommendation.activity?.reviewsCount ?? 0;

    // Backward-looking: reference user's own history first
    if (score.feedbackScore >= 12) {
      const cat = recommendation.category?.toLowerCase() || 'places';
      parts.push(`You've liked several ${cat} spots`);
    } else if (score.baseScore >= 35) {
      const cat = recommendation.category?.toLowerCase() || '';
      parts.push(`Matches your ${cat} interests`);
    }

    // Data-source explanations (verifiable, not predictive)
    if (recommendation.rating >= 4.5 && reviewCount >= 100) {
      parts.push(`${recommendation.rating}★ on Google with ${formatCount(reviewCount)} reviews`);
    } else if (recommendation.rating >= 4.0 && reviewCount >= 50) {
      parts.push(`${recommendation.rating}★ with ${formatCount(reviewCount)} reviews`);
    } else if (recommendation.rating >= 4.0) {
      parts.push(`rated ${recommendation.rating}★`);
    }

    // Location context (verifiable)
    if (score.locationScore >= 18) {
      parts.push('on your route');
    } else if (score.locationScore >= 15) {
      parts.push('nearby');
    }

    // Combine — max 2 parts for conciseness
    if (parts.length === 0) {
      // New user fallback: pure data-source explanation
      if (recommendation.rating > 0 && reviewCount > 0) {
        return `${recommendation.rating}★ on Google with ${formatCount(reviewCount)} reviews`;
      }
      return recommendation.aiExplanation || 'Popular in your area';
    } else if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    } else {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ' — ' + parts[1];
    }
  };

  // Check if this is an event (has event_metadata)
  const isEvent = Boolean((recommendation as any).event_metadata);
  const eventMetadata: EventMetadata | undefined = (recommendation as any).event_metadata;

  // Debug logging for events
  if (isEvent) {
    console.log(`🎫 Event card: ${recommendation.title}`, {
      hasEventMetadata: !!eventMetadata,
      hasEventUrl: !!eventMetadata?.event_url,
      eventUrl: eventMetadata?.event_url,
      startTime: eventMetadata?.start_time,
    });
  }

  // Time context label for metadata row — computed fresh from category + current hour
  // Hidden when insights are not shown (personalization signal belongs to insight-enabled cards only)
  const getTimeContextLabel = (): { icon: string; label: string } | null => {
    if (!showInsights) return null;

    const hour = new Date().getHours();
    const cat = recommendation.category?.toLowerCase() || '';
    const suggested = recommendation.suggestedTime;

    // If suggestedTime is within 2 hours → "Perfect for now" variants
    if (suggested) {
      const hoursUntil = (new Date(suggested).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil >= 0 && hoursUntil <= 2) {
        if (cat.includes('coffee') || cat.includes('cafe')) return { icon: '☕', label: 'Perfect for now' };
        if (cat.includes('dining') || cat.includes('restaurant') || cat.includes('food'))
          return { icon: '🍽️', label: 'Great for now' };
        return { icon: '⏰', label: 'Perfect timing' };
      }
    }

    // Time-of-day contextual labels
    if (hour >= 5 && hour < 12) {
      if (cat.includes('coffee') || cat.includes('cafe')) return { icon: '☕', label: 'Morning spot' };
      if (cat.includes('fitness') || cat.includes('gym') || cat.includes('yoga')) return { icon: '💪', label: 'Morning workout' };
      if (cat.includes('breakfast') || cat.includes('brunch')) return { icon: '🍳', label: 'Brunch spot' };
    } else if (hour >= 12 && hour < 17) {
      if (cat.includes('dining') || cat.includes('restaurant') || cat.includes('food')) return { icon: '🍽️', label: 'Lunch spot' };
      if (cat.includes('coffee') || cat.includes('cafe')) return { icon: '☕', label: 'Afternoon pick-me-up' };
      if (cat.includes('shopping') || cat.includes('retail')) return { icon: '🛍️', label: 'Afternoon find' };
    } else if (hour >= 17 && hour < 21) {
      if (cat.includes('dining') || cat.includes('restaurant') || cat.includes('food')) return { icon: '🍽️', label: 'Dinner spot' };
      if (cat.includes('bar') || cat.includes('nightlife') || cat.includes('pub')) return { icon: '🍸', label: 'Tonight' };
      if (cat.includes('entertainment') || cat.includes('music') || cat.includes('concert')) return { icon: '🎵', label: 'Tonight' };
    } else {
      if (cat.includes('bar') || cat.includes('nightlife') || cat.includes('pub')) return { icon: '🌙', label: 'Late night' };
    }

    return null; // No match for this category at this time → no chip
  };

  const timeContext = getTimeContextLabel();

  // Format event date for badge
  const formatEventDate = (isoString: string) => {
    const date = new Date(isoString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const time = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${month} ${day} • ${time}`;
  };

  // Check if we should show image or placeholder
  const hasValidImage = !imageError && recommendation.imageUrl;

  // Get category icon for placeholder
  const getCategoryIcon = (): keyof typeof Ionicons.glyphMap => {
    const category = recommendation.category?.toLowerCase() || '';
    if (category.includes('restaurant') || category.includes('food') || category.includes('dining')) return 'restaurant';
    if (category.includes('cafe') || category.includes('coffee')) return 'cafe';
    if (category.includes('bar') || category.includes('nightlife')) return 'wine';
    if (category.includes('music') || category.includes('concert')) return 'musical-notes';
    if (category.includes('sport') || category.includes('fitness') || category.includes('gym')) return 'fitness';
    if (category.includes('park') || category.includes('outdoor') || category.includes('nature')) return 'leaf';
    if (category.includes('shopping') || category.includes('store')) return 'cart';
    if (category.includes('movie') || category.includes('theater') || category.includes('entertainment')) return 'film';
    if (category.includes('museum') || category.includes('art') || category.includes('gallery')) return 'color-palette';
    if (category.includes('spa') || category.includes('wellness')) return 'flower';
    return 'location';
  };

  // Determine border color based on score (visual hierarchy)
  // Strong matches get a blue LED glow (deep ocean blue) for visual emphasis
  // Group plans user accepted get glow border
  const finalScore = score.finalScore || recommendation.score || 0;
  const getBorderColor = () => {
    if (!showInsights) return colors.border; // No-insights cards — no glow
    if (userHasAccepted) {
      return BrandColors.loopBlue; // User accepted group plan - cyan glow
    } else if (finalScore >= 60) {
      return BrandColors.strongMatchGlow; // Top Match - blue LED glow
    } else {
      return colors.border; // All other recommendations - subtle gray
    }
  };

  // Note: isTopMatch previously used for badge, now only for border color via finalScore check

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: isRemoving ? exitFadeAnim : fadeAnim,
          transform: [
            { translateY: slideAnim },
            { translateX: exitSlideAnim }, // Slide left when being removed
          ],
        },
      ]}
    >
      {/* Gradient border for dark mode - eBay-style polish */}
      {colorScheme === 'dark' && !hasPendingInvitation && !userHasAccepted && !isStrongMatch && (
        <View style={styles.cardGradientBorder}>
          <LinearGradient
            colors={['transparent', '#58595B', '#58595B', '#58595B', 'transparent']}
            locations={[0, 0.03, 0.5, 0.97, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradientBorderInner}
          />
        </View>
      )}
      <Animated.View style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderWidth: hasPendingInvitation ? 2.5 : (userHasAccepted ? 2 : (isStrongMatch && showInsights ? 1.5 : (colorScheme === 'dark' ? 0 : 1))),
          borderColor: hasPendingInvitation ? pulseBorderColor : getBorderColor(),
        },
        // Subtle glow effect for strong AI matches (only when insights shown)
        isStrongMatch && showInsights && !userHasAccepted && !hasPendingInvitation && styles.strongMatchGlow,
        // Pulsing glow for pending invitations
        hasPendingInvitation && styles.pendingInvitationGlow,
      ]}>
        {/* Urgency Header INSIDE card (for time-sensitive group plans) - matches card radius */}
        {hasUrgentDeadline && groupPlan?.deadline && (
          <UrgencyHeader deadline={groupPlan.deadline} prefix="Respond" />
        )}
        {/* HERO IMAGE (60% of card) - Carousel if 2+ photos, single image otherwise */}
        <View style={styles.imageContainer}>
          {recommendation.photos && recommendation.photos.length >= 2 ? (
            // Instagram-style carousel for 2+ photos
            <PhotoCarousel
              photos={recommendation.photos}
              imageError={imageError}
              onImageError={() => setImageError(true)}
            />
          ) : hasValidImage ? (
            // Single image (default) - wrapped in Pressable
            <Pressable
              onPress={onSeeDetails}
              onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              style={styles.imagePressable}
            >
              <Image
                source={{ uri: recommendation.imageUrl }}
                style={styles.image}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            </Pressable>
          ) : (
            // Gradient placeholder when no image available
            <Pressable
              onPress={onSeeDetails}
              onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              style={styles.imagePressable}
            >
              <LinearGradient
                colors={[BrandColors.loopBlue, BrandColors.loopGreen]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.placeholderGradient}
              >
                <View style={styles.placeholderIconContainer}>
                  <Ionicons name={getCategoryIcon()} size={64} color="rgba(255, 255, 255, 0.8)" />
                </View>
              </LinearGradient>
            </Pressable>
          )}

          {/* Gradient overlay for better badge/text visibility */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)']}
            style={styles.imageGradient}
            pointerEvents="none"
          />

          {/* THREE-DOT MENU BUTTON (Top Left) */}
          {(onNotInterested || onAddToRadar) && (
            <Pressable
              style={styles.menuButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (FEATURE_FLAGS.ENABLE_RADAR && onAddToRadar) {
                  setActionMenuVisible(true);
                } else {
                  onNotInterested?.();
                }
              }}
            >
              <IconSymbol name="ellipsis.circle.fill" size={28} color="rgba(255, 255, 255, 0.9)" />
            </Pressable>
          )}

          {/* BADGES OVERLAY ON IMAGE — priority capped at 2 */}
          <View style={styles.badgeContainer} pointerEvents="box-none">
            {(() => {
              // Badge priority system: max 2 badges per card
              const badges: React.ReactNode[] = [];

              // Priority 1: Event date (always wins)
              if (isEvent && eventMetadata?.start_time) {
                badges.push(
                  <View key="event" style={styles.eventBadge}>
                    <View style={styles.eventBadgeHeader}>
                      <Ionicons name="calendar" size={14} color="#fff" />
                      <Text style={styles.eventBadgeDate}>
                        {formatEventDate(eventMetadata.start_time)}
                      </Text>
                    </View>
                    {eventMetadata.is_free === true && (
                      <View style={styles.freeBadge}>
                        <Text style={styles.freeBadgeText}>FREE</Text>
                      </View>
                    )}
                  </View>
                );
              }

              // Priority 2: Social proof badges (Friends > Trending > Loop Pick)
              if (badges.length < 2 && hasFriendActivity && !isEvent) {
                badges.push(
                  <View key="friends" style={styles.loopPickBadge}>
                    <Ionicons name="people" size={11} color="rgba(255, 255, 255, 0.85)" />
                    <Text style={styles.loopPickText}>Friends Visited</Text>
                  </View>
                );
              }
              if (badges.length < 2 && isTrending && !isEvent) {
                badges.push(
                  <View key="trending" style={styles.trendingBadge}>
                    <Ionicons name="flame" size={12} color="rgba(255, 255, 255, 0.85)" />
                    <Text style={styles.trendingText}>Trending</Text>
                  </View>
                );
              }
              if (badges.length < 2 && isCurated && !isEvent && showInsights) {
                badges.push(
                  <View key="pick" style={styles.loopPickBadge}>
                    <Ionicons name="star" size={11} color="rgba(255, 255, 255, 0.85)" />
                    <Text style={styles.loopPickText}>Loop Pick</Text>
                  </View>
                );
              }

              // Priority 3: Insight tag (replaces old match %)
              if (badges.length < 2 && insightTag && !isEvent) {
                badges.push(
                  <View key="insight" style={styles.insightTagBadge}>
                    <Ionicons name={insightTag.icon} size={11} color="#FFFFFF" />
                    <Text style={styles.insightTagText}>{insightTag.label}</Text>
                  </View>
                );
              }

              // Priority 4: Open Now
              if (badges.length < 2 && !isEvent && recommendation.openNow) {
                badges.push(
                  <View key="open" style={styles.openNowBadge}>
                    <View style={styles.greenDot} />
                    <Text style={styles.openNowText}>Open Now</Text>
                  </View>
                );
              }

              // Sponsored always shows (counts toward limit)
              if (recommendation.isSponsored) {
                badges.push(
                  <View key="sponsored" style={styles.sponsoredBadge}>
                    <Text style={styles.sponsoredText}>Sponsored</Text>
                  </View>
                );
              }

              // Hard cap at 2 (sponsored doesn't count toward the cap)
              const sponsoredBadge = badges.find(b => (b as any).key === 'sponsored');
              const nonSponsored = badges.filter(b => (b as any).key !== 'sponsored').slice(0, 2);
              return [...nonSponsored, sponsoredBadge].filter(Boolean);
            })()}
          </View>

          {/* Category Badge (bottom left of image) */}
          <View style={styles.categoryBadgeOverlay} pointerEvents="box-none">
            <View style={[styles.categoryBadge, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}>
              <Text style={styles.categoryText}>{recommendation.category || 'Activity'}</Text>
            </View>
          </View>
        </View>

        {/* CONTENT SECTION (30% of card) - clickable to open details */}
        <Pressable
          style={styles.content}
          onPress={onSeeDetails}
          onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          pointerEvents="box-none"
        >
          {/* Title */}
          <Text style={[styles.title, Typography.titleLarge, { color: colors.text }]} numberOfLines={2}>
            {recommendation.title}
          </Text>

          {/* Metadata Row — price · ★ rating (reviews) · neighborhood — distance */}
          <View style={styles.metadata}>
            <Text style={[styles.metaText, { color: colors.text }]}>
              {getPriceDisplay(recommendation.priceRange)}
            </Text>
            {recommendation.rating > 0 && (
              <>
                <Text style={[styles.metaDot, { color: colors.textSecondary }]}>•</Text>
                <Text style={[styles.metaText, { color: colors.text }]}>
                  {'★ '}{recommendation.rating.toFixed(1)}
                  {(recommendation.activity?.reviewsCount ?? 0) > 0 && (
                    <Text style={{ color: colors.textSecondary }}>{' '}({formatCount(recommendation.activity!.reviewsCount!)})</Text>
                  )}
                </Text>
              </>
            )}
            <Text style={[styles.metaDot, { color: colors.textSecondary }]}>•</Text>
            <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
              {recommendation.neighborhood
                ? `${recommendation.neighborhood} — ${getDistanceText(recommendation.distance)}`
                : getDistanceText(recommendation.distance)}
            </Text>
            {/* Time context chip (e.g. "☕ Morning spot", "🍽️ Dinner spot") */}
            {timeContext && !isGroupPlan && (
              <>
                <Text style={[styles.metaDot, { color: colors.textSecondary }]}>•</Text>
                <Text style={[styles.timeChip, { color: colors.primary }]}>
                  {timeContext.icon} {timeContext.label}
                </Text>
              </>
            )}
            {/* Show group plan time if applicable */}
            {isGroupPlan && groupPlan?.suggestedTime && (
              <>
                <Text style={[styles.metaDot, { color: colors.textSecondary }]}>•</Text>
                <Text style={[styles.metaText, { color: colors.primary }]}>
                  {groupPlan.suggestedTime}
                </Text>
              </>
            )}
          </View>

          {/* Date Context Row — shown when date-filtered recommendations have time context */}
          {recommendation.dateContext && showInsights && (
            <View style={styles.dateContextRow}>
              <View style={styles.dateContextTime}>
                <Ionicons name="time-outline" size={14} color={colors.primary} />
                <Text style={[styles.dateContextTimeText, { color: colors.text }]}>
                  {recommendation.dateContext.suggestedTimeLabel}
                </Text>
                <View style={[
                  styles.confidenceDot,
                  {
                    backgroundColor: recommendation.dateContext.confidenceTier === 'high'
                      ? BrandColors.loopGreen
                      : recommendation.dateContext.confidenceTier === 'medium'
                        ? BrandColors.loopOrange
                        : colors.textSecondary,
                  },
                ]} />
              </View>
              {recommendation.dateContext.travelContextLabel && (
                <Text style={[styles.dateContextTravel, { color: colors.textSecondary }]}>
                  {recommendation.dateContext.travelContextLabel}
                </Text>
              )}
              <Text style={[styles.dateContextLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {recommendation.dateContext.timeContextLabel}
              </Text>
            </View>
          )}

          {/* Friend Activity Row (Phase 2) */}
          {hasFriendActivity && friendActivity && (
            <View style={styles.friendActivity}>
              <StackedAvatars
                users={friendActivity.friendsWhoVisited.length > 0
                  ? friendActivity.friendsWhoVisited
                  : friendActivity.friendsWithInLoop}
                maxVisible={3}
                size="small"
              />
              <Text style={[styles.friendActivityText, { color: colors.textSecondary }]}>
                {getFriendActivityText()}
              </Text>
            </View>
          )}

          {/* Group Participants - Outlook-style compact avatar stack */}
          {isGroupPlan && groupPlan && (
            <View style={styles.groupAvatarSection}>
              <OutlookAvatarStack
                participants={groupPlan.participants}
                maxVisible={5}
                size={36}
              />
            </View>
          )}

          {/* AI Explanation - Clean, natural language (hidden when insights off) */}
          {showInsights && (
            <View style={styles.aiExplanation}>
              <IconSymbol name="sparkles" size={14} color={colors.primary} />
              <Text style={[styles.aiText, { color: colors.textSecondary }]} numberOfLines={2}>
                {getAIExplanation()}
              </Text>
            </View>
          )}

          {/* Event Description (for events only) */}
          {isEvent && recommendation.description && typeof recommendation.description === 'string' && recommendation.description.trim() !== '' && (
            <Text
              style={[styles.eventDescription, { color: colors.textSecondary }]}
              numberOfLines={3}
            >
              {recommendation.description.trim()}
            </Text>
          )}

          {/* Instagram-style "Liked by" display */}
          {!likeState.isLoading && (likeState.friendsWhoLiked.length > 0 || displayLikes > 0) && (
            <Pressable
              style={styles.likedByContainer}
              onPress={handleOpenLikersList}
              disabled={likeState.totalLikes === 0}
            >
              {likeState.friendsWhoLiked.length > 0 ? (
                <View style={styles.likedByRow}>
                  {/* Friend avatar */}
                  <Image
                    source={{ uri: likeState.friendsWhoLiked[0].profilePictureUrl || 'https://i.pravatar.cc/40' }}
                    style={styles.likedByAvatar}
                  />
                  <Text style={[styles.likedByText, { color: colors.textSecondary }]}>
                    Liked by{' '}
                    <Text style={{ fontWeight: '600', color: colors.text }}>
                      {likeState.friendsWhoLiked[0].name.split(' ')[0]}
                    </Text>
                    {displayLikes > 1 && (
                      <Text> and{' '}
                        <Text style={{ fontWeight: '600', color: colors.text }}>
                          {displayLikes - 1} {displayLikes === 2 ? 'other' : 'others'}
                        </Text>
                      </Text>
                    )}
                  </Text>
                </View>
              ) : displayLikes > 0 ? (
                <Text style={[styles.likedByText, { color: colors.textSecondary }]}>
                  <Text style={{ fontWeight: '600', color: colors.text }}>{formatCount(displayLikes)}</Text> likes
                </Text>
              ) : null}
            </Pressable>
          )}

          {/* Community approval rate — shown when 5+ users have rated */}
          {(() => {
            const totalFeedback = likeState.totalThumbsUp + likeState.totalThumbsDown;
            if (totalFeedback < 5) return null;
            const approvalPct = Math.round((likeState.totalThumbsUp / totalFeedback) * 100);
            return (
              <View style={styles.approvalRow}>
                <Ionicons name="thumbs-up" size={13} color={colors.textSecondary} />
                <Text style={[styles.approvalText, { color: colors.textSecondary }]}>
                  {approvalPct}% of Loop users loved this
                </Text>
              </View>
            );
          })()}
        </Pressable>

        {/* UNIFIED SOCIAL ACTION BAR - Now includes inline RSVP for group plans */}
        <View style={[styles.socialActionBar, { borderTopColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}>
          {/* Like Button */}
          <Pressable
            style={styles.actionButton}
            onPress={handleLikeToggle}
          >
            <Ionicons
              name={likeState.isLiked ? 'heart' : 'heart-outline'}
              size={24}
              color={likeState.isLiked ? BrandColors.like : colors.text}
            />
            <Text style={[styles.actionCount, { color: colors.textSecondary }]}>
              {formatCount(displayLikes)}
            </Text>
          </Pressable>

          {/* Comment Button */}
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onComment?.();
            }}
          >
            <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
            <Text style={[styles.actionCount, { color: colors.textSecondary }]}>
              {formatCount(displayComments)}
            </Text>
          </Pressable>

          {/* Share Button */}
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onShare?.();
            }}
          >
            <Ionicons name="paper-plane-outline" size={22} color={colors.text} />
            <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
              Share
            </Text>
          </Pressable>

          {/* Primary Action - contextual based on card type */}
          {isGroupPlan && groupPlan?.userStatus === 'pending' ? (
            <>
              {/* Primary RSVP "Yes" action */}
              <Pressable
                style={[styles.actionButton, styles.rsvpPrimaryAction]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onAcceptRSVP?.();
                }}
              >
                <Ionicons name="checkmark-circle" size={24} color={BrandColors.success} />
                <Text style={[styles.actionLabel, { color: BrandColors.success, fontWeight: '600' }]}>
                  Yes
                </Text>
              </Pressable>

              {/* Overflow menu for No/Maybe */}
              <Pressable
                style={styles.actionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // Show overflow menu with Decline/Maybe options
                  // For now, cycle: tap once = Maybe, double tap = Decline
                  onMaybeRSVP?.();
                }}
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onDeclineRSVP?.();
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
              </Pressable>
            </>
          ) : (
            /* Standard Loop action for non-group or already responded */
            <Pressable
              style={[styles.actionButton, styles.primaryAction]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onAddToCalendar();
              }}
              disabled={isRemoving || userHasAccepted}
            >
              <Ionicons
                name={userHasAccepted ? 'checkmark-circle' : 'add-circle'}
                size={24}
                color={userHasAccepted ? BrandColors.success : colors.primary}
              />
              <Text style={[styles.actionLabel, {
                color: userHasAccepted ? BrandColors.success : colors.primary,
                fontWeight: '600'
              }]}>
                {userHasAccepted ? 'Going' : 'Loop'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Accepted Group Plan Glow Effect */}
        {userHasAccepted && (
          <View style={styles.acceptedGlow} pointerEvents="none" />
        )}
      </Animated.View>

      {/* Card Action Menu (three-dot) */}
      <CardActionMenu
        visible={actionMenuVisible}
        onClose={() => setActionMenuVisible(false)}
        onAddToRadar={onAddToRadar}
        onNotInterested={onNotInterested}
        activityName={recommendation.title}
      />
    </Animated.View>
  );
}

// Memoize component to prevent unnecessary re-renders during filter animations
export const ActivityCardIntelligent = React.memo(
  ActivityCardIntelligentComponent,
  (prevProps, nextProps) => {
    // Only re-render if recommendation ID, index, removing state, or pending invitation changes
    // Handlers are assumed stable (will be memoized in parent)
    return prevProps.recommendation.id === nextProps.recommendation.id &&
           prevProps.index === nextProps.index &&
           prevProps.isRemoving === nextProps.isRemoving &&
           prevProps.hasPendingInvitation === nextProps.hasPendingInvitation;
  }
);

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
    marginHorizontal: CARD_MARGIN, // Wider cards with reduced margins
    position: 'relative',
  },
  card: {
    borderRadius: BorderRadius.xl, // Larger radius for modern feel
    overflow: 'hidden',
    // Refined shadows for eBay-style polish
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, // Subtle shadow (was 0.1)
    shadowRadius: 12, // Softer spread (was 8)
    elevation: 4,
  },
  // Gradient border container for dark mode
  cardGradientBorder: {
    position: 'absolute',
    top: -0.5,
    left: -0.5,
    right: -0.5,
    bottom: -0.5,
    borderRadius: BorderRadius.xl + 0.5,
    overflow: 'hidden',
    zIndex: -1,
  },
  cardGradientBorderInner: {
    flex: 1,
    borderRadius: BorderRadius.xl + 0.5,
  },
  // Subtle glow for strong AI matches
  strongMatchGlow: {
    shadowColor: BrandColors.loopBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  // Pulsing glow for pending invitations
  pendingInvitationGlow: {
    shadowColor: BrandColors.loopGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },

  // IMAGE SECTION (60%)
  imageContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  imagePressable: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },

  // THREE-DOT MENU BUTTON
  menuButton: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // BADGES ON IMAGE
  badgeContainer: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'column',
    gap: Spacing.xs,
  },
  // Loop Pick Badge — frosted glass minimal style
  loopPickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  loopPickText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  // Trending Badge — frosted glass minimal style
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  trendingText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '500',
  },
  openNowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  openNowText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  // Insight tag badge (replaces gradient match %)
  insightTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  insightTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  sponsoredBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  sponsoredText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventBadge: {
    backgroundColor: BrandColors.loopOrange,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  eventBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventBadgeDate: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  freeBadge: {
    backgroundColor: BrandColors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  freeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  categoryBadgeOverlay: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // CONTENT SECTION (30%)
  content: {
    padding: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm, // Reduced - social bar handles bottom padding
    paddingRight: Spacing.md,
    minHeight: 80,
  },
  title: {
    marginBottom: Spacing.xs,
    fontWeight: '700',
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 12,
    marginHorizontal: 6,
  },
  timeChip: {
    fontSize: 13,
    fontWeight: '600',
  },
  aiExplanation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginBottom: Spacing.sm, // Extra safety margin to avoid button overlap
    flexWrap: 'wrap',
  },
  aiText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  eventDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
    paddingHorizontal: Spacing.xs,
  },

  // INSTAGRAM-STYLE "LIKED BY" DISPLAY
  likedByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  likedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  likedByAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E5E5',
  },
  likedByText: {
    fontSize: 13,
    lineHeight: 18,
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    marginBottom: Spacing.xs,
  },
  approvalText: {
    fontSize: 12,
    lineHeight: 16,
  },

  // SOCIAL ACTION BAR (Instagram-style)
  socialActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  actionCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  primaryAction: {
    backgroundColor: 'rgba(0, 166, 217, 0.1)', // loopBlue at 10%
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
  },

  // Date Context Row (date-filtered recommendations)
  dateContextRow: {
    marginBottom: Spacing.sm,
    gap: 3,
  },
  dateContextTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateContextTimeText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Urbanist-SemiBold',
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dateContextTravel: {
    fontSize: 12,
    fontWeight: '400',
    marginLeft: 20, // Align with text after icon
  },
  dateContextLabel: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
    marginLeft: 20,
  },

  // PHASE 2: Friend Activity Row
  friendActivity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  friendActivityText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // PHASE 2: Group Avatar Section (Outlook-style compact)
  groupAvatarSection: {
    marginBottom: Spacing.sm,
  },

  // PHASE 2: Inline RSVP Primary Action (in social bar)
  rsvpPrimaryAction: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)', // success green at 10%
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
  },

  // PHASE 2: Accepted Group Glow Effect
  acceptedGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: BrandColors.loopBlue,
    shadowColor: BrandColors.loopBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // INSTAGRAM-STYLE CAROUSEL
  carouselContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  photoCounter: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    zIndex: 10,
  },
  photoCounterText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  carouselImage: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BrandColors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },

});
