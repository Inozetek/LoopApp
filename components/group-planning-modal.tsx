/**
 * Group Planning Modal
 *
 * Allows users to:
 * - Select friends for group activity
 * - Add custom tags/constraints
 * - See AI-suggested activities based on group preferences
 * - Send invitations to selected friends
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { BrandColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import { handleError } from '@/utils/error-handler';
import { calculateGroupMidpoint } from '@/services/loop-service';
import { searchNearbyPlaces, generateGroupRecommendations, PlaceLocation } from '@/services/recommendations';
import { getPlacePhotoUrl } from '@/services/google-places';
import { FriendGroup, getFriendGroups, getFriendsEligibleForGroupRecs } from '@/services/friend-groups-service';
import { GroupSuggestionsMap } from '@/components/group-suggestions-map';

interface Friend {
  id: string;
  name: string;
  email: string;
  profile_picture_url: string | null;
  loop_score: number;
}

interface GroupPlanningModalProps {
  visible: boolean;
  onClose: () => void;
  friends: Friend[];
  userId: string;
}

const AVAILABLE_TAGS = [
  'Budget-Friendly',
  'Indoor',
  'Outdoor',
  'Evening',
  'Weekend',
  'Family-Friendly',
  'Dog-Friendly',
  'Live Music',
  'Food & Drink',
  'Active',
  'Relaxing',
  'Cultural',
];

export function GroupPlanningModal({
  visible,
  onClose,
  friends,
  userId,
}: GroupPlanningModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [groupMidpoint, setGroupMidpoint] = useState<{ latitude: number; longitude: number } | null>(null);

  // Date/time picker state — defaults to tomorrow at 6 PM
  const [planDate, setPlanDate] = useState<Date>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    return tomorrow;
  });
  const [planTime, setPlanTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    return d;
  });
  const [showPlanDatePicker, setShowPlanDatePicker] = useState(false);
  const [showPlanTimePicker, setShowPlanTimePicker] = useState(false);

  // Step 0: Group selection
  const [friendGroups, setFriendGroups] = useState<FriendGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showGroupSelection, setShowGroupSelection] = useState(true);

  useEffect(() => {
    if (visible) {
      // Load friend groups when modal opens
      loadGroups();
    } else {
      // Reset state when modal closes
      setSelectedFriends([]);
      setSelectedTags([]);
      setCustomTag('');
      setSuggestions([]);
      setShowSuggestions(false);
      setGroupMidpoint(null);
      setSelectedGroupId(null);
      setShowGroupSelection(true);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(18, 0, 0, 0);
      setPlanDate(tomorrow);
      const defaultTime = new Date();
      defaultTime.setHours(18, 0, 0, 0);
      setPlanTime(defaultTime);
      setShowPlanDatePicker(false);
      setShowPlanTimePicker(false);
    }
  }, [visible]);

  const loadGroups = async () => {
    try {
      const groups = await getFriendGroups(userId);
      setFriendGroups(groups);
    } catch (error) {
      console.error('[GroupPlanning] Error loading groups:', error);
    }
  };

  const selectGroup = async (group: FriendGroup) => {
    setSelectedGroupId(group.id);
    // Pre-populate friends filtered by include_in_group_recs
    try {
      const eligible = await getFriendsEligibleForGroupRecs(userId, group.id);
      setSelectedFriends(eligible);
    } catch {
      // Fallback: use all members
      setSelectedFriends(group.members.map((m) => m.friend_user_id));
    }
    setShowGroupSelection(false);
  };

  /**
   * Fetch locations of selected friends and current user to calculate group midpoint
   */
  const calculateMeetingMidpoint = async (): Promise<{ latitude: number; longitude: number }> => {
    const locations: { latitude: number; longitude: number }[] = [];

    try {
      // Fetch current user's home location
      const { data: currentUserData, error: userError } = await supabase
        .from('users')
        .select('home_location')
        .eq('id', userId)
        .single();

      if (!userError && currentUserData?.home_location) {
        // Parse PostGIS POINT format: "POINT(longitude latitude)" or geometry object
        const userLocation = parseLocation(currentUserData.home_location);
        if (userLocation) {
          locations.push(userLocation);
        }
      }

      // For demo friends, use mock locations around Dallas
      const demoFriendLocations: Record<string, { latitude: number; longitude: number }> = {
        'friend-1': { latitude: 32.8234, longitude: -96.7567 }, // North Dallas
        'friend-2': { latitude: 32.7512, longitude: -96.8315 }, // Oak Cliff
        'friend-3': { latitude: 32.7882, longitude: -96.6989 }, // East Dallas
      };

      // Fetch selected friends' home locations
      for (const friendId of selectedFriends) {
        // Check if it's a demo friend
        if (friendId.startsWith('friend-')) {
          const demoLocation = demoFriendLocations[friendId];
          if (demoLocation) {
            locations.push(demoLocation);
          }
          continue;
        }

        // Fetch real friend's location from database
        const { data: friendData, error: friendError } = await supabase
          .from('users')
          .select('home_location')
          .eq('id', friendId)
          .single();

        if (!friendError && friendData?.home_location) {
          const friendLocation = parseLocation(friendData.home_location);
          if (friendLocation) {
            locations.push(friendLocation);
          }
        }
      }

      // If we have locations, calculate the midpoint
      if (locations.length > 0) {
        const midpoint = calculateGroupMidpoint(locations);
        console.log(`[GroupPlanning] Calculated midpoint from ${locations.length} locations:`, midpoint);
        return midpoint;
      }

      // Default fallback to Dallas downtown if no locations available
      console.log('[GroupPlanning] No locations found, using Dallas downtown as fallback');
      return { latitude: 32.7767, longitude: -96.7970 };
    } catch (error) {
      console.error('[GroupPlanning] Error calculating midpoint:', error);
      // Fallback to Dallas downtown
      return { latitude: 32.7767, longitude: -96.7970 };
    }
  };

  /**
   * Parse location from various PostGIS formats
   */
  const parseLocation = (location: any): { latitude: number; longitude: number } | null => {
    if (!location) return null;

    // Handle string format: "POINT(-96.7970 32.7767)"
    if (typeof location === 'string') {
      const match = location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
      if (match) {
        return {
          longitude: parseFloat(match[1]),
          latitude: parseFloat(match[2]),
        };
      }
    }

    // Handle object format: { longitude: -96.7970, latitude: 32.7767 }
    if (typeof location === 'object') {
      if (location.latitude && location.longitude) {
        return {
          latitude: parseFloat(location.latitude),
          longitude: parseFloat(location.longitude),
        };
      }
      // Handle GeoJSON format
      if (location.coordinates && Array.isArray(location.coordinates)) {
        return {
          longitude: location.coordinates[0],
          latitude: location.coordinates[1],
        };
      }
    }

    return null;
  };

  const toggleFriend = (friendId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const toggleTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    if (!customTag.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags((prev) => [...prev, customTag.trim()]);
    setCustomTag('');
  };

  const removeCustomTag = (tag: string) => {
    if (!AVAILABLE_TAGS.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    }
  };

  const handleFindActivities = async () => {
    if (selectedFriends.length === 0) {
      Alert.alert('No Friends Selected', 'Please select at least one friend for the group activity');
      return;
    }

    if (selectedFriends.length > 5) {
      Alert.alert('Too Many Friends', 'Group planning supports up to 5 friends for MVP. Select fewer friends.');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Calculate the group midpoint based on all participants' locations
      const midpoint = await calculateMeetingMidpoint();
      setGroupMidpoint(midpoint);
      console.log('[GroupPlanning] Group midpoint calculated:', midpoint);

      // Map selected tags to Google Places API types
      const includedTypes = mapTagsToPlaceTypes(selectedTags);
      console.log('[GroupPlanning] Searching with types:', includedTypes);

      // Search for real places near the group midpoint
      const places = await searchNearbyPlaces({
        location: { lat: midpoint.latitude, lng: midpoint.longitude },
        radius: 8000, // 8km radius to find good options
        maxResults: 10,
        includedTypes: includedTypes.length > 0 ? includedTypes : undefined,
      });

      if (places.length === 0) {
        // Fallback to mock suggestions if no places found
        console.log('[GroupPlanning] No places found, using fallback suggestions');
        const fallbackSuggestions = getFallbackSuggestions();
        setSuggestions(fallbackSuggestions);
      } else {
        // Convert places to suggestion format
        const realSuggestions = places.slice(0, 5).map((place) => ({
          id: place.place_id,
          name: place.name,
          category: mapPlaceTypesToCategory(place.types || []),
          description: place.description || place.vicinity || 'Great spot for groups',
          distance: calculateDistance(midpoint.latitude, midpoint.longitude, place.geometry.location.lat, place.geometry.location.lng),
          rating: place.rating || 4.0,
          priceRange: place.price_level || 2,
          photoUrl: place.photos?.[0]?.photo_reference
            ? getPlacePhotoUrl(place.photos[0].photo_reference, 800)
            : 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800',
          address: place.formatted_address || place.vicinity,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
        }));

        console.log(`[GroupPlanning] Found ${realSuggestions.length} real places`);
        setSuggestions(realSuggestions);
      }

      setShowSuggestions(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error finding group activities:', error);
      // Use fallback on error
      const fallbackSuggestions = getFallbackSuggestions();
      setSuggestions(fallbackSuggestions);
      setShowSuggestions(true);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Map selected tags to Google Places API types
   */
  const mapTagsToPlaceTypes = (tags: string[]): string[] => {
    const tagToType: Record<string, string[]> = {
      'Food & Drink': ['restaurant', 'bar', 'cafe'],
      'Indoor': ['museum', 'movie_theater', 'bowling_alley'],
      'Outdoor': ['park', 'tourist_attraction'],
      'Live Music': ['night_club', 'bar'],
      'Active': ['gym', 'park', 'bowling_alley'],
      'Relaxing': ['spa', 'cafe', 'park'],
      'Cultural': ['museum', 'art_gallery', 'library'],
      'Family-Friendly': ['park', 'museum', 'zoo', 'aquarium'],
      'Budget-Friendly': ['park', 'library'],
    };

    const types = new Set<string>();
    for (const tag of tags) {
      const mappedTypes = tagToType[tag];
      if (mappedTypes) {
        mappedTypes.forEach((t) => types.add(t));
      }
    }

    return Array.from(types);
  };

  /**
   * Map Google Place types to a display category
   */
  const mapPlaceTypesToCategory = (types: string[]): string => {
    const typeToCategory: Record<string, string> = {
      // Food & Drink
      restaurant: 'Dining',
      american_restaurant: 'Dining',
      italian_restaurant: 'Dining',
      mexican_restaurant: 'Dining',
      japanese_restaurant: 'Dining',
      chinese_restaurant: 'Dining',
      thai_restaurant: 'Dining',
      indian_restaurant: 'Dining',
      seafood_restaurant: 'Dining',
      pizza_restaurant: 'Dining',
      hamburger_restaurant: 'Dining',
      bakery: 'Dining',
      meal_takeaway: 'Dining',
      fast_food_restaurant: 'Dining',
      cafe: 'Coffee',
      coffee_shop: 'Coffee',
      bar: 'Nightlife',
      night_club: 'Nightlife',
      wine_bar: 'Nightlife',
      // Entertainment
      movie_theater: 'Entertainment',
      bowling_alley: 'Entertainment',
      amusement_park: 'Entertainment',
      performing_arts_theater: 'Entertainment',
      comedy_club: 'Entertainment',
      concert_hall: 'Entertainment',
      casino: 'Entertainment',
      karaoke: 'Entertainment',
      // Outdoor & Nature
      park: 'Outdoor',
      zoo: 'Outdoor',
      aquarium: 'Outdoor',
      garden: 'Outdoor',
      hiking_area: 'Outdoor',
      national_park: 'Outdoor',
      // Fitness & Wellness
      gym: 'Fitness',
      fitness_center: 'Fitness',
      spa: 'Wellness',
      // Culture
      museum: 'Culture',
      art_gallery: 'Culture',
      library: 'Culture',
      historical_landmark: 'Culture',
      // Sports
      stadium: 'Sports',
      sports_complex: 'Sports',
      golf_course: 'Sports',
      // Shopping
      shopping_mall: 'Shopping',
      clothing_store: 'Shopping',
      market: 'Shopping',
      // Travel
      tourist_attraction: 'Sightseeing',
    };

    for (const type of types) {
      if (typeToCategory[type]) {
        return typeToCategory[type];
      }
    }

    return 'Activities';
  };

  /**
   * Calculate distance between two coordinates in miles
   */
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  /**
   * Get fallback suggestions when API fails
   */
  const getFallbackSuggestions = () => [
    {
      id: 'fallback-1',
      name: 'Klyde Warren Park',
      category: 'Outdoor',
      description: 'Great outdoor space perfect for groups',
      distance: 2.3,
      rating: 4.7,
      priceRange: 1,
      photoUrl: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=800',
    },
    {
      id: 'fallback-2',
      name: 'Reunion Tower',
      category: 'Sightseeing',
      description: 'Iconic landmark with amazing views',
      distance: 1.8,
      rating: 4.5,
      priceRange: 2,
      photoUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800',
    },
    {
      id: 'fallback-3',
      name: 'Deep Ellum',
      category: 'Entertainment',
      description: 'Vibrant arts district with food and music',
      distance: 3.1,
      rating: 4.6,
      priceRange: 2,
      photoUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    },
  ];

  const handleSelectActivity = async (activity: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Use the calculated group midpoint, or fallback to Dallas
      const meetingPoint = groupMidpoint || { latitude: 32.7767, longitude: -96.7970 };

      // Combine selected date + time into suggested_time
      const suggestedTime = new Date(planDate);
      suggestedTime.setHours(planTime.getHours(), planTime.getMinutes(), 0, 0);

      // Create group plan with the calculated midpoint
      const { data: planData, error: planError } = await supabase
        .from('group_plans')
        .insert({
          creator_id: userId,
          activity_id: null, // Will link to activities table in Phase 2
          title: activity.name,
          description: activity.description,
          suggested_time: suggestedTime.toISOString(),
          duration_minutes: 120,
          meeting_location: `POINT(${meetingPoint.longitude} ${meetingPoint.latitude})`, // Calculated midpoint
          meeting_address: activity.name,
          constraint_tags: selectedTags,
          status: 'proposed',
        } as any)
        .select()
        .single();

      if (planError) throw planError;

      const groupPlan = planData as any;

      // Add participants
      const participants = selectedFriends.map((friendId) => ({
        plan_id: groupPlan.id,
        user_id: friendId,
        rsvp_status: 'invited',
        invited_at: new Date().toISOString(),
      }));

      const { error: participantsError } = await supabase
        .from('plan_participants')
        .insert(participants as any);

      if (participantsError) throw participantsError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Group Plan Created! 🎉',
        `Invitations sent to ${selectedFriends.length} friend(s) for "${activity.name}"\n\nFull group planning features coming in Phase 2!`,
        [
          {
            text: 'Great!',
            onPress: () => {
              onClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating group plan:', error);
      handleError(error, 'creating group plan');
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPriceDisplay = (priceRange: number) => {
    return '$'.repeat(Math.max(1, priceRange));
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Plan Group Activity</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {showGroupSelection && friendGroups.length > 0 ? (
              <>
                {/* Step 0: Select a Group or Choose Individually */}
                <View style={[styles.card, { backgroundColor: isDark ? '#1f2123' : '#ffffff' }]}>
                  <Text style={[Typography.titleLarge, { color: colors.text, marginBottom: 8 }]}>
                    Start from a Group?
                  </Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon, marginBottom: 12 }]}>
                    Select a friend group or choose individual friends
                  </Text>

                  {friendGroups.map((group) => (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.groupOption,
                        { borderColor: colors.icon + '30' },
                      ]}
                      onPress={() => selectGroup(group)}
                    >
                      <Text style={{ fontSize: 20, marginRight: 8 }}>{group.emoji || '👥'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.bodyMedium, { color: colors.text }]}>{group.name}</Text>
                        <Text style={[Typography.bodySmall, { color: colors.icon }]}>
                          {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    style={[styles.groupOption, { borderColor: BrandColors.loopBlue + '40' }]}
                    onPress={() => setShowGroupSelection(false)}
                  >
                    <Ionicons name="people-outline" size={20} color={BrandColors.loopBlue} style={{ marginRight: 8 }} />
                    <Text style={[Typography.bodyMedium, { color: BrandColors.loopBlue, flex: 1 }]}>
                      Choose Individual Friends
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color={BrandColors.loopBlue} />
                  </TouchableOpacity>
                </View>
              </>
            ) : !showSuggestions ? (
              <>
                {/* Select Friends */}
                <View style={[styles.card, { backgroundColor: isDark ? '#1f2123' : '#ffffff' }]}>
                  <Text style={[Typography.titleLarge, { color: colors.text, marginBottom: 8 }]}>
                    Select Friends
                  </Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon, marginBottom: 12 }]}>
                    Choose 1-5 friends to invite
                  </Text>

                  <View style={styles.friendsList}>
                    {friends.map((friend) => (
                      <TouchableOpacity
                        key={friend.id}
                        onPress={() => toggleFriend(friend.id)}
                        style={[
                          styles.friendChip,
                          selectedFriends.includes(friend.id) && styles.friendChipSelected,
                          {
                            backgroundColor: selectedFriends.includes(friend.id)
                              ? BrandColors.loopBlue
                              : isDark
                              ? '#2f3133'
                              : '#f5f5f5',
                            borderColor: selectedFriends.includes(friend.id)
                              ? BrandColors.loopBlue
                              : colors.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.friendAvatar,
                            { backgroundColor: selectedFriends.includes(friend.id) ? '#ffffff' : BrandColors.loopBlue },
                          ]}
                        >
                          <Text
                            style={[
                              styles.friendAvatarText,
                              {
                                color: selectedFriends.includes(friend.id)
                                  ? BrandColors.loopBlue
                                  : '#ffffff',
                              },
                            ]}
                          >
                            {getInitials(friend.name)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            Typography.bodyMedium,
                            {
                              color: selectedFriends.includes(friend.id) ? '#ffffff' : colors.text,
                            },
                          ]}
                        >
                          {friend.name.split(' ')[0]}
                        </Text>
                        {selectedFriends.includes(friend.id) && (
                          <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>

                  {selectedFriends.length > 0 && (
                    <Text style={[Typography.labelMedium, { color: BrandColors.loopBlue, marginTop: 8 }]}>
                      {selectedFriends.length} friend(s) selected
                    </Text>
                  )}
                </View>

                {/* When? Date & Time Picker */}
                <View style={[styles.card, { backgroundColor: isDark ? '#1f2123' : '#ffffff' }]}>
                  <Text style={[Typography.titleLarge, { color: colors.text, marginBottom: 8 }]}>
                    When?
                  </Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon, marginBottom: 12 }]}>
                    Pick a date and time for the activity
                  </Text>

                  <View style={styles.dateTimeRow}>
                    <TouchableOpacity
                      style={[styles.dateTimePickerButton, { backgroundColor: isDark ? '#2f3133' : '#f5f5f5', borderColor: colors.border }]}
                      onPress={() => setShowPlanDatePicker(true)}
                    >
                      <Ionicons name="calendar-outline" size={18} color={BrandColors.loopBlue} />
                      <Text style={[Typography.bodyMedium, { color: colors.text, marginLeft: 8 }]}>
                        {planDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.dateTimePickerButton, { backgroundColor: isDark ? '#2f3133' : '#f5f5f5', borderColor: colors.border }]}
                      onPress={() => setShowPlanTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={18} color={BrandColors.loopBlue} />
                      <Text style={[Typography.bodyMedium, { color: colors.text, marginLeft: 8 }]}>
                        {planTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showPlanDatePicker && (
                    <DateTimePicker
                      value={planDate}
                      mode="date"
                      display="default"
                      minimumDate={new Date()}
                      onChange={(_event, date) => {
                        setShowPlanDatePicker(Platform.OS === 'ios');
                        if (date) setPlanDate(date);
                      }}
                    />
                  )}
                  {showPlanTimePicker && (
                    <DateTimePicker
                      value={planTime}
                      mode="time"
                      display="default"
                      onChange={(_event, time) => {
                        setShowPlanTimePicker(Platform.OS === 'ios');
                        if (time) setPlanTime(time);
                      }}
                    />
                  )}
                </View>

                {/* Tags/Constraints */}
                <View style={[styles.card, { backgroundColor: isDark ? '#1f2123' : '#ffffff' }]}>
                  <Text style={[Typography.titleLarge, { color: colors.text, marginBottom: 8 }]}>
                    Activity Preferences
                  </Text>
                  <Text style={[Typography.bodySmall, { color: colors.icon, marginBottom: 12 }]}>
                    Select tags to filter suggestions (optional)
                  </Text>

                  <View style={styles.tagsGrid}>
                    {AVAILABLE_TAGS.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => toggleTag(tag)}
                        style={[
                          styles.tagChip,
                          selectedTags.includes(tag) && styles.tagChipSelected,
                          {
                            backgroundColor: selectedTags.includes(tag)
                              ? BrandColors.loopGreen
                              : isDark
                              ? '#2f3133'
                              : '#f5f5f5',
                            borderColor: selectedTags.includes(tag)
                              ? BrandColors.loopGreen
                              : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            Typography.bodySmall,
                            {
                              color: selectedTags.includes(tag) ? '#ffffff' : colors.text,
                            },
                          ]}
                        >
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Custom tags */}
                  {selectedTags.filter((t) => !AVAILABLE_TAGS.includes(t)).length > 0 && (
                    <View style={styles.customTagsContainer}>
                      {selectedTags
                        .filter((t) => !AVAILABLE_TAGS.includes(t))
                        .map((tag) => (
                          <View
                            key={tag}
                            style={[
                              styles.customTag,
                              { backgroundColor: BrandColors.loopBlue + '20' },
                            ]}
                          >
                            <Text style={[Typography.bodySmall, { color: BrandColors.loopBlue }]}>
                              {tag}
                            </Text>
                            <TouchableOpacity onPress={() => removeCustomTag(tag)}>
                              <Ionicons name="close-circle" size={18} color={BrandColors.loopBlue} />
                            </TouchableOpacity>
                          </View>
                        ))}
                    </View>
                  )}

                  {/* Add custom tag */}
                  <View style={styles.customTagInput}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: isDark ? '#2f3133' : '#f5f5f5',
                          borderColor: colors.border,
                          color: colors.text,
                          flex: 1,
                        },
                      ]}
                      value={customTag}
                      onChangeText={setCustomTag}
                      placeholder="Add custom tag..."
                      placeholderTextColor={colors.icon}
                      maxLength={30}
                      onSubmitEditing={addCustomTag}
                    />
                    <TouchableOpacity
                      onPress={addCustomTag}
                      style={[styles.addTagButton, { backgroundColor: BrandColors.loopBlue }]}
                      disabled={!customTag.trim()}
                    >
                      <Ionicons name="add" size={24} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              /* Suggestions */
              <View style={[styles.card, { backgroundColor: isDark ? '#1f2123' : '#ffffff' }]}>
                <Text style={[Typography.titleLarge, { color: colors.text, marginBottom: 8 }]}>
                  Suggested Activities
                </Text>
                <Text style={[Typography.bodySmall, { color: colors.icon, marginBottom: 16 }]}>
                  Based on your group&apos;s preferences and location
                </Text>

                {/* Map preview showing midpoint + venues */}
                {groupMidpoint && (
                  <GroupSuggestionsMap
                    midpoint={groupMidpoint}
                    suggestions={suggestions}
                  />
                )}

                {suggestions.map((activity) => (
                  <TouchableOpacity
                    key={activity.id}
                    onPress={() => handleSelectActivity(activity)}
                    style={[styles.suggestionCard, { backgroundColor: isDark ? '#2f3133' : '#f8f9fa' }]}
                  >
                    <View style={styles.suggestionInfo}>
                      <Text style={[Typography.titleMedium, { color: colors.text }]}>
                        {activity.name}
                      </Text>
                      <Text style={[Typography.bodySmall, { color: colors.icon, marginTop: 4 }]}>
                        {activity.description}
                      </Text>
                      <View style={styles.suggestionMeta}>
                        <View style={styles.metaItem}>
                          <Ionicons name="star" size={14} color={BrandColors.star} />
                          <Text style={[Typography.bodySmall, { color: colors.text, marginLeft: 4 }]}>
                            {activity.rating}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Text style={[Typography.bodySmall, { color: colors.text }]}>
                            {getPriceDisplay(activity.priceRange)}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="location" size={14} color={colors.icon} />
                          <Text style={[Typography.bodySmall, { color: colors.icon, marginLeft: 4 }]}>
                            {activity.distance} mi
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color={colors.icon} />
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  onPress={() => setShowSuggestions(false)}
                  style={styles.backButton}
                >
                  <Ionicons name="arrow-back" size={20} color={BrandColors.loopBlue} />
                  <Text style={[Typography.labelMedium, { color: BrandColors.loopBlue, marginLeft: 8 }]}>
                    Change Selection
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Find Activities Button */}
          {!showSuggestions && (
            <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={handleFindActivities}
                disabled={loading || selectedFriends.length === 0}
                style={[
                  styles.findButton,
                  {
                    backgroundColor: BrandColors.loopBlue,
                    opacity: loading || selectedFriends.length === 0 ? 0.5 : 1,
                  },
                ]}
              >
                <Ionicons name="search" size={20} color="#ffffff" />
                <Text style={styles.findButtonText}>
                  {loading ? 'Finding Activities...' : 'Find Group Activities'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  groupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dateTimePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  friendsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  friendChipSelected: {
    transform: [{ scale: 1.02 }],
  },
  friendAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  tagChipSelected: {
    transform: [{ scale: 1.02 }],
  },
  customTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.md,
  },
  customTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
  },
  customTagInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  addTagButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
  },
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    ...Shadows.md,
  },
  findButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
});
