import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
  Animated,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from 'react-native';
// NOTE: react-native-maps disabled for web compatibility
// Map preview in create event modal is temporarily disabled
// TODO: Create separate MapPreview component with .web.tsx version
// let MapView: any;
// let Marker: any;
// let Callout: any;
// let PROVIDER_GOOGLE: any;
//
// if (Platform.OS !== 'web') {
//   const maps = require('react-native-maps');
//   MapView = maps.default;
//   Marker = maps.Marker;
//   Callout = maps.Callout;
//   PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
// }

import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { BrandColors, CategoryColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { FeedbackModal } from '@/components/feedback-modal';
import { CalendarEventSkeleton } from '@/components/skeleton-loader';
import { LoopMapView } from '@/components/loop-map-view';
import SwipeableLayout from '@/components/swipeable-layout';
import { LocationAutocomplete } from '@/components/location-autocomplete';
import { CalendarHeader } from '@/components/calendar-header';
import { TaskDetailsModal } from '@/components/task-details-modal';
import { getCurrentLocation } from '@/services/location-service';
import {
  getPendingFeedbackActivities,
  markEventAsCompleted,
  shouldPromptForFeedback,
  CompletedActivity,
} from '@/services/feedback-service';
import {
  syncCalendarToDatabase,
  getUpcomingFreeTime,
  checkCalendarPermissions,
  fetchCalendarEventsForPreview,
  syncSelectedEventsToDatabase,
  CalendarEventPreview,
} from '@/services/calendar-service';

// Parse IEEE 754 double from hex string
function hexToFloat64(hex: string, littleEndian: boolean): number {
  const bytes = hex.match(/../g)!.map(b => parseInt(b, 16));
  const buffer = new ArrayBuffer(8);
  const uint8 = new Uint8Array(buffer);
  bytes.forEach((b, i) => (uint8[i] = b));
  const view = new DataView(buffer);
  return view.getFloat64(0, littleEndian);
}

// Parse PostGIS EWKB/WKB hex-encoded POINT to lat/lng
function parseWKBHexPoint(hex: string): { latitude: number; longitude: number } | null {
  if (typeof hex !== 'string' || !/^[0-9a-fA-F]+$/.test(hex) || hex.length < 42) return null;

  const isLittleEndian = hex.substring(0, 2) === '01';

  // Read geometry type (4 bytes at offset 1 byte)
  const typeHex = hex.substring(2, 10);
  const typeBytes = typeHex.match(/../g)!.map(b => parseInt(b, 16));
  const typeNum = isLittleEndian
    ? typeBytes[0] | (typeBytes[1] << 8) | (typeBytes[2] << 16) | (typeBytes[3] << 24)
    : (typeBytes[0] << 24) | (typeBytes[1] << 16) | (typeBytes[2] << 8) | typeBytes[3];

  const hasSRID = (typeNum & 0x20000000) !== 0;
  const geomType = typeNum & 0xff;

  if (geomType !== 1) return null; // Not a POINT

  let offset = 10; // After byte order (2) + type (8)
  if (hasSRID) offset += 8; // Skip SRID (4 bytes = 8 hex chars)

  if (hex.length < offset + 32) return null; // Need 32 more hex chars for two doubles

  const lng = hexToFloat64(hex.substring(offset, offset + 16), isLittleEndian);
  const lat = hexToFloat64(hex.substring(offset + 16, offset + 32), isLittleEndian);

  if (isNaN(lng) || isNaN(lat)) return null;
  return { latitude: lat, longitude: lng };
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  category: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  activity_id?: string; // Present if task came from a recommendation
}

// Venue details for tasks that originated from recommendations
interface VenueDetails {
  rating?: number;
  reviewsCount?: number;
  website?: string;
  phone?: string;
  openNow?: boolean;
  photos?: string[];
}

const CATEGORIES = [
  { id: 'dining', label: 'Dining', icon: 'restaurant', color: CategoryColors.dining },
  { id: 'entertainment', label: 'Entertainment', icon: 'musical-notes', color: CategoryColors.entertainment },
  { id: 'fitness', label: 'Fitness', icon: 'fitness', color: CategoryColors.fitness },
  { id: 'social', label: 'Social', icon: 'people', color: CategoryColors.social },
  { id: 'work', label: 'Work', icon: 'briefcase', color: CategoryColors.work },
  { id: 'personal', label: 'Personal', icon: 'person', color: CategoryColors.personal },
  { id: 'travel', label: 'Travel', icon: 'airplane', color: CategoryColors.travel },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: CategoryColors.other },
];

// Map Google place types to calendar categories
function getCategoryFromPlaceTypes(types: string[]): string {
  if (!types || types.length === 0) return 'personal';

  // Check types in priority order
  const typeMap: { [key: string]: string } = {
    // Dining
    'restaurant': 'dining',
    'cafe': 'dining',
    'bar': 'dining',
    'bakery': 'dining',
    'meal_takeaway': 'dining',
    'meal_delivery': 'dining',
    'food': 'dining',

    // Fitness
    'gym': 'fitness',
    'spa': 'fitness',
    'stadium': 'fitness',
    'park': 'fitness',

    // Entertainment
    'movie_theater': 'entertainment',
    'night_club': 'entertainment',
    'bowling_alley': 'entertainment',
    'amusement_park': 'entertainment',
    'aquarium': 'entertainment',
    'art_gallery': 'entertainment',
    'museum': 'entertainment',
    'library': 'entertainment',
    'zoo': 'entertainment',

    // Work
    'office': 'work',
    'accounting': 'work',
    'lawyer': 'work',
    'courthouse': 'work',

    // Travel
    'airport': 'travel',
    'bus_station': 'travel',
    'train_station': 'travel',
    'transit_station': 'travel',
    'car_rental': 'travel',
    'lodging': 'travel',
    'hotel': 'travel',

    // Social
    'shopping_mall': 'social',
    'store': 'social',
    'clothing_store': 'social',
  };

  // Find first matching type
  for (const type of types) {
    if (typeMap[type]) {
      return typeMap[type];
    }
  }

  return 'personal'; // Default fallback
}

export default function CalendarScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'loop'>('list'); // Toggle between list and map view

  // Create task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('personal');
  const [newTaskDate, setNewTaskDate] = useState(new Date());
  const [newTaskTime, setNewTaskTime] = useState(new Date());
  const [newTaskEndTime, setNewTaskEndTime] = useState(() => {
    const end = new Date();
    end.setHours(end.getHours() + 1); // Default 1 hour later
    return end;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [newTaskAddress, setNewTaskAddress] = useState('');
  const [newTaskLocation, setNewTaskLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [newTaskPlaceName, setNewTaskPlaceName] = useState('');

  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackActivity, setFeedbackActivity] = useState<CompletedActivity | null>(null);

  // Edit task modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Menu drawer state
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);

  // Task details modal state (opened from loop map "View Details")
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<CalendarEvent | null>(null);
  const [selectedTaskVenueDetails, setSelectedTaskVenueDetails] = useState<VenueDetails | null>(null);

  // User's current location for autocomplete biasing
  const [currentUserLocation, setCurrentUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Calendar sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [freeTimeSlots, setFreeTimeSlots] = useState<Array<{
    start: Date;
    end: Date;
    durationMinutes: number;
  }>>([]);
  const [showFreeTime, setShowFreeTime] = useState(false);

  // Sync preview modal state
  const [showSyncPreview, setShowSyncPreview] = useState(false);
  const [syncPreviewEvents, setSyncPreviewEvents] = useState<CalendarEventPreview[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Animation for events list
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadEvents();
    // NOTE: We intentionally do NOT auto-check for pending feedback on date change.
    // Feedback prompts should only appear when:
    // 1. User explicitly marks a task as "Rate Activity" (completed)
    // 2. In the future: when geofencing detects they visited the location
    //
    // Auto-prompting based on time alone is problematic because we can't verify
    // the user actually went to the location.
  }, [selectedDate]);

  // Load free time slots on mount so they're available before a sync
  useEffect(() => {
    loadFreeTime();
  }, [user]);

  // Smart default end time based on category
  useEffect(() => {
    const categoryDurations: Record<string, number> = {
      dining: 1.5,
      entertainment: 2,
      fitness: 1,
      social: 2,
      work: 4,
      personal: 1,
      travel: 2,
      other: 1,
    };

    const durationHours = categoryDurations[newTaskCategory] || 1;
    const newEndTime = new Date(newTaskTime);
    newEndTime.setHours(newEndTime.getHours() + durationHours);
    setNewTaskEndTime(newEndTime);
  }, [newTaskCategory, newTaskTime]);

  // Fetch user's current location on mount for autocomplete biasing
  useEffect(() => {
    const fetchUserLocation = async () => {
      try {
        const location = await getCurrentLocation();
        setCurrentUserLocation({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        console.log(`📍 User location for autocomplete: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);
      } catch (error) {
        console.warn('Could not get user location for autocomplete:', error);
        // Fallback to user's home location if available
        if (user?.home_location) {
          const homeCoords = user.home_location as any;
          setCurrentUserLocation({
            latitude: homeCoords.coordinates[1],
            longitude: homeCoords.coordinates[0],
          });
        }
      }
    };

    fetchUserLocation();
  }, [user]);

  useEffect(() => {
    // Fade in events when they load
    if (events.length > 0 && !loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [events, loading]);

  /**
   * Check for pending feedback activities.
   *
   * NOTE: This is now only called AFTER a user explicitly marks a task as complete.
   * We do NOT auto-prompt on app load or date change because:
   * 1. We can't verify the user actually visited the location
   * 2. Auto-prompts for unattended events are annoying and inaccurate
   *
   * Future: Use geofencing to detect when user actually arrives at a task location,
   * then prompt for feedback after they leave.
   */
  const checkForPendingFeedback = async () => {
    // This function is intentionally a no-op now.
    // Feedback prompts are triggered directly when user taps "Rate Activity"
    // via the handleMarkAsComplete function.
    return;
  };

  // Open sync preview modal - shows device calendar events for selection
  const handleSyncCalendar = async () => {
    if (!user) return;

    try {
      setIsLoadingPreview(true);
      console.log('📅 Loading calendar events for preview...');

      // Check if we have calendar permissions
      const hasPermission = await checkCalendarPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Calendar Permission Required',
          'Loop needs access to your calendar to import events and detect free time.',
          [{ text: 'OK' }]
        );
        setIsLoadingPreview(false);
        return;
      }

      // Fetch events for preview
      const previewEvents = await fetchCalendarEventsForPreview(30);
      setSyncPreviewEvents(previewEvents);
      setShowSyncPreview(true);

    } catch (error) {
      console.error('❌ Error loading calendar preview:', error);
      Alert.alert('Error', 'Failed to load calendar events. Please try again.', [{ text: 'OK' }]);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Toggle event selection in sync preview
  const toggleEventSelection = (eventId: string) => {
    setSyncPreviewEvents(prev =>
      prev.map(event =>
        event.id === eventId ? { ...event, selected: !event.selected } : event
      )
    );
  };

  // Select/deselect all events
  const toggleAllEvents = (selected: boolean) => {
    setSyncPreviewEvents(prev =>
      prev.map(event => ({ ...event, selected: event.hasLocation ? selected : false }))
    );
  };

  // Confirm and sync selected events
  const confirmSyncEvents = async () => {
    if (!user) return;

    const selectedEvents = syncPreviewEvents.filter(e => e.selected);

    if (selectedEvents.length === 0) {
      Alert.alert('No Events Selected', 'Please select at least one event to sync.');
      return;
    }

    try {
      setIsSyncing(true);
      setShowSyncPreview(false);

      console.log(`📅 Syncing ${selectedEvents.length} selected events...`);

      const result = await syncSelectedEventsToDatabase(user.id, selectedEvents);

      if (result.success) {
        console.log(`✅ Synced ${result.eventsSynced} events`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        await loadEvents();
        await loadFreeTime();

        Alert.alert(
          'Calendar Synced',
          `Successfully synced ${result.eventsSynced} events from your device calendar.`,
          [{ text: 'OK' }]
        );
      } else if (result.errors.length > 0) {
        console.error('❌ Sync errors:', result.errors);
        Alert.alert(
          'Sync Completed with Errors',
          `Synced ${result.eventsSynced} events, but ${result.errors.length} failed.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Error syncing calendar:', error);
      Alert.alert('Sync Failed', 'Failed to sync calendar. Please try again.', [{ text: 'OK' }]);
    } finally {
      setIsSyncing(false);
    }
  };

  // Load upcoming free time slots
  const loadFreeTime = async () => {
    if (!user) return;

    try {
      console.log('🕐 Loading free time slots...');
      const freeSlots = await getUpcomingFreeTime(user.id, 7); // Next 7 days

      console.log(`✅ Found ${freeSlots.length} free time slots`);
      setFreeTimeSlots(freeSlots);
    } catch (error) {
      console.error('❌ Error loading free time:', error);
    }
  };

  const loadEvents = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // DEMO MODE: Skip database query for demo user
      if (user.id === 'demo-user-123') {
        setEvents([]);
        setLoading(false);
        return;
      }

      // CRITICAL FIX: Convert to Date objects first, then to ISO strings with timezone
      // This ensures we query for the correct 24-hour period in the user's local timezone
      const startOfDay = new Date(`${selectedDate}T00:00:00`);
      const endOfDay = new Date(`${selectedDate}T23:59:59`);

      console.log(`📅 Loading events for ${selectedDate}:`);
      console.log(`   Start (local): ${startOfDay.toLocaleString()}`);
      console.log(`   Start (UTC): ${startOfDay.toISOString()}`);
      console.log(`   End (local): ${endOfDay.toLocaleString()}`);
      console.log(`   End (UTC): ${endOfDay.toISOString()}`);

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;

      console.log(`✅ Found ${data?.length || 0} events for ${selectedDate}`);
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const onDayPress = (day: DateData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(day.dateString);
  };

  const openCreateModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCreateModal(false);
    // Reset form
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskCategory('personal');
    setNewTaskDate(new Date());
    setNewTaskTime(new Date());
    const defaultEndTime = new Date();
    defaultEndTime.setHours(defaultEndTime.getHours() + 1);
    setNewTaskEndTime(defaultEndTime);
    setNewTaskAddress('');
    setNewTaskLocation(null);
    setNewTaskPlaceName('');
  };

  const createEvent = async () => {
    if (!user) return;
    if (!newTaskTitle.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    if (!newTaskAddress.trim()) {
      Alert.alert('Error', 'Please enter a location');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Combine date and time for start
      const startDateTime = new Date(newTaskDate);
      startDateTime.setHours(newTaskTime.getHours());
      startDateTime.setMinutes(newTaskTime.getMinutes());

      // Combine date and time for end
      const endDateTime = new Date(newTaskDate);
      endDateTime.setHours(newTaskEndTime.getHours());
      endDateTime.setMinutes(newTaskEndTime.getMinutes());

      // Use selected location, or GPS, or user's home, or Dallas fallback
      let location = newTaskLocation;
      if (!location) {
        try {
          const gps = await getCurrentLocation();
          location = { latitude: gps.latitude, longitude: gps.longitude };
        } catch {
          // Fall back to user's home location or Dallas
          const homeCoords = user.home_location && (user.home_location as any).coordinates;
          location = homeCoords
            ? { latitude: homeCoords[1], longitude: homeCoords[0] }
            : { latitude: 32.7767, longitude: -96.797 };
        }
      }

      const { error } = await supabase.from('calendar_events').insert({
        user_id: user.id,
        title: newTaskTitle,
        description: newTaskDescription || null,
        category: newTaskCategory as any,
        location: `POINT(${location.longitude} ${location.latitude})`,
        address: newTaskAddress,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: 'scheduled' as const,
        source: 'manual' as const,
      } as any);

      if (error) throw error;

      Alert.alert('Success', 'Added to your Loop!');
      closeCreateModal();
      loadEvents();
    } catch (error: any) {
      const msg = error?.message || error?.details || JSON.stringify(error);
      console.error('Error creating event:', msg, error);
      Alert.alert('Error', `Failed to add to Loop: ${msg}`);
    }
  };

  const getCategoryColor = (category: string) => {
    const cat = CATEGORIES.find((c) => c.id === category);
    return cat?.color || BrandColors.loopBlue;
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find((c) => c.id === category);
    return cat?.icon || 'ellipsis-horizontal';
  };

  const handleMarkAsComplete = async (event: CalendarEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Mark event as completed in database
    const result = await markEventAsCompleted(event.id);

    if (result.success) {
      // Trigger feedback modal
      setFeedbackActivity({
        eventId: event.id,
        activityId: null, // Will be null for manually created tasks
        activityName: event.title,
        activityCategory: event.category,
        completedAt: new Date().toISOString(),
        recommendationId: null,
      });
      setShowFeedbackModal(true);

      // Reload events to show updated status
      loadEvents();
    } else {
      Alert.alert('Error', 'Failed to mark activity as complete');
    }
  };

  const handleCloseFeedbackModal = () => {
    setShowFeedbackModal(false);
    setFeedbackActivity(null);

    // Reload events list to reflect the completed status
    loadEvents();

    // NOTE: We no longer auto-check for more pending feedback.
    // Each task should be rated individually when the user taps "Rate Activity".
  };

  const handleEventPress = (event: CalendarEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingEvent(event);
    setShowEditModal(true);
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const { error } = await supabase
        .from('calendar_events')
        .update({
          title: editingEvent.title,
          description: editingEvent.description || null,
          category: editingEvent.category as any,
          location: `POINT(${editingEvent.location.longitude} ${editingEvent.location.latitude})`,
          address: editingEvent.address,
          start_time: editingEvent.start_time,
          end_time: editingEvent.end_time,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', editingEvent.id);

      if (error) throw error;

      Alert.alert('Success', 'Updated successfully!');
      setShowEditModal(false);
      setEditingEvent(null);
      loadEvents();
    } catch (error) {
      console.error('Error updating event:', error);
      Alert.alert('Error', 'Failed to update');
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;

    Alert.alert(
      'Remove from Loop',
      'Are you sure you want to remove this from your Loop?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            try {
              const { error } = await supabase
                .from('calendar_events')
                .delete()
                .eq('id', editingEvent.id);

              if (error) throw error;

              Alert.alert('Success', 'Removed from your Loop');
              setShowEditModal(false);
              setEditingEvent(null);
              loadEvents();
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Failed to remove');
            }
          },
        },
      ]
    );
  };

  const handleSwipeDelete = async (eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Remove from Loop',
      'Are you sure you want to remove this from your Loop?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            try {
              const { error } = await supabase
                .from('calendar_events')
                .delete()
                .eq('id', eventId);

              if (error) throw error;

              loadEvents();
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Failed to remove');
            }
          },
        },
      ]
    );
  };

  const renderRightActions = (eventId: string) => {
    return (
      <TouchableOpacity
        style={styles.deleteSwipeAction}
        onPress={() => handleSwipeDelete(eventId)}
      >
        <Ionicons name="trash-outline" size={24} color="#ffffff" />
        <Text style={styles.deleteSwipeText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  // Mark dates with events
  const markedDates = {
    [selectedDate]: {
      selected: true,
      selectedColor: BrandColors.loopBlue,
    },
  };

  const toggleViewMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewMode(viewMode === 'list' ? 'loop' : 'list');
  };

  // Memoize tasks for LoopMapView to prevent unnecessary re-renders
  const loopMapTasks = useMemo(() => {
    return events
      .map(event => {
        // Parse location from various PostGIS formats
        let lat: number | undefined;
        let lng: number | undefined;

        const loc = event.location;

        if (!loc) {
          console.warn(`⚠️ No location data for event: ${event.title}`);
          return null;
        }

        // Format 1: Object with latitude/longitude
        if (typeof loc === 'object' && loc !== null && 'latitude' in loc && 'longitude' in loc) {
          lat = (loc as any).latitude;
          lng = (loc as any).longitude;
        }
        // Format 2: PostGIS GeoJSON { coordinates: [lng, lat] }
        else if (typeof loc === 'object' && loc !== null && 'coordinates' in loc) {
          const coords = (loc as any).coordinates;
          if (Array.isArray(coords) && coords.length === 2) {
            lng = coords[0];
            lat = coords[1];
          }
        }
        // Format 3: WKT string "POINT(lng lat)"
        else if (typeof loc === 'string') {
          const locStr = loc as string;
          const match = locStr.match(/POINT\(([^ ]+) ([^ ]+)\)/);
          if (match) {
            lng = parseFloat(match[1]);
            lat = parseFloat(match[2]);
          } else {
            // Format 4: Hex-encoded WKB/EWKB from PostGIS
            const parsed = parseWKBHexPoint(locStr);
            if (parsed) {
              lat = parsed.latitude;
              lng = parsed.longitude;
            }
          }
        }

        // Validate parsed coordinates
        if (typeof lat !== 'number' || typeof lng !== 'number' ||
            isNaN(lat) || isNaN(lng) ||
            lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          console.warn(`⚠️ Invalid coordinates for event: ${event.title}`, { lat, lng });
          return null;
        }

        return {
          id: event.id,
          title: event.title,
          latitude: lat,
          longitude: lng,
          address: event.address,
          start_time: event.start_time,
          category: event.category,
        };
      })
      .filter((task): task is NonNullable<typeof task> => task !== null);
  }, [events]);

  // Memoize home location parsing for LoopMapView
  const parsedHomeLocation = useMemo(() => {
    if (!user?.home_location) return undefined;

    const loc = user.home_location as any;
    // Handle PostGIS object format: { coordinates: [lng, lat] }
    if (loc && typeof loc === 'object' && 'coordinates' in loc) {
      return {
        latitude: loc.coordinates[1],
        longitude: loc.coordinates[0],
      };
    }
    // Handle PostGIS string format: "POINT(lng lat)" or hex WKB
    if (typeof loc === 'string') {
      const match = loc.match(/POINT\(([^ ]+) ([^ ]+)\)/);
      if (match) {
        return {
          latitude: parseFloat(match[2]),
          longitude: parseFloat(match[1]),
        };
      }
      // Try hex-encoded WKB/EWKB
      const parsed = parseWKBHexPoint(loc);
      if (parsed) return parsed;
    }
    return undefined;
  }, [user?.home_location]);

  // Free time slots for the currently selected day
  const selectedDayFreeSlots = useMemo(() => {
    if (freeTimeSlots.length === 0) return [];
    const dayStart = new Date(`${selectedDate}T00:00:00`);
    const dayEnd = new Date(`${selectedDate}T23:59:59`);
    return freeTimeSlots.filter((slot) => {
      const slotStart = new Date(slot.start);
      return slotStart >= dayStart && slotStart <= dayEnd;
    });
  }, [freeTimeSlots, selectedDate]);

  // Total free time for the selected day (in minutes)
  const dailyFreeMinutes = useMemo(() => {
    return selectedDayFreeSlots.reduce((sum, slot) => sum + slot.durationMinutes, 0);
  }, [selectedDayFreeSlots]);

  // Build merged timeline: events + free time slots sorted by start time
  const mergedTimeline = useMemo(() => {
    type TimelineItem =
      | { type: 'event'; data: CalendarEvent }
      | { type: 'free'; data: { start: Date; end: Date; durationMinutes: number } };

    const items: TimelineItem[] = [];
    events.forEach((e) => items.push({ type: 'event', data: e }));
    selectedDayFreeSlots.forEach((slot) => items.push({ type: 'free', data: slot }));

    items.sort((a, b) => {
      const aTime = a.type === 'event'
        ? new Date(a.data.start_time).getTime()
        : (a.data as { start: Date }).start.getTime();
      const bTime = b.type === 'event'
        ? new Date(b.data.start_time).getTime()
        : (b.data as { start: Date }).start.getTime();
      return aTime - bTime;
    });

    return items;
  }, [events, selectedDayFreeSlots]);

  // Calendar sync onboarding prompt state
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);

  useEffect(() => {
    const checkSyncPrompt = async () => {
      if (!user || user.id === 'demo-user-123') return;
      const dismissed = await AsyncStorage.getItem('loop_sync_prompt_dismissed');
      if (dismissed) return;
      // Check if user has any synced calendar events
      const { count } = await supabase
        .from('calendar_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('source', ['google_calendar', 'apple_calendar']);
      if ((count ?? 0) === 0) {
        setShowSyncPrompt(true);
      }
    };
    checkSyncPrompt();
  }, [user]);

  const dismissSyncPrompt = async () => {
    setShowSyncPrompt(false);
    await AsyncStorage.setItem('loop_sync_prompt_dismissed', 'true');
  };

  return (
    <SwipeableLayout>
      <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        {/* Header - Tap Loop icon/title to toggle map, menu button for options */}
        <CalendarHeader
          title="Loop"
          showLoopIcon={true}
          onAddPress={openCreateModal}
          onMenuPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowMenuDrawer(true);
          }}
          onTitlePress={toggleViewMode}
        />

      {viewMode === 'list' ? (
        <>
          {/* Calendar */}
          <Calendar
            key={colorScheme}
            current={selectedDate}
            onDayPress={onDayPress}
            markedDates={markedDates}
            theme={{
              calendarBackground: Colors[colorScheme ?? 'light'].background,
              textSectionTitleColor: isDark ? BrandColors.veryLightGray : BrandColors.lightGray,
              selectedDayBackgroundColor: BrandColors.loopBlue,
              selectedDayTextColor: BrandColors.white,
              todayTextColor: BrandColors.loopBlue,
              dayTextColor: Colors[colorScheme ?? 'light'].text,
              textDisabledColor: isDark ? BrandColors.lightGray : '#d9e1e8',
              monthTextColor: Colors[colorScheme ?? 'light'].text,
              arrowColor: Colors[colorScheme ?? 'light'].text,
              textMonthFontSize: 18,
              textMonthFontWeight: '600',
            }}
            style={[styles.calendar, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
          />

          {/* Events List */}
          <ScrollView
            style={styles.eventsContainer}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
        <View style={styles.eventsHeader}>
          <Text style={[Typography.titleLarge, { color: Colors[colorScheme ?? 'light'].text }]}>
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          {events.length > 0 && (
            <Text style={[Typography.bodyMedium, { color: Colors[colorScheme ?? 'light'].icon }]}>
              {events.length} {events.length === 1 ? 'activity' : 'activities'}
            </Text>
          )}
        </View>

        {/* Free time summary banner */}
        {dailyFreeMinutes > 0 && !loading && (
          <View style={[styles.freeTimeBanner, { backgroundColor: `${BrandColors.loopGreen}12` }]}>
            <Ionicons name="time-outline" size={16} color={BrandColors.loopGreen} />
            <Text style={[Typography.bodySmall, { color: BrandColors.loopGreen, marginLeft: 6 }]}>
              {dailyFreeMinutes >= 60
                ? `${Math.floor(dailyFreeMinutes / 60)}h ${dailyFreeMinutes % 60 > 0 ? `${dailyFreeMinutes % 60}m` : ''}`
                : `${dailyFreeMinutes}m`}{' '}
              of free time today
            </Text>
          </View>
        )}

        {/* Calendar sync onboarding prompt */}
        {showSyncPrompt && !loading && (
          <View style={[styles.syncPromptCard, { backgroundColor: isDark ? '#1a2332' : '#EFF6FF', borderColor: BrandColors.loopBlue + '30' }]}>
            <View style={styles.syncPromptContent}>
              <View style={[styles.syncPromptIcon, { backgroundColor: BrandColors.loopBlue + '1A' }]}>
                <Ionicons name="calendar" size={24} color={BrandColors.loopBlue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.titleMedium, { color: colors.text }]}>
                  Connect your calendar
                </Text>
                <Text style={[Typography.bodySmall, { color: colors.icon, marginTop: 2 }]}>
                  Import events to find free time for activities
                </Text>
              </View>
            </View>
            <View style={styles.syncPromptActions}>
              <TouchableOpacity
                style={[styles.syncPromptButton, { backgroundColor: BrandColors.loopBlue }]}
                onPress={() => {
                  dismissSyncPrompt();
                  handleSyncCalendar();
                }}
              >
                <Ionicons name="link-outline" size={16} color="#ffffff" />
                <Text style={[Typography.labelMedium, { color: '#ffffff', marginLeft: 6 }]}>Connect</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={dismissSyncPrompt}
                style={styles.syncPromptDismiss}
              >
                <Text style={[Typography.labelMedium, { color: colors.icon }]}>Not now</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {loading ? (
          // Show skeleton loaders while loading
          <>
            <CalendarEventSkeleton />
            <CalendarEventSkeleton />
            <CalendarEventSkeleton />
          </>
        ) : mergedTimeline.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={Colors[colorScheme ?? 'light'].icon} />
            <Text style={[Typography.bodyLarge, styles.emptyText, { color: Colors[colorScheme ?? 'light'].icon }]}>
              No activities scheduled
            </Text>
            <Text style={[Typography.bodyMedium, { color: Colors[colorScheme ?? 'light'].icon, textAlign: 'center', marginBottom: Spacing.lg }]}>
              Add something to your day
            </Text>
            <TouchableOpacity
              style={styles.createTaskButton}
              onPress={openCreateModal}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors[colorScheme ?? 'light'].text} />
              <Text style={[styles.createTaskButtonText, { color: Colors[colorScheme ?? 'light'].text }]}>
                Add to Loop
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            {mergedTimeline.map((item, idx) => {
              if (item.type === 'free') {
                const slot = item.data as { start: Date; end: Date; durationMinutes: number };
                const startStr = new Date(slot.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                const endStr = new Date(slot.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                const durationLabel = slot.durationMinutes >= 60
                  ? `${Math.floor(slot.durationMinutes / 60)}h ${slot.durationMinutes % 60 > 0 ? `${slot.durationMinutes % 60}m` : ''}`
                  : `${slot.durationMinutes}m`;

                return (
                  <View
                    key={`free-${idx}`}
                    style={[styles.freeTimeCard, { borderColor: BrandColors.loopGreen + '40' }]}
                  >
                    <View style={styles.freeTimeCardContent}>
                      <View style={[styles.freeTimeIconContainer, { backgroundColor: BrandColors.loopGreen + '1A' }]}>
                        <Ionicons name="sunny-outline" size={20} color={BrandColors.loopGreen} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.labelMedium, { color: BrandColors.loopGreen }]}>
                          {durationLabel} free
                        </Text>
                        <Text style={[Typography.bodySmall, { color: colors.icon }]}>
                          {startStr} - {endStr}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.freeTimeSuggestButton, { backgroundColor: BrandColors.loopGreen + '1A' }]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.push('/(tabs)');
                        }}
                      >
                        <Text style={[Typography.labelSmall, { color: BrandColors.loopGreen }]}>Get suggestions</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              const event = item.data as CalendarEvent;
              return (
              <Swipeable
                key={event.id}
                renderRightActions={() => renderRightActions(event.id)}
                overshootRight={false}
              >
                <TouchableOpacity
                  style={[
                    styles.eventCard,
                    {
                      backgroundColor: colors.card,
                      borderLeftColor: getCategoryColor(event.category),
                    },
                  ]}
                  onPress={() => handleEventPress(event)}
                  activeOpacity={0.7}
                >
              <View style={styles.eventHeader}>
                <View style={[styles.eventIconContainer, { backgroundColor: getCategoryColor(event.category) + '1A' }]}>
                  <Ionicons
                    name={getCategoryIcon(event.category) as any}
                    size={24}
                    color={getCategoryColor(event.category)}
                  />
                </View>
                <View style={styles.eventContent}>
                  <Text style={[Typography.titleMedium, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {event.title}
                  </Text>
                  <Text style={[Typography.bodyMedium, { color: Colors[colorScheme ?? 'light'].icon }]}>
                    {new Date(event.start_time).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                  {event.address && (
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={16} color={Colors[colorScheme ?? 'light'].icon} />
                      <Text style={[Typography.bodySmall, { color: Colors[colorScheme ?? 'light'].icon }]}>
                        {event.address}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Mark as Complete button - only show if event has ended and not already completed */}
              {event.status === 'scheduled' &&
                new Date(event.end_time) < new Date() && (
                  <TouchableOpacity
                    style={[styles.completeButton, { borderColor: Colors[colorScheme ?? 'light'].border }]}
                    onPress={() => handleMarkAsComplete(event)}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={20}
                      color={BrandColors.loopBlue}
                    />
                    <Text
                      style={[
                        Typography.labelMedium,
                        { color: BrandColors.loopBlue, marginLeft: 6 },
                      ]}
                    >
                      Rate Activity
                    </Text>
                  </TouchableOpacity>
                )}

              {/* Status badge for completed events */}
              {event.status === 'completed' && (
                <View style={[styles.statusBadge, { backgroundColor: BrandColors.success }]}>
                  <Ionicons name="checkmark-circle" size={16} color={BrandColors.white} />
                  <Text style={[Typography.labelSmall, { color: BrandColors.white, marginLeft: 4 }]}>
                    Completed
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Swipeable>
              );
            })}
          </Animated.View>
        )}

        {/* Loop View Button - Show when there are events */}
        {events.length > 0 && (
          <TouchableOpacity
            style={[styles.loopViewButton, { backgroundColor: BrandColors.loopBlue }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              toggleViewMode();
            }}
          >
            <Ionicons name="map" size={20} color="#ffffff" />
            <Text style={[Typography.labelLarge, { color: '#ffffff', marginLeft: Spacing.sm }]}>
              View Loop Map
            </Text>
          </TouchableOpacity>
        )}
          </ScrollView>
        </>
      ) : (
        /* Loop View (Map) */
        <View style={styles.loopViewContainer}>
          {/* Date Header for Loop View */}
          <View style={styles.loopDateHeader}>
            <Ionicons name="calendar" size={20} color={BrandColors.loopBlue} />
            <Text style={[Typography.titleMedium, { color: Colors[colorScheme ?? 'light'].text, marginLeft: 8 }]}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>

          {/* Map View */}
          <LoopMapView
            tasks={loopMapTasks}
            homeLocation={parsedHomeLocation}
            currentLocation={currentUserLocation || undefined}
            onViewFeed={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode('list'); // Switch back to list view first
              router.push('/(tabs)'); // Navigate to recommendation feed (index)
            }}
            onTaskPress={async (taskId) => {
              const task = events.find(e => e.id === taskId);
              if (task) {
                // Set the task for details modal
                setSelectedTaskForDetails(task);
                setSelectedTaskVenueDetails(null); // Reset venue details

                // If task has an activity_id, fetch venue details
                if (task.activity_id) {
                  try {
                    const { data: activity } = await supabase
                      .from('activities')
                      .select('rating, reviews_count, website, phone, photos')
                      .eq('id', task.activity_id)
                      .single();

                    if (activity) {
                      setSelectedTaskVenueDetails({
                        rating: activity.rating,
                        reviewsCount: activity.reviews_count,
                        website: activity.website,
                        phone: activity.phone,
                        photos: activity.photos,
                      });
                    }
                  } catch (error) {
                    console.error('Error fetching venue details:', error);
                  }
                }

                // Show the task details modal
                setShowTaskDetailsModal(true);
              }
            }}
          />
        </View>
      )}

      {/* Create Task Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent={true}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1, justifyContent: 'flex-end' }}
            >
              <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                <View style={styles.modalHeader}>
                  <Text style={[Typography.headlineMedium, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Add to Loop
                  </Text>
                  <TouchableOpacity onPress={closeCreateModal}>
                    <Ionicons name="close" size={28} color={Colors[colorScheme ?? 'light'].icon} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
              {/* Title */}
              <Text style={[Typography.labelLarge, styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Title *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  Typography.bodyLarge,
                  {
                    backgroundColor: isDark ? BrandColors.mediumGray : BrandColors.lightBackground,
                    color: Colors[colorScheme ?? 'light'].text,
                  },
                ]}
                value={newTaskTitle}
                onChangeText={setNewTaskTitle}
                placeholder="What are you planning?"
                placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
              />

              {/* Description */}
              <Text style={[Typography.labelLarge, styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Description
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  Typography.bodyLarge,
                  {
                    backgroundColor: isDark ? BrandColors.mediumGray : BrandColors.lightBackground,
                    color: Colors[colorScheme ?? 'light'].text,
                  },
                ]}
                value={newTaskDescription}
                onChangeText={setNewTaskDescription}
                placeholder="Add details (optional)"
                placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
                multiline
                numberOfLines={3}
              />

              {/* Date */}
              <Text style={[Typography.labelLarge, styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Date
              </Text>
              <TouchableOpacity
                style={[
                  styles.dateTimeButton,
                  { backgroundColor: isDark ? BrandColors.mediumGray : BrandColors.lightBackground },
                ]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={BrandColors.loopBlue} />
                <Text style={[Typography.bodyLarge, { color: Colors[colorScheme ?? 'light'].text, marginLeft: Spacing.sm }]}>
                  {newTaskDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={newTaskDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) setNewTaskDate(date);
                  }}
                />
              )}

              {/* Time */}
              <Text style={[Typography.labelLarge, styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Time
              </Text>
              <TouchableOpacity
                style={[
                  styles.dateTimeButton,
                  { backgroundColor: isDark ? BrandColors.mediumGray : BrandColors.lightBackground },
                ]}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={BrandColors.loopBlue} />
                <Text style={[Typography.bodyLarge, { color: Colors[colorScheme ?? 'light'].text, marginLeft: Spacing.sm }]}>
                  {newTaskTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={newTaskTime}
                  mode="time"
                  display="default"
                  onChange={(event, date) => {
                    setShowTimePicker(Platform.OS === 'ios');
                    if (date) setNewTaskTime(date);
                  }}
                />
              )}

              {/* End Time */}
              <Text style={[Typography.labelLarge, styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                End Time
              </Text>
              <TouchableOpacity
                style={[styles.dateTimeButton, { backgroundColor: isDark ? BrandColors.mediumGray : BrandColors.lightBackground }]}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={BrandColors.loopBlue} />
                <Text style={[Typography.bodyLarge, { color: Colors[colorScheme ?? 'light'].text, marginLeft: Spacing.sm }]}>
                  {newTaskEndTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
              {showEndTimePicker && (
                <DateTimePicker
                  value={newTaskEndTime}
                  mode="time"
                  display="default"
                  onChange={(event, selectedTime) => {
                    setShowEndTimePicker(false);
                    if (selectedTime) {
                      setNewTaskEndTime(selectedTime);
                    }
                  }}
                />
              )}

              {/* Location */}
              <Text style={[Typography.labelLarge, styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Location *
              </Text>
              {/* Show autocomplete input ONLY when no location is selected */}
              {!newTaskLocation && (
                <LocationAutocomplete
                  value={newTaskAddress}
                  onChangeText={setNewTaskAddress}
                  onSelectLocation={(location) => {
                    setNewTaskAddress(location.address); // Keep for DB insert
                    setNewTaskPlaceName(location.placeName);
                    setNewTaskLocation({
                      latitude: location.latitude,
                      longitude: location.longitude,
                    });

                    // Auto-select category based on place types
                    if (location.types && location.types.length > 0) {
                      const suggestedCategory = getCategoryFromPlaceTypes(location.types);
                      setNewTaskCategory(suggestedCategory);
                      console.log(`📍 Auto-selected category: ${suggestedCategory} (from types: ${location.types.join(', ')})`);
                    }
                  }}
                  placeholder="Search for a location"
                  isDark={isDark}
                  userLocation={currentUserLocation || undefined}
                />
              )}

              {/* Selected Location Display */}
              {newTaskLocation && newTaskPlaceName && (
                <View style={styles.selectedLocationContainer}>
                  <View style={styles.selectedLocationPin}>
                    <Ionicons name="location" size={20} color="#ffffff" />
                  </View>
                  <View style={styles.selectedLocationText}>
                    <Text style={[Typography.labelLarge, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {newTaskPlaceName}
                    </Text>
                    <Text style={[Typography.bodySmall, { color: Colors[colorScheme ?? 'light'].icon }]} numberOfLines={1}>
                      {newTaskAddress}
                    </Text>
                  </View>
                  {/* Change location button */}
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setNewTaskLocation(null);
                      setNewTaskPlaceName('');
                      setNewTaskAddress('');
                    }}
                    style={styles.changeLocationButton}
                  >
                    <Ionicons name="close-circle" size={24} color={Colors[colorScheme ?? 'light'].icon} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Map Preview - Temporarily disabled for web compatibility */}
              {/* TODO: Re-enable with separate MapPreview component */}
              {/* {newTaskLocation && Platform.OS !== 'web' && MapView && (
                <View style={styles.mapPreview}>
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                      latitude: newTaskLocation.latitude,
                      longitude: newTaskLocation.longitude,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    }}
                    scrollEnabled={true}
                    zoomEnabled={true}
                    pitchEnabled={false}
                    rotateEnabled={true}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                  >
                    <Marker
                      coordinate={{
                        latitude: newTaskLocation.latitude,
                        longitude: newTaskLocation.longitude,
                      }}
                      pinColor={BrandColors.loopBlue}
                    />
                  </MapView>
                  <View style={styles.mapHint}>
                    <Ionicons name="information-circle" size={14} color={Colors[colorScheme ?? 'light'].icon} />
                    <Text style={[Typography.bodySmall, { color: Colors[colorScheme ?? 'light'].icon, marginLeft: 4 }]}>
                      Pinch to zoom • Drag to explore
                    </Text>
                  </View>
                </View>
              )} */}
              {newTaskLocation && (
                <View style={styles.mapPreview}>
                  <View style={[styles.map, { backgroundColor: Colors[colorScheme ?? 'light'].card, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="map-outline" size={48} color={BrandColors.loopBlue} />
                    <Text style={[Typography.bodyMedium, { color: Colors[colorScheme ?? 'light'].text, marginTop: 8 }]}>
                      {Platform.OS === 'web' ? 'Map preview available on mobile' : 'Map preview temporarily unavailable'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Category */}
              <Text style={[Typography.labelLarge, styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Category
              </Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryButton,
                      {
                        backgroundColor: newTaskCategory === cat.id ? cat.color : (isDark ? BrandColors.mediumGray : BrandColors.lightBackground),
                        borderColor: newTaskCategory === cat.id ? cat.color : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setNewTaskCategory(cat.id);
                    }}
                  >
                    <View style={styles.categoryButtonContent}>
                      <Ionicons
                        name={cat.icon as any}
                        size={24}
                        color={newTaskCategory === cat.id ? '#ffffff' : Colors[colorScheme ?? 'light'].text}
                      />
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[
                          {
                            color: newTaskCategory === cat.id ? '#ffffff' : Colors[colorScheme ?? 'light'].text,
                            marginTop: 2,
                            fontSize: 10,
                            lineHeight: 12,
                            textAlign: 'center',
                            fontWeight: '500',
                          },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Create Button */}
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: BrandColors.loopBlue }]}
                onPress={createEvent}
              >
                <Text style={[Typography.labelLarge, { color: '#ffffff' }]}>Add to Loop</Text>
              </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Edit Task Modal */}
      {editingEvent && (
        <Modal visible={showEditModal} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1, justifyContent: 'flex-end' }}
            >
              <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                <View style={styles.modalHeader}>
                  <Text style={[Typography.headlineMedium, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Edit
                  </Text>
                  <TouchableOpacity onPress={() => setShowEditModal(false)}>
                    <Ionicons name="close" size={28} color={Colors[colorScheme ?? 'light'].icon} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.formContainer}
                  contentContainerStyle={{ paddingBottom: Spacing.xl }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                >
                    {/* Title */}
                    <Text style={[Typography.labelLarge, styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Title *
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        Typography.bodyLarge,
                        {
                          backgroundColor: isDark ? BrandColors.mediumGray : BrandColors.lightBackground,
                          color: Colors[colorScheme ?? 'light'].text,
                        },
                      ]}
                      value={editingEvent.title}
                      onChangeText={(text) => setEditingEvent({ ...editingEvent, title: text })}
                      placeholder="What are you planning?"
                      placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
                    />

                    {/* Description */}
                    <Text style={[Typography.labelLarge, styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Description
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        styles.textArea,
                        Typography.bodyLarge,
                        {
                          backgroundColor: isDark ? BrandColors.mediumGray : BrandColors.lightBackground,
                          color: Colors[colorScheme ?? 'light'].text,
                        },
                      ]}
                      value={editingEvent.description || ''}
                      onChangeText={(text) => setEditingEvent({ ...editingEvent, description: text })}
                      placeholder="Add details (optional)"
                      placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
                      multiline
                      numberOfLines={3}
                    />

                    {/* Category */}
                    <Text style={[Typography.labelLarge, styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Category
                    </Text>
                    <View style={styles.categoryGrid}>
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.categoryButton,
                            {
                              backgroundColor: editingEvent.category === cat.id ? cat.color : (isDark ? BrandColors.mediumGray : BrandColors.lightBackground),
                            },
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setEditingEvent({ ...editingEvent, category: cat.id });
                          }}
                        >
                          <Ionicons
                            name={cat.icon as any}
                            size={20}
                            color={editingEvent.category === cat.id ? '#ffffff' : Colors[colorScheme ?? 'light'].icon}
                          />
                          <Text
                            style={[
                              Typography.labelSmall,
                              {
                                color: editingEvent.category === cat.id ? '#ffffff' : Colors[colorScheme ?? 'light'].text,
                                marginTop: 4,
                              },
                            ]}
                          >
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Time Display (read-only for now) */}
                    <Text style={[Typography.labelLarge, styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Time
                    </Text>
                    <View style={[styles.readOnlyField, { backgroundColor: isDark ? BrandColors.mediumGray : BrandColors.lightBackground }]}>
                      <Ionicons name="time-outline" size={20} color={BrandColors.loopBlue} />
                      <Text style={[Typography.bodyLarge, { color: Colors[colorScheme ?? 'light'].text, marginLeft: Spacing.sm }]}>
                        {new Date(editingEvent.start_time).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>

                    {/* Location */}
                    <Text style={[Typography.labelLarge, styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Location *
                    </Text>

                    {/* Location selector - similar to create modal */}
                    <LocationAutocomplete
                      value={editingEvent.address}
                      onChangeText={(text) => setEditingEvent({ ...editingEvent, address: text })}
                      onSelectLocation={(location) => {
                        setEditingEvent({
                          ...editingEvent,
                          address: location.address,
                          location: {
                            latitude: location.latitude,
                            longitude: location.longitude,
                          },
                        });

                        // Auto-update category based on place types
                        if (location.types && location.types.length > 0) {
                          const suggestedCategory = getCategoryFromPlaceTypes(location.types);
                          setEditingEvent(prev => prev ? { ...prev, category: suggestedCategory } : prev);
                        }
                      }}
                      placeholder="Search for a location"
                      isDark={isDark}
                      userLocation={currentUserLocation || undefined}
                    />

                    {/* View on Map Button */}
                    <TouchableOpacity
                      style={[styles.viewMapButton, { backgroundColor: `${BrandColors.loopBlue}1A`, borderColor: BrandColors.loopBlue }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setShowEditModal(false);
                        setViewMode('loop'); // Switch to map view
                      }}
                    >
                      <Ionicons name="map" size={20} color={BrandColors.loopBlue} />
                      <Text style={[Typography.labelLarge, { color: BrandColors.loopBlue, marginLeft: 8 }]}>
                        View on Loop Map
                      </Text>
                    </TouchableOpacity>

                    {/* Action Buttons */}
                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={[styles.deleteButton, { borderColor: BrandColors.error }]}
                        onPress={handleDeleteEvent}
                      >
                        <Ionicons name="trash-outline" size={20} color={BrandColors.error} />
                        <Text style={[Typography.labelLarge, { color: '#ef4444', marginLeft: 8 }]}>
                          Delete
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: BrandColors.loopBlue }]}
                        onPress={handleUpdateEvent}
                      >
                        <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                        <Text style={[Typography.labelLarge, { color: '#ffffff', marginLeft: 8 }]}>
                          Save
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </View>
        </Modal>
      )}

      {/* Feedback Modal */}
      {feedbackActivity && (
        <FeedbackModal
          visible={showFeedbackModal}
          onClose={handleCloseFeedbackModal}
          eventId={feedbackActivity.eventId} // Calendar event ID to mark as completed
          activityId={feedbackActivity.activityId || null} // Null for manual calendar events
          activityName={feedbackActivity.activityName}
          activityCategory={feedbackActivity.activityCategory}
          userId={user?.id || ''}
          recommendationId={feedbackActivity.recommendationId || undefined}
        />
      )}

      {/* Task Details Modal (from loop map "View Details") */}
      <TaskDetailsModal
        visible={showTaskDetailsModal}
        task={selectedTaskForDetails}
        venueDetails={selectedTaskVenueDetails}
        onClose={() => {
          setShowTaskDetailsModal(false);
          setSelectedTaskForDetails(null);
          setSelectedTaskVenueDetails(null);
        }}
        onEdit={() => {
          // Close details modal and open edit modal
          setShowTaskDetailsModal(false);
          if (selectedTaskForDetails) {
            setEditingEvent(selectedTaskForDetails);
            setShowEditModal(true);
          }
        }}
        onMarkComplete={() => {
          if (selectedTaskForDetails) {
            handleMarkAsComplete(selectedTaskForDetails);
          }
        }}
        onDelete={() => {
          if (selectedTaskForDetails) {
            // Use the existing delete logic
            handleSwipeDelete(selectedTaskForDetails.id);
          }
        }}
      />

      {/* Menu Drawer Modal */}
      <Modal
        visible={showMenuDrawer}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowMenuDrawer(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenuDrawer(false)}
        >
          <View
            style={[
              styles.menuDrawer,
              { backgroundColor: colors.card },
            ]}
          >
            {/* Menu Header */}
            <View style={styles.menuHeader}>
              <View style={styles.menuLoopIcon}>
                <View style={[styles.menuLoopCircle, styles.menuLoopCircleBlue]} />
                <View style={[styles.menuLoopCircle, styles.menuLoopCircleGreen]} />
              </View>
              <Text style={[Typography.titleMedium, { color: Colors[colorScheme ?? 'light'].text }]}>
                Loop Menu
              </Text>
            </View>

            {/* Menu Items */}
            <View style={styles.menuItems}>
              {/* View Toggle */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenuDrawer(false);
                  toggleViewMode();
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: `${BrandColors.loopBlue}15` }]}>
                  <Ionicons
                    name={viewMode === 'list' ? 'map' : 'list'}
                    size={22}
                    color={BrandColors.loopBlue}
                  />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={[Typography.labelLarge, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {viewMode === 'list' ? 'View Loop Map' : 'View Calendar List'}
                  </Text>
                  <Text style={[Typography.bodySmall, { color: Colors[colorScheme ?? 'light'].icon }]}>
                    {viewMode === 'list' ? 'See your day as a connected route' : 'See your Loop as a list'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>

              {/* Sync Calendar */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenuDrawer(false);
                  handleSyncCalendar();
                }}
                disabled={isSyncing || isLoadingPreview}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: `${BrandColors.loopGreen}15` }]}>
                  <Ionicons
                    name={isLoadingPreview ? 'hourglass' : isSyncing ? 'sync' : 'calendar'}
                    size={22}
                    color={BrandColors.loopGreen}
                  />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={[Typography.labelLarge, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {isLoadingPreview ? 'Loading...' : isSyncing ? 'Syncing...' : 'Sync Device Calendar'}
                  </Text>
                  <Text style={[Typography.bodySmall, { color: Colors[colorScheme ?? 'light'].icon }]}>
                    Select events to import from your phone
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>

              {/* Free Time (if we have slots) */}
              {freeTimeSlots.length > 0 && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenuDrawer(false);
                    setShowFreeTime(!showFreeTime);
                  }}
                >
                  <View style={[styles.menuItemIcon, { backgroundColor: `${BrandColors.loopOrange}15` }]}>
                    <Ionicons name="time" size={22} color={BrandColors.loopOrange} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={[Typography.labelLarge, { color: Colors[colorScheme ?? 'light'].text }]}>
                      View Free Time
                    </Text>
                    <Text style={[Typography.bodySmall, { color: Colors[colorScheme ?? 'light'].icon }]}>
                      {freeTimeSlots.length} free slots this week
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme ?? 'light'].icon} />
                </TouchableOpacity>
              )}
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.menuCloseButton}
              onPress={() => setShowMenuDrawer(false)}
            >
              <Text style={[Typography.labelLarge, { color: Colors[colorScheme ?? 'light'].icon }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sync Preview Modal - Select events to import */}
      <Modal
        visible={showSyncPreview}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSyncPreview(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.syncPreviewModal, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={styles.syncPreviewHeader}>
              <View>
                <Text style={[Typography.titleLarge, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Select Events to Import
                </Text>
                <Text style={[Typography.bodySmall, { color: Colors[colorScheme ?? 'light'].icon, marginTop: 4 }]}>
                  {syncPreviewEvents.filter(e => e.selected).length} of {syncPreviewEvents.filter(e => e.hasLocation).length} events selected
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowSyncPreview(false)}>
                <Ionicons name="close" size={28} color={Colors[colorScheme ?? 'light'].icon} />
              </TouchableOpacity>
            </View>

            {/* Select All / Deselect All */}
            <View style={styles.syncPreviewActions}>
              <TouchableOpacity
                style={[styles.syncSelectButton, { backgroundColor: `${BrandColors.loopBlue}15` }]}
                onPress={() => toggleAllEvents(true)}
              >
                <Ionicons name="checkmark-circle" size={18} color={BrandColors.loopBlue} />
                <Text style={[Typography.labelMedium, { color: BrandColors.loopBlue, marginLeft: 4 }]}>
                  Select All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.syncSelectButton, { backgroundColor: isDark ? BrandColors.mediumGray : BrandColors.lightBackground }]}
                onPress={() => toggleAllEvents(false)}
              >
                <Ionicons name="close-circle" size={18} color={Colors[colorScheme ?? 'light'].icon} />
                <Text style={[Typography.labelMedium, { color: Colors[colorScheme ?? 'light'].icon, marginLeft: 4 }]}>
                  Deselect All
                </Text>
              </TouchableOpacity>
            </View>

            {/* Events List */}
            <ScrollView style={styles.syncPreviewList}>
              {syncPreviewEvents.length === 0 ? (
                <View style={styles.syncEmptyState}>
                  <Ionicons name="calendar-outline" size={48} color={Colors[colorScheme ?? 'light'].icon} />
                  <Text style={[Typography.bodyLarge, { color: Colors[colorScheme ?? 'light'].icon, marginTop: Spacing.md, textAlign: 'center' }]}>
                    No upcoming events found in your device calendar
                  </Text>
                </View>
              ) : (
                syncPreviewEvents.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    style={[
                      styles.syncEventItem,
                      { backgroundColor: isDark ? BrandColors.mediumGray : BrandColors.lightBackground },
                      !event.hasLocation && styles.syncEventDisabled,
                    ]}
                    onPress={() => event.hasLocation && toggleEventSelection(event.id)}
                    disabled={!event.hasLocation}
                  >
                    {/* Checkbox */}
                    <View style={[
                      styles.syncCheckbox,
                      event.selected && styles.syncCheckboxChecked,
                      !event.hasLocation && styles.syncCheckboxDisabled,
                    ]}>
                      {event.selected && (
                        <Ionicons name="checkmark" size={16} color="white" />
                      )}
                    </View>

                    {/* Event Info */}
                    <View style={styles.syncEventInfo}>
                      <Text
                        style={[
                          Typography.labelLarge,
                          { color: event.hasLocation ? Colors[colorScheme ?? 'light'].text : Colors[colorScheme ?? 'light'].icon },
                        ]}
                        numberOfLines={1}
                      >
                        {event.title}
                      </Text>
                      <Text style={[Typography.bodySmall, { color: Colors[colorScheme ?? 'light'].icon }]}>
                        {event.startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                        {event.startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                      {event.location ? (
                        <View style={styles.syncEventLocation}>
                          <Ionicons name="location-outline" size={12} color={BrandColors.loopGreen} />
                          <Text
                            style={[Typography.bodySmall, { color: BrandColors.loopGreen, marginLeft: 4 }]}
                            numberOfLines={1}
                          >
                            {event.location}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.syncEventLocation}>
                          <Ionicons name="warning-outline" size={12} color={BrandColors.loopOrange} />
                          <Text style={[Typography.bodySmall, { color: BrandColors.loopOrange, marginLeft: 4 }]}>
                            No location - cannot import
                          </Text>
                        </View>
                      )}
                      <Text style={[Typography.labelSmall, { color: Colors[colorScheme ?? 'light'].icon, marginTop: 2 }]}>
                        {event.calendarName}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* Footer with Import Button */}
            <View style={styles.syncPreviewFooter}>
              <TouchableOpacity
                style={[styles.syncCancelButton, { borderColor: Colors[colorScheme ?? 'light'].border }]}
                onPress={() => setShowSyncPreview(false)}
              >
                <Text style={[Typography.labelLarge, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.syncImportButton,
                  { backgroundColor: BrandColors.loopGreen },
                  syncPreviewEvents.filter(e => e.selected).length === 0 && styles.syncImportButtonDisabled,
                ]}
                onPress={confirmSyncEvents}
                disabled={syncPreviewEvents.filter(e => e.selected).length === 0}
              >
                <Ionicons name="download-outline" size={20} color="white" />
                <Text style={[Typography.labelLarge, { color: 'white', marginLeft: 8 }]}>
                  Import {syncPreviewEvents.filter(e => e.selected).length} Events
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </SwipeableLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerIconButton: {
    padding: Spacing.xs,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loopViewContainer: {
    flex: 1,
  },
  loopDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: `${BrandColors.loopBlue}0D`, // 5% opacity
    borderBottomWidth: 1,
    borderBottomColor: `${BrandColors.loopBlue}33`, // 20% opacity
  },
  calendar: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  eventsContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  eventsHeader: {
    marginBottom: Spacing.md,
  },
  freeTimeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  freeTimeCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  freeTimeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  freeTimeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  freeTimeSuggestButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
  },
  syncPromptCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  syncPromptContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  syncPromptIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  syncPromptActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  syncPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
  },
  syncPromptDismiss: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  emptyText: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  createTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.15)',
    gap: Spacing.xs,
  },
  createTaskButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  eventCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    ...Shadows.md,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${BrandColors.loopBlue}1A`, // 10% opacity
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  eventContent: {
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: 4,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  loopViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginVertical: Spacing.lg,
    ...Shadows.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  formContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  inputLabel: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryButton: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    padding: Spacing.xs,
  },
  categoryButtonContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  createButton: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl * 2,
    ...Shadows.md,
  },
  mapPreview: {
    height: 200,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapHint: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutContainer: {
    backgroundColor: '#ffffff',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    minWidth: 200,
    maxWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  calloutAddress: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  selectedLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: `${BrandColors.loopBlue}1A`,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: BrandColors.loopBlue,
  },
  selectedLocationPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.loopBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  selectedLocationText: {
    flex: 1,
  },
  changeLocationButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  viewMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    marginVertical: Spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl * 2,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  deleteSwipeAction: {
    backgroundColor: BrandColors.error,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    width: 100,
  },
  deleteSwipeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  // Menu Drawer Styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
  },
  menuDrawer: {
    marginTop: 100,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    ...Shadows.lg,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: Spacing.md,
  },
  menuLoopIcon: {
    width: 28,
    height: 28,
    position: 'relative',
    marginRight: Spacing.sm,
  },
  menuLoopCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    position: 'absolute',
  },
  menuLoopCircleBlue: {
    borderColor: BrandColors.loopBlue,
    backgroundColor: 'transparent',
    top: 0,
    left: 0,
  },
  menuLoopCircleGreen: {
    borderColor: BrandColors.loopGreen,
    backgroundColor: 'transparent',
    bottom: 0,
    right: 0,
  },
  menuItems: {
    gap: Spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  menuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  menuItemContent: {
    flex: 1,
  },
  menuCloseButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  // Sync Preview Modal Styles
  syncPreviewModal: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  syncPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  syncPreviewActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  syncSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  syncPreviewList: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  syncEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  syncEventItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  syncEventDisabled: {
    opacity: 0.5,
  },
  syncCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BrandColors.loopBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    marginTop: 2,
  },
  syncCheckboxChecked: {
    backgroundColor: BrandColors.loopBlue,
  },
  syncCheckboxDisabled: {
    borderColor: '#ccc',
  },
  syncEventInfo: {
    flex: 1,
  },
  syncEventLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  syncPreviewFooter: {
    flexDirection: 'row',
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  syncCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  syncImportButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  syncImportButtonDisabled: {
    opacity: 0.5,
  },
});
