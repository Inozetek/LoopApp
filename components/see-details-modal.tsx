/**
 * See Details Modal - Rich Activity Details with AI Insights
 * Shows comprehensive information about a recommended activity
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Alert,
  Platform,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Recommendation } from '@/types/activity';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors, ScoreBarColors } from '@/constants/brand';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getStaticMapUrl } from '@/utils/maps';
import { AFFILIATE_CONFIG } from '@/constants/affiliate-config';
import { getPlaceReviews, type PlaceReview } from '@/services/google-places';
import { extractReviewTopics, type ReviewTopic } from '@/utils/review-topics';
import { getMatchingPartners, openAffiliateLink, trackAffiliateClick, type MatchedPartner } from '@/services/affiliate-service';
import { getComments, postComment, markHelpful, type Comment } from '@/services/comments-service';
import { getLikesCount } from '@/services/likes-service';
import { useAuth } from '@/contexts/auth-context';
import { DragHandle } from '@/components/drag-handle';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const IMAGE_HEIGHT = 300;

function formatCommentDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface SeeDetailsModalProps {
  visible: boolean;
  recommendation: Recommendation | null;
  onClose: () => void;
  onAddToCalendar: () => void;
  userId?: string;
  scrollToComments?: boolean;
}

/**
 * Detailed 5-Bar Score Graph Component
 * Shows all score components: Interest, Location, Timing, Feedback, Collaborative
 */
interface DetailedScoreGraphProps {
  scoreBreakdown: {
    baseScore: number;
    locationScore: number;
    timeScore: number;
    feedbackScore: number;
    collaborativeScore: number;
  };
  colors: typeof ThemeColors.light;
}

function DetailedScoreGraph({ scoreBreakdown, colors }: DetailedScoreGraphProps) {
  const bars = [
    { label: 'Interest Match', value: scoreBreakdown.baseScore, max: 40, color: ScoreBarColors.interest },
    { label: 'Location', value: scoreBreakdown.locationScore, max: 20, color: ScoreBarColors.location },
    { label: 'Timing', value: scoreBreakdown.timeScore, max: 15, color: ScoreBarColors.time },
    { label: 'Past Feedback', value: scoreBreakdown.feedbackScore, max: 15, color: ScoreBarColors.feedback },
    { label: 'Similar Users', value: scoreBreakdown.collaborativeScore, max: 10, color: ScoreBarColors.social },
  ];

  const totalScore = scoreBreakdown.baseScore +
                     scoreBreakdown.locationScore +
                     scoreBreakdown.timeScore +
                     scoreBreakdown.feedbackScore +
                     scoreBreakdown.collaborativeScore;

  const maxPossible = 100;

  return (
    <View style={[styles.detailedGraph, { backgroundColor: colors.card }]}>
      <View style={styles.graphHeader}>
        <Text style={[styles.graphTitle, { color: colors.text }]}>Match Score Breakdown</Text>
        <Text style={styles.graphTotal}>{Math.round(totalScore)}/100</Text>
      </View>

      {bars.map((bar, index) => {
        const percentage = (bar.value / bar.max) * 100;
        return (
          <View key={index} style={styles.detailedBarContainer}>
            <View style={styles.barLabelRow}>
              <Text style={[styles.detailedBarLabel, { color: colors.textSecondary }]}>{bar.label}</Text>
              <Text style={[styles.barScore, { color: colors.textTertiary }]}>{bar.value}/{bar.max}</Text>
            </View>
            <View style={[styles.detailedBarBackground, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.detailedBarFill,
                  {
                    width: `${percentage}%`,
                    backgroundColor: bar.color,
                  }
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Photo Carousel Component (Reused from activity card)
 */
interface PhotoCarouselProps {
  photos: string[];
}

function PhotoCarousel({ photos }: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const onScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={styles.carouselImage}
            resizeMode="cover"
          />
        )}
        keyExtractor={(item, index) => `modal-photo-${index}`}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Pagination dots */}
      {photos.length > 1 && (
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
      )}
    </View>
  );
}

export function SeeDetailsModal({
  visible,
  recommendation,
  onClose,
  onAddToCalendar,
  userId,
  scrollToComments = false,
}: SeeDetailsModalProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const commentsYRef = useRef(0);
  const { user } = useAuth();

  // Reviews state
  const [reviews, setReviews] = useState<PlaceReview[]>([]);
  const [reviewTopics, setReviewTopics] = useState<ReviewTopic[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Likes count for metadata
  const [likesCount, setLikesCount] = useState(0);

  // Loop comments state
  const [loopComments, setLoopComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentRating, setCommentRating] = useState<number | null>(null);
  const [helpedComments, setHelpedComments] = useState<Set<string>>(new Set());

  // Fetch reviews + Loop comments when modal opens
  useEffect(() => {
    const googlePlaceId = recommendation?.activity?.googlePlaceId;
    const isEvent = !!(recommendation as any)?.event_metadata?.event_url;

    if (visible && !isEvent && googlePlaceId) {
      const fetchReviews = async () => {
        setLoadingReviews(true);
        try {
          const [placeReviews, comments, likes] = await Promise.all([
            getPlaceReviews(googlePlaceId),
            getComments(googlePlaceId, 10),
            getLikesCount(googlePlaceId).catch(() => 0),
          ]);
          setReviews(placeReviews);
          setLoopComments(comments);
          setLikesCount(likes);

          // Extract topics from reviews
          const topics = extractReviewTopics(placeReviews);
          setReviewTopics(topics);
        } catch (error) {
          console.error('Failed to fetch reviews:', error);
          setReviews([]);
          setLoopComments([]);
          setReviewTopics([]);
        } finally {
          setLoadingReviews(false);
        }
      };

      fetchReviews();
    } else {
      // Reset when modal closes or for events
      setReviews([]);
      setLoopComments([]);
      setReviewTopics([]);
      setShowCommentInput(false);
      setCommentText('');
      setCommentRating(null);
      setHelpedComments(new Set());
      setLikesCount(0);
    }
  }, [visible, recommendation?.activity?.googlePlaceId]);

  // Scroll to comments section when triggered from card comment icon
  useEffect(() => {
    if (scrollToComments && visible && !loadingReviews && commentsYRef.current > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: commentsYRef.current, animated: true });
      }, 400); // Wait for modal animation
    }
  }, [scrollToComments, visible, loadingReviews]);

  async function handlePostComment() {
    const placeId = recommendation?.activity?.googlePlaceId;
    if (!user?.id || !placeId || !commentText.trim()) return;

    setIsPostingComment(true);
    try {
      const comment = await postComment(user.id, placeId, commentText.trim(), commentRating ?? undefined);
      if (comment) {
        setLoopComments(prev => [{ ...comment, userName: 'You' }, ...prev]);
        setCommentText('');
        setCommentRating(null);
        setShowCommentInput(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setIsPostingComment(false);
    }
  }

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!recommendation) return null;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleAddToCalendar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    onAddToCalendar();
  };

  const getPriceDisplay = (priceRange?: number) => {
    if (!priceRange || priceRange === 0) return 'Free';
    return '$'.repeat(Math.max(1, priceRange));
  };

  const formatEventDateTime = (dateTimeString: string) => {
    try {
      const eventDate = new Date(dateTimeString);
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      };
      return eventDate.toLocaleDateString('en-US', options);
    } catch {
      return dateTimeString;
    }
  };

  // Photos for carousel
  const photos = recommendation.photos && recommendation.photos.length >= 3
    ? recommendation.photos
    : recommendation.imageUrl
    ? [recommendation.imageUrl]
    : [];

  const hasImage = photos.length > 0;

  // Get category icon for gradient fallback (matches activity card style)
  const getCategoryIcon = (): string => {
    const category = recommendation.category?.toLowerCase() || '';
    if (category.includes('restaurant') || category.includes('food') || category.includes('dining')) return 'restaurant';
    if (category.includes('cafe') || category.includes('coffee')) return 'cafe';
    if (category.includes('bar') || category.includes('nightlife')) return 'wine';
    if (category.includes('music') || category.includes('concert')) return 'musical-notes';
    if (category.includes('sport') || category.includes('fitness') || category.includes('gym')) return 'fitness';
    if (category.includes('park') || category.includes('outdoor') || category.includes('nature') || category.includes('trail')) return 'leaf';
    if (category.includes('shopping') || category.includes('store')) return 'cart';
    if (category.includes('movie') || category.includes('theater') || category.includes('entertainment')) return 'film';
    if (category.includes('museum') || category.includes('art') || category.includes('gallery')) return 'color-palette';
    if (category.includes('spa') || category.includes('wellness')) return 'flower';
    return 'location';
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.modalContainer,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={[styles.modal, { backgroundColor: colors.card }]}>
          {/* Close Button */}
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <IconSymbol name="xmark.circle.fill" size={32} color={colors.text} />
          </Pressable>

          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Hero Image or Carousel */}
            {hasImage ? (
              photos.length >= 3 ? (
                <PhotoCarousel photos={photos} />
              ) : (
                <Image source={{ uri: photos[0] }} style={styles.heroImage} resizeMode="cover" />
              )
            ) : (
              <LinearGradient
                colors={[BrandColors.loopBlue, BrandColors.loopGreen]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroFallback}
              >
                <View style={styles.heroFallbackIconContainer}>
                  <Ionicons name={getCategoryIcon() as any} size={64} color="rgba(255, 255, 255, 0.8)" />
                </View>
                <Text style={styles.heroFallbackCategory}>
                  {recommendation.category}
                </Text>
              </LinearGradient>
            )}

            {/* Content Section */}
            <View style={styles.content}>
              {/* Title and Category */}
              <View style={styles.header}>
                <Text style={[styles.title, Typography.titleLarge, { color: colors.text }]}>
                  {recommendation.title}
                </Text>
                <View style={[styles.categoryBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.categoryText}>{recommendation.category}</Text>
                </View>
              </View>

              {/* Metadata Row */}
              <View style={styles.metadata}>
                {recommendation.rating != null && recommendation.rating > 0 && (
                  <>
                    <IconSymbol name="star.fill" size={16} color={BrandColors.star} />
                    <Text style={[styles.metaText, { color: colors.text }]}>
                      {recommendation.rating.toFixed(1)}
                    </Text>
                    {recommendation.activity?.reviewsCount != null && recommendation.activity.reviewsCount > 0 && (
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        ({recommendation.activity.reviewsCount.toLocaleString()})
                      </Text>
                    )}
                    {likesCount > 0 && (
                      <>
                        <View style={styles.metaDivider} />
                        <Ionicons name="heart" size={14} color={BrandColors.like} />
                        <Text style={[styles.metaText, { color: colors.text }]}>
                          {likesCount}
                        </Text>
                      </>
                    )}
                    <View style={styles.metaDivider} />
                  </>
                )}
                <Text style={[styles.metaText, { color: colors.text }]}>
                  {getPriceDisplay(recommendation.priceRange)}
                </Text>
                <View style={styles.metaDivider} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {recommendation.distance}
                </Text>
              </View>

              {/* Group Reasoning Section — placed prominently before other content */}
              {recommendation.groupContext && recommendation.groupContext.memberMatches.length > 0 && (
                <View style={[styles.section, styles.groupReasoningBanner, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]}>
                  <View style={styles.aiHeader}>
                    <Ionicons name="people" size={18} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
                      Why this works for your group
                    </Text>
                  </View>
                  <Text style={[styles.description, { color: colors.textSecondary, marginTop: 8 }]}>
                    {recommendation.aiExplanation}
                  </Text>
                  <View style={styles.groupMembersContainer}>
                    {recommendation.groupContext.memberMatches.map((member) => {
                      const hasMatch = member.matchedInterests.length > 0;
                      const isFarthest = member.name === recommendation.groupContext!.farthestMemberName;
                      return (
                        <View key={member.userId} style={styles.groupMemberRow}>
                          <View style={styles.groupMemberLeft}>
                            <View style={[styles.groupMemberAvatar, { backgroundColor: BrandColors.loopBlue }]}>
                              <Text style={styles.groupMemberAvatarText}>
                                {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </Text>
                            </View>
                            <View style={styles.groupMemberInfo}>
                              <Text style={[styles.groupMemberName, { color: colors.text }]}>
                                {member.name.split(' ')[0]}
                              </Text>
                              {member.matchedInterests.length > 0 ? (
                                <View style={styles.groupInterestChips}>
                                  {member.matchedInterests.slice(0, 3).map((interest) => (
                                    <View key={interest} style={[styles.groupInterestChip, { backgroundColor: BrandColors.loopGreen + '20' }]}>
                                      <Text style={[styles.groupInterestChipText, { color: BrandColors.loopGreen }]}>
                                        {interest}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              ) : (
                                <Text style={[styles.groupMemberDistance, { color: colors.textSecondary }]}>
                                  No matching interests
                                </Text>
                              )}
                              <Text style={[styles.groupMemberDistance, { color: colors.textSecondary }]}>
                                {member.distanceMiles.toFixed(1)} mi away{isFarthest ? ' (farthest)' : ''}
                              </Text>
                            </View>
                          </View>
                          {hasMatch && (
                            <Ionicons name="checkmark-circle" size={22} color={BrandColors.loopGreen} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                  {recommendation.groupContext.interestMatchScore > 0 && (
                    <View style={styles.groupScoreRow}>
                      <Ionicons name="analytics" size={16} color={colors.primary} />
                      <Text style={[styles.groupScoreText, { color: colors.textSecondary }]}>
                        Interest Match: {recommendation.groupContext.interestMatchScore}/40
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Description Section */}
              {(recommendation.description || recommendation.activity?.description) && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
                  <Text style={[styles.description, { color: colors.textSecondary }]}>
                    {recommendation.description || recommendation.activity?.description}
                  </Text>
                </View>
              )}

              {/* Map Preview Section */}
              {recommendation.activity?.location && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Location
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const { latitude, longitude } = recommendation.activity!.location;
                      const url = Platform.select({
                        ios: `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`,
                        android: `google.navigation:q=${latitude},${longitude}`,
                        default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
                      });
                      Linking.openURL(url);
                    }}
                    style={styles.mapPreviewContainer}
                  >
                    <Image
                      source={{
                        uri: getStaticMapUrl({
                          latitude: recommendation.activity.location.latitude,
                          longitude: recommendation.activity.location.longitude,
                        })
                      }}
                      style={styles.mapPreview}
                      resizeMode="cover"
                    />
                    <View style={styles.mapOverlay}>
                      <IconSymbol name="map" size={20} color="#fff" />
                      <Text style={styles.mapOverlayText}>Tap for directions</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* What People Are Saying (for non-event venues only) */}
              {!((recommendation as any).event_metadata) && recommendation.activity?.googlePlaceId && (
                <View
                  style={styles.section}
                  onLayout={(e) => { commentsYRef.current = e.nativeEvent.layout.y; }}
                >
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    What People Are Saying
                  </Text>

                  {loadingReviews ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={colors.icon} />
                    </View>
                  ) : (
                    <>
                      {/* Topic Bubbles (merged from both sources) */}
                      {reviewTopics.length > 0 && (
                        <View style={styles.topicBubblesContainer}>
                          {reviewTopics.map((topic, index) => (
                            <View
                              key={index}
                              style={[
                                styles.topicBubble,
                                {
                                  backgroundColor: topic.sentiment === 'positive'
                                    ? BrandColors.success + '26'
                                    : BrandColors.error + '26',
                                  borderColor: topic.sentiment === 'positive'
                                    ? BrandColors.success
                                    : BrandColors.error,
                                },
                              ]}
                            >
                              <IconSymbol
                                name={topic.sentiment === 'positive' ? 'hand.thumbsup.fill' : 'hand.thumbsdown.fill'}
                                size={12}
                                color={topic.sentiment === 'positive' ? BrandColors.success : BrandColors.error}
                              />
                              <Text
                                style={[
                                  styles.topicText,
                                  {
                                    color: topic.sentiment === 'positive' ? BrandColors.success : BrandColors.error,
                                  },
                                ]}
                              >
                                {topic.topic}
                              </Text>
                              {topic.count > 1 && (
                                <Text style={[styles.topicCount, { color: colors.icon }]}>
                                  ({topic.count})
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Loop Community Comments (shown first) */}
                      {loopComments.length > 0 && (
                        <View style={styles.loopCommentsSection}>
                          <Text style={[styles.commentSourceLabel, { color: colors.textSecondary }]}>
                            Loop Community
                          </Text>
                          {loopComments.slice(0, 5).map((comment) => (
                            <View key={comment.id} style={[styles.loopCommentCard, { borderBottomColor: colors.border }]}>
                              <View style={styles.loopCommentHeader}>
                                {comment.userAvatar ? (
                                  <Image
                                    source={{ uri: comment.userAvatar }}
                                    style={styles.loopCommentAvatar}
                                  />
                                ) : (
                                  <View style={[styles.loopCommentAvatar, { backgroundColor: BrandColors.loopBlue }]}>
                                    <Text style={styles.loopCommentAvatarText}>
                                      {(comment.userName || 'L')[0].toUpperCase()}
                                    </Text>
                                  </View>
                                )}
                                <Text style={[styles.loopCommentAuthor, { color: colors.text }]}>
                                  {comment.userName}
                                </Text>
                                <Text style={[styles.loopCommentDate, { color: colors.icon }]}>
                                  {formatCommentDate(comment.createdAt)}
                                </Text>
                              </View>
                              {comment.rating != null && comment.rating > 0 && (
                                <View style={styles.loopCommentStars}>
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <IconSymbol
                                      key={star}
                                      name={star <= (comment.rating ?? 0) ? 'star.fill' : 'star'}
                                      size={12}
                                      color={star <= (comment.rating ?? 0) ? '#FFD700' : colors.icon}
                                    />
                                  ))}
                                </View>
                              )}
                              <Text style={[styles.loopCommentText, { color: colors.text }]} numberOfLines={3}>
                                {comment.text}
                              </Text>
                              <TouchableOpacity
                                style={styles.helpfulButton}
                                onPress={() => {
                                  if (helpedComments.has(comment.id)) return;
                                  setHelpedComments(prev => new Set(prev).add(comment.id));
                                  setLoopComments(prev =>
                                    prev.map(c => c.id === comment.id ? { ...c, helpfulCount: c.helpfulCount + 1 } : c)
                                  );
                                  markHelpful(comment.id);
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                disabled={helpedComments.has(comment.id)}
                              >
                                <Ionicons
                                  name={helpedComments.has(comment.id) ? 'thumbs-up' : 'thumbs-up-outline'}
                                  size={14}
                                  color={helpedComments.has(comment.id) ? BrandColors.loopBlue : colors.icon}
                                />
                                <Text style={[styles.helpfulText, { color: helpedComments.has(comment.id) ? BrandColors.loopBlue : colors.icon }]}>
                                  {comment.helpfulCount > 0 ? comment.helpfulCount : 'Helpful'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Add Your Experience CTA */}
                      {!showCommentInput ? (
                        <TouchableOpacity
                          style={[styles.addCommentButton, { borderColor: colors.border }]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowCommentInput(true);
                          }}
                        >
                          <Ionicons name="add-circle-outline" size={18} color={BrandColors.loopBlue} />
                          <Text style={[styles.addCommentText, { color: BrandColors.loopBlue }]}>
                            Add Your Experience
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.commentInputContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
                          <TextInput
                            style={[styles.commentInput, { color: colors.text }]}
                            placeholder="Share your experience..."
                            placeholderTextColor={colors.icon}
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                            maxLength={500}
                            autoFocus
                          />
                          <View style={styles.starRatingRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <TouchableOpacity
                                key={star}
                                onPress={() => setCommentRating(commentRating === star ? null : star)}
                                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                              >
                                <IconSymbol
                                  name={star <= (commentRating ?? 0) ? 'star.fill' : 'star'}
                                  size={22}
                                  color={star <= (commentRating ?? 0) ? '#FFD700' : colors.icon}
                                />
                              </TouchableOpacity>
                            ))}
                            <Text style={[{ fontSize: 12, marginLeft: 4 }, { color: colors.icon }]}>
                              {commentRating ? `${commentRating}/5` : 'Rate (optional)'}
                            </Text>
                          </View>
                          <View style={styles.commentInputActions}>
                            <TouchableOpacity onPress={() => { setShowCommentInput(false); setCommentText(''); }}>
                              <Text style={[styles.commentCancelText, { color: colors.icon }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={handlePostComment}
                              disabled={!commentText.trim() || isPostingComment}
                              style={[styles.commentPostButton, { backgroundColor: commentText.trim() ? BrandColors.loopBlue : colors.border }]}
                            >
                              {isPostingComment ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.commentPostText}>Post</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {/* Google Reviews (shown below Loop comments) */}
                      {reviews.length > 0 && (
                        <View style={styles.googleReviewsSection}>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.reviewsContainer}
                          >
                            {reviews.slice(0, 5).map((review, index) => (
                              <View key={index} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={styles.reviewHeader}>
                                  {review.authorAttribution.photoUri ? (
                                    <Image
                                      source={{ uri: review.authorAttribution.photoUri }}
                                      style={styles.reviewerAvatar}
                                    />
                                  ) : (
                                    <View style={[styles.reviewerAvatar, styles.reviewerAvatarPlaceholder, { backgroundColor: BrandColors.loopBlue }]}>
                                      <Text style={styles.reviewerInitial}>
                                        {review.authorAttribution.displayName[0]}
                                      </Text>
                                    </View>
                                  )}
                                  <View style={styles.reviewerInfo}>
                                    <Text style={[styles.reviewerName, { color: colors.text }]} numberOfLines={1}>
                                      {review.authorAttribution.displayName}
                                    </Text>
                                    <Text style={[styles.reviewDate, { color: colors.icon }]}>
                                      {review.relativePublishTimeDescription}
                                    </Text>
                                  </View>
                                </View>
                                <View style={styles.reviewRating}>
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <IconSymbol
                                      key={star}
                                      name={star <= review.rating ? 'star.fill' : 'star'}
                                      size={14}
                                      color={star <= review.rating ? '#FFD700' : colors.icon}
                                    />
                                  ))}
                                </View>
                                <Text
                                  style={[styles.reviewText, { color: colors.text }]}
                                  numberOfLines={4}
                                >
                                  {review.text.text}
                                </Text>
                              </View>
                            ))}
                          </ScrollView>
                          {/* Google Maps attribution (TOS required) */}
                          <Text
                            style={[styles.googleAttribution, { color: colors.icon }]}
                            accessibilityLabel="Google Maps"
                          >
                            Google Maps
                          </Text>
                        </View>
                      )}

                      {reviews.length === 0 && loopComments.length === 0 && (
                        <View style={styles.emptyCommentState}>
                          <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.icon} />
                          <Text style={[styles.emptyCommentTitle, { color: colors.text }]}>
                            No reviews yet
                          </Text>
                          <Text style={[styles.emptyCommentSubtitle, { color: colors.icon }]}>
                            Be the first to share your experience!
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* AI Explanation — only for non-group recs (group recs show explanation in the group banner above) */}
              {!recommendation.groupContext && (
                <View style={styles.section}>
                  <View style={styles.aiHeader}>
                    <IconSymbol name="sparkles" size={18} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      Why We Recommend This
                    </Text>
                  </View>
                  <Text style={[styles.description, { color: colors.textSecondary }]}>
                    {recommendation.aiExplanation}
                  </Text>
                </View>
              )}

              {/* Detailed Score Breakdown */}
              {recommendation.scoreBreakdown && (
                <View style={styles.section}>
                  <DetailedScoreGraph scoreBreakdown={recommendation.scoreBreakdown} colors={colors} />
                </View>
              )}

              {/* AI Review Summary */}
              {recommendation.reviewSummary && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    What People Are Saying
                  </Text>
                  <View style={[styles.reviewSummary, { backgroundColor: colors.background }]}>
                    <IconSymbol name="quote.opening" size={20} color={colors.textSecondary} />
                    <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
                      {recommendation.reviewSummary}
                    </Text>
                  </View>
                </View>
              )}

              {/* Additional Details */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
                <View style={styles.detailsList}>
                  {recommendation.openNow !== undefined && (
                    <View style={styles.detailRow}>
                      <IconSymbol name="clock" size={18} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        {recommendation.openNow ? 'Open Now' : 'Currently Closed'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <IconSymbol name="location" size={18} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                      {recommendation.location}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Event Details Section (for events only) */}
              {(recommendation as any).event_metadata && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Event Details</Text>

                  {/* BIG TICKET BUTTON - PRIMARY ACTION */}
                  {(recommendation as any).event_metadata?.event_url && typeof (recommendation as any).event_metadata.event_url === 'string' && (
                    <Pressable
                      style={styles.primaryTicketButton}
                      onPress={async () => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

                          const url = (recommendation as any).event_metadata.event_url;

                          // Determine partner from URL for tracking
                          const urlLower = url.toLowerCase();
                          const partnerId = urlLower.includes('ticketmaster') ? 'ticketmaster' as const
                            : urlLower.includes('eventbrite') ? 'eventbrite' as const
                            : urlLower.includes('fandango') ? 'fandango' as const
                            : null;

                          // Track affiliate click (non-blocking)
                          if (partnerId) {
                            trackAffiliateClick(userId, partnerId, recommendation).catch(() => {});
                          }

                          const canOpen = await Linking.canOpenURL(url);

                          if (canOpen) {
                            await Linking.openURL(url);
                          } else {
                            Alert.alert('Error', 'Unable to open ticket page. Please check your internet connection.');
                          }
                        } catch (error) {
                          console.error('Error opening ticket page:', error);
                          Alert.alert('Error', 'Failed to open ticket page. Please try again.');
                        }
                      }}
                    >
                      <Ionicons name="ticket" size={24} color="#fff" />
                      <Text style={styles.primaryTicketButtonText}>Get Tickets</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </Pressable>
                  )}

                  {/* Event Date & Time */}
                  {(recommendation as any).event_metadata?.start_time && typeof (recommendation as any).event_metadata.start_time === 'string' && (
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.text }]}>
                        {formatEventDateTime((recommendation as any).event_metadata.start_time)}
                      </Text>
                    </View>
                  )}

                  {/* Duration */}
                  {(recommendation as any).event_metadata.duration_minutes && typeof (recommendation as any).event_metadata.duration_minutes === 'number' && (
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.text }]}>
                        {(recommendation as any).event_metadata.duration_minutes} minutes
                      </Text>
                    </View>
                  )}

                  {/* Organizer/Venue */}
                  {(recommendation as any).event_metadata.organizer && typeof (recommendation as any).event_metadata.organizer === 'string' && (
                    <View style={styles.detailRow}>
                      <Ionicons name="business-outline" size={20} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.text }]}>
                        {(recommendation as any).event_metadata.organizer}
                      </Text>
                    </View>
                  )}

                  {/* Ticket Price */}
                  {(recommendation as any).event_metadata.ticket_price &&
                   typeof (recommendation as any).event_metadata.ticket_price.min === 'number' &&
                   typeof (recommendation as any).event_metadata.ticket_price.max === 'number' && (
                    <View style={styles.detailRow}>
                      <Ionicons name="pricetag-outline" size={20} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.text }]}>
                        ${((recommendation as any).event_metadata.ticket_price.min / 100).toFixed(0)} - ${((recommendation as any).event_metadata.ticket_price.max / 100).toFixed(0)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Book through Loop - Affiliate Partners */}
              {recommendation && (() => {
                const matchedPartners = getMatchingPartners(recommendation);
                if (matchedPartners.length === 0) return null;
                return (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Book through Loop</Text>
                    <View style={styles.affiliateButtons}>
                      {matchedPartners.map((partner) => (
                        <Pressable
                          key={partner.partnerId}
                          style={[styles.affiliateButton, { borderColor: partner.color, backgroundColor: partner.color + '0D' }]}
                          onPress={async () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            const success = await openAffiliateLink(partner.partnerId, recommendation, userId);
                            if (!success) {
                              Alert.alert('Error', `Unable to open ${partner.ctaText.toLowerCase()}. Please try again.`);
                            }
                          }}
                        >
                          <Ionicons name={partner.icon as any} size={22} color={partner.color} />
                          <Text style={[styles.affiliateButtonText, { color: partner.color }]}>
                            {partner.ctaText}
                          </Text>
                          <Ionicons name="arrow-forward" size={16} color={partner.color} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })()}

              {/* Quick Actions */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
                <View style={styles.actionButtons}>
                  {/* Event Page Button (for events) */}
                  {(recommendation as any).event_metadata?.event_url && (
                    <Pressable
                      style={[styles.actionButton, { borderColor: '#FF4444', backgroundColor: 'rgba(255, 68, 68, 0.05)' }]}
                      onPress={async () => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const url = (recommendation as any).event_metadata.event_url;
                          await Linking.openURL(url);
                        } catch {
                          Alert.alert('Error', 'Unable to open event page');
                        }
                      }}
                    >
                      <Ionicons name="ticket-outline" size={20} color="#FF4444" />
                      <Text style={[styles.actionButtonText, { color: '#FF4444', fontWeight: '600' }]}>
                        Event Page
                      </Text>
                    </Pressable>
                  )}

                  {/* Website Button (for venue/organizer website) */}
                  {recommendation.activity?.website && (
                    <Pressable
                      style={[styles.actionButton, { borderColor: colors.icon }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Linking.openURL(recommendation.activity!.website!).catch(() =>
                          Alert.alert('Error', 'Unable to open website')
                        );
                      }}
                    >
                      <IconSymbol name="globe" size={20} color={colors.primary} />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>
                        Website
                      </Text>
                    </Pressable>
                  )}

                  {/* Phone Button */}
                  {recommendation.activity?.phone && (
                    <Pressable
                      style={[styles.actionButton, { borderColor: colors.icon }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const phoneUrl = `tel:${recommendation.activity!.phone!.replace(/\D/g, '')}`;
                        Linking.openURL(phoneUrl).catch(() =>
                          Alert.alert('Error', 'Unable to make call')
                        );
                      }}
                    >
                      <IconSymbol name="phone.fill" size={20} color={colors.primary} />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>
                        Call
                      </Text>
                    </Pressable>
                  )}

                  {/* Directions Button */}
                  {recommendation.activity?.location && (
                    <Pressable
                      style={[styles.actionButton, { borderColor: colors.icon }]}
                      onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const { latitude, longitude } = recommendation.activity!.location;
                        const placeName = encodeURIComponent(recommendation.title);

                        // Define all map options
                        const googleMapsUrl = Platform.select({
                          ios: `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`,
                          android: `google.navigation:q=${latitude},${longitude}`,
                          default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
                        })!;

                        const appleMapsUrl = `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`;
                        const wazeUrl = `waze://?ll=${latitude},${longitude}&navigate=yes`;
                        const universalMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

                        // Try Google Maps first (most popular)
                        const googleMapsInstalled = await Linking.canOpenURL(googleMapsUrl).catch(() => false);

                        if (googleMapsInstalled) {
                          Linking.openURL(googleMapsUrl);
                          return;
                        }

                        // If Google Maps not available, show options
                        const availableApps: Array<{ name: string; url: string }> = [];

                        // Check Apple Maps (iOS only)
                        if (Platform.OS === 'ios') {
                          const appleMapsInstalled = await Linking.canOpenURL(appleMapsUrl).catch(() => false);
                          if (appleMapsInstalled) {
                            availableApps.push({ name: 'Apple Maps', url: appleMapsUrl });
                          }
                        }

                        // Check Waze
                        const wazeInstalled = await Linking.canOpenURL(wazeUrl).catch(() => false);
                        if (wazeInstalled) {
                          availableApps.push({ name: 'Waze', url: wazeUrl });
                        }

                        // Always add browser option as fallback
                        availableApps.push({ name: 'Open in Browser', url: universalMapsUrl });

                        // Show picker if multiple options available
                        if (availableApps.length > 1) {
                          Alert.alert(
                            'Open Directions In',
                            'Choose your preferred maps app',
                            [
                              ...availableApps.map(app => ({
                                text: app.name,
                                onPress: () => Linking.openURL(app.url),
                              })),
                              {
                                text: 'Cancel',
                                style: 'cancel',
                              },
                            ]
                          );
                        } else if (availableApps.length === 1) {
                          // Only browser available, open directly
                          Linking.openURL(availableApps[0].url);
                        } else {
                          Alert.alert('Error', 'Unable to open directions');
                        }
                      }}
                    >
                      <IconSymbol name="map.fill" size={20} color={colors.primary} />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>
                        Directions
                      </Text>
                    </Pressable>
                  )}

                  {/* Uber Button */}
                  {recommendation.activity?.location && (
                    <Pressable
                      style={[styles.actionButton, { borderColor: colors.icon, backgroundColor: 'rgba(0, 0, 0, 0.05)' }]}
                      onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const success = await openAffiliateLink('uber', recommendation, userId);
                        if (!success) {
                          Alert.alert('Error', 'Could not open Uber. Please try again.');
                        }
                      }}
                    >
                      <Ionicons name="car-outline" size={20} color="#000000" />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>
                        Uber
                      </Text>
                    </Pressable>
                  )}

                  {/* Lyft Button */}
                  {recommendation.activity?.location && (
                    <Pressable
                      style={[styles.actionButton, { borderColor: '#FF00BF', backgroundColor: 'rgba(255, 0, 191, 0.05)' }]}
                      onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const success = await openAffiliateLink('lyft', recommendation, userId);
                        if (!success) {
                          Alert.alert('Error', 'Could not open Lyft. Please try again.');
                        }
                      }}
                    >
                      <Ionicons name="car-sport-outline" size={20} color="#FF00BF" />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>
                        Lyft
                      </Text>
                    </Pressable>
                  )}

                  {/* Reviews Button (NOT for events - they don't have Google reviews) */}
                  {recommendation.activity?.googlePlaceId &&
                   !(recommendation as any).event_metadata?.event_url &&
                   !(recommendation as any).event_metadata?.start_time && (
                    <Pressable
                      style={[styles.actionButton, { borderColor: colors.icon }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        // Open Google Maps to reviews for this place
                        const placeId = recommendation.activity!.googlePlaceId;
                        const reviewsUrl = `https://search.google.com/local/reviews?placeid=${placeId}`;
                        Linking.openURL(reviewsUrl).catch(() =>
                          Alert.alert('Error', 'Unable to open reviews')
                        );
                      }}
                    >
                      <IconSymbol name="star.fill" size={20} color={colors.primary} />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>
                        Reviews
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Drag Handle - floats over hero image */}
          <View style={styles.dragHandleOverlay}>
            <DragHandle onClose={handleClose} />
          </View>

          {/* Footer Button */}
          <View style={[styles.footer, { backgroundColor: colors.card }]}>
            {recommendation.groupContext?.onChoose ? (
              <Pressable
                style={[styles.addButton, { backgroundColor: BrandColors.loopGreen }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  recommendation.groupContext!.onChoose!();
                }}
              >
                <Ionicons name="people" size={24} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Choose for Group</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={handleAddToCalendar}
                onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
              >
                <IconSymbol name="plus.circle.fill" size={24} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Add to Loop</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  modal: {
    height: SCREEN_HEIGHT * 0.95,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  dragHandleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
  },
  scrollContent: {
    paddingBottom: 100, // Space for fixed button
  },

  // IMAGES
  heroImage: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  heroFallback: {
    width: '100%',
    height: IMAGE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroFallbackIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroFallbackCategory: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textTransform: 'capitalize',
  },
  carouselContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  carouselImage: {
    width: SCREEN_WIDTH,
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
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },

  // CONTENT
  content: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  title: {
    flex: 1,
    fontWeight: '700',
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // METADATA
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  metaText: {
    fontSize: 15,
    fontWeight: '500',
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: BrandColors.veryLightGray,
  },

  // SECTIONS
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  mapPreviewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  mapPreview: {
    width: '100%',
    height: 200,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  reviewsContainer: {
    marginTop: 12,
  },
  reviewCard: {
    width: 280,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  reviewerAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewDate: {
    fontSize: 12,
    marginTop: 2,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 13,
    lineHeight: 18,
  },
  noReviewsText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
  },
  topicBubblesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  topicBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  topicText: {
    fontSize: 13,
    fontWeight: '600',
  },
  topicCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  // Loop comments
  loopCommentsSection: {
    marginTop: 8,
  },
  commentSourceLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  loopCommentCard: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loopCommentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  loopCommentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  loopCommentAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  loopCommentStars: {
    flexDirection: 'row' as const,
    gap: 2,
    paddingLeft: 30,
    marginBottom: 2,
  },
  loopCommentAuthor: {
    fontSize: 14,
    fontWeight: '600',
  },
  loopCommentDate: {
    fontSize: 12,
  },
  loopCommentText: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 30,
  },
  helpfulButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingLeft: 30,
    paddingTop: 6,
  },
  helpfulText: {
    fontSize: 12,
  },
  starRatingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
  },
  emptyCommentState: {
    alignItems: 'center' as const,
    paddingVertical: 24,
    gap: 6,
  },
  emptyCommentTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  emptyCommentSubtitle: {
    fontSize: 14,
  },
  addCommentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addCommentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentInputContainer: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  commentInput: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  commentInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  commentCancelText: {
    fontSize: 14,
  },
  commentPostButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  commentPostText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  googleReviewsSection: {
    marginTop: 16,
  },
  googleAttribution: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
    marginRight: 4,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },

  // DETAILED SCORE GRAPH
  detailedGraph: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  graphTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  graphTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: BrandColors.loopBlue,
  },
  detailedBarContainer: {
    marginBottom: Spacing.sm,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailedBarLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  barScore: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailedBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  detailedBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // REVIEW SUMMARY
  reviewSummary: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },

  // DETAILS LIST
  detailsList: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },

  // AFFILIATE BUTTONS
  affiliateButtons: {
    gap: Spacing.sm,
  },
  affiliateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  affiliateButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },

  // ACTION BUTTONS
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    minWidth: 110,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  buyTicketsButton: {
    backgroundColor: '#FF4444',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buyTicketsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // PRIMARY TICKET BUTTON (Large, prominent)
  primaryTicketButton: {
    backgroundColor: '#FF4444',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FF6666',
  },
  primaryTicketButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // FOOTER
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    shadowColor: BrandColors.loopBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  // Group Reasoning styles
  groupMembersContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  groupMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupMemberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  groupMemberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupMemberAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  groupMemberInfo: {
    flex: 1,
  },
  groupMemberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  groupInterestChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  groupInterestChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  groupInterestChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  groupMemberDistance: {
    fontSize: 12,
    marginTop: 2,
  },
  groupScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  groupScoreText: {
    fontSize: 13,
    fontWeight: '500',
  },
  groupReasoningBanner: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});
