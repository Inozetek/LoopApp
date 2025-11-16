import React, { useState, useEffect, useRef } from 'react';
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
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { BrandColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { FeedbackModal } from '@/components/feedback-modal';
import { CalendarEventSkeleton } from '@/components/skeleton-loader';
import { LoopMapView } from '@/components/loop-map-view';
import { SwipeableLayout } from './swipeable-layout';
import { LocationAutocomplete } from '@/components/location-autocomplete';
import { getCurrentLocation } from '@/services/location-service';
import {
  getPendingFeedbackActivities,
  markEventAsCompleted,
  shouldPromptForFeedback,
  CompletedActivity,
} from '@/services/feedback-service';

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
}

const CATEGORIES = [
  { id: 'dining', label: 'Dining', icon: 'restaurant', color: '#FF6B6B' },
  { id: 'entertainment', label: 'Entertainment', icon: 'musical-notes', color: '#4ECDC4' },
  { id: 'fitness', label: 'Fitness', icon: 'fitness', color: '#95E1D3' },
  { id: 'social', label: 'Social', icon: 'people', color: '#F38181' },
  { id: 'work', label: 'Work', icon: 'briefcase', color: '#AA96DA' },
  { id: 'personal', label: 'Personal', icon: 'person', color: '#FCBAD3' },
  { id: 'travel', label: 'Travel', icon: 'airplane', color: '#A8D8EA' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#C7CEEA' },
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
  const isDark = colorScheme === 'dark';

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
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

  // User's current location for autocomplete biasing
  const [currentUserLocation, setCurrentUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Animation for events list
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadEvents();
    checkForPendingFeedback();
  }, [selectedDate]);

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

  const checkForPendingFeedback = async () => {
    if (!user) return;

    // DEMO MODE: Skip feedback check for demo user
    if (user.id === 'demo-user-123') {
      return;
    }

    const { shouldPrompt, activity } = await shouldPromptForFeedback(user.id);

    if (shouldPrompt && activity) {
      // Delay showing feedback modal slightly to avoid overwhelming on load
      setTimeout(() => {
        setFeedbackActivity(activity);
        setShowFeedbackModal(true);
      }, 1000);
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

      const startOfDay = `${selectedDate}T00:00:00`;
      const endOfDay = `${selectedDate}T23:59:59`;

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .order('start_time', { ascending: true });

      if (error) throw error;

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
      Alert.alert('Error', 'Please enter a task title');
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

      // Use selected location from autocomplete, or fallback to Dallas coordinates
      const location = newTaskLocation || {
        latitude: 32.7767, // Dallas default
        longitude: -96.797,
      };

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

      Alert.alert('Success', 'Task added to calendar!');
      closeCreateModal();
      loadEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create task');
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
    // Reload events in case more feedback is pending
    checkForPendingFeedback();
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

  return (
    <SwipeableLayout>
      <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, Typography.headlineLarge, { color: Colors[colorScheme ?? 'light'].text }]}>
          Calendar
        </Text>
        <View style={styles.headerActions}>
          {/* List/Loop Toggle */}
          <TouchableOpacity style={styles.toggleButton} onPress={toggleViewMode}>
            <Ionicons
              name={viewMode === 'list' ? 'map' : 'list'}
              size={24}
              color={BrandColors.loopBlue}
            />
            <Text style={[styles.toggleText, { color: BrandColors.loopBlue }]}>
              {viewMode === 'list' ? 'Loop' : 'List'}
            </Text>
          </TouchableOpacity>
          {/* Add Button */}
          <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
            <Ionicons name="add-circle" size={32} color={BrandColors.loopBlue} />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'list' ? (
        <>
          {/* Calendar */}
          <Calendar
            current={selectedDate}
            onDayPress={onDayPress}
            markedDates={markedDates}
            theme={{
              calendarBackground: isDark ? '#1f2123' : '#ffffff',
              textSectionTitleColor: isDark ? '#999' : '#666',
              selectedDayBackgroundColor: BrandColors.loopBlue,
              selectedDayTextColor: '#ffffff',
              todayTextColor: BrandColors.loopBlue,
              dayTextColor: isDark ? '#ddd' : '#333',
              textDisabledColor: isDark ? '#444' : '#d9e1e8',
              monthTextColor: isDark ? '#fff' : '#000',
              textMonthFontSize: 18,
              textMonthFontWeight: '600',
            }}
            style={styles.calendar}
          />

          {/* Events List */}
          <ScrollView style={styles.eventsContainer}>
        <View style={styles.eventsHeader}>
          <Text style={[Typography.titleLarge, { color: Colors[colorScheme ?? 'light'].text }]}>
            {new Date(selectedDate).toLocaleDateString('en-US', {
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

        {loading ? (
          // Show skeleton loaders while loading
          <>
            <CalendarEventSkeleton />
            <CalendarEventSkeleton />
            <CalendarEventSkeleton />
          </>
        ) : events.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={Colors[colorScheme ?? 'light'].icon} />
            <Text style={[Typography.bodyLarge, styles.emptyText, { color: Colors[colorScheme ?? 'light'].icon }]}>
              No activities scheduled
            </Text>
            <Text style={[Typography.bodyMedium, { color: Colors[colorScheme ?? 'light'].icon, textAlign: 'center' }]}>
              Tap the + button to add a task
            </Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            {events.map((event) => (
              <View
                key={event.id}
                style={[
                  styles.eventCard,
                  {
                    backgroundColor: isDark ? '#1f2123' : '#ffffff',
                    borderLeftColor: getCategoryColor(event.category),
                  },
                ]}
              >
              <View style={styles.eventHeader}>
                <View style={styles.eventIconContainer}>
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
                <View style={[styles.statusBadge, { backgroundColor: '#10b981' }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                  <Text style={[Typography.labelSmall, { color: '#ffffff', marginLeft: 4 }]}>
                    Completed
                  </Text>
                </View>
              )}
            </View>
          ))}
          </Animated.View>
        )}

        {/* Loop View Button - Show when there are events */}
        {events.length > 0 && (
          <TouchableOpacity
            style={[styles.loopViewButton, { backgroundColor: BrandColors.loopBlue }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert('Loop View', 'Map visualization coming in Phase 2!');
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
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>

          {/* Map View */}
          <LoopMapView
            tasks={events.map(event => ({
              id: event.id,
              title: event.title,
              latitude: event.location.latitude,
              longitude: event.location.longitude,
              address: event.address,
              start_time: event.start_time,
              category: event.category,
            }))}
            homeLocation={
              user?.home_location
                ? {
                    latitude: parseFloat((user.home_location as string).split(',')[0]),
                    longitude: parseFloat((user.home_location as string).split(',')[1]),
                  }
                : undefined
            }
            onTaskPress={(taskId) => {
              const task = events.find(e => e.id === taskId);
              if (task) {
                Alert.alert(
                  task.title,
                  `${task.address}\n${new Date(task.start_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`,
                  [{ text: 'OK' }]
                );
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
              <View style={[styles.modalContent, { backgroundColor: isDark ? '#1f2123' : '#ffffff' }]}>
                <View style={styles.modalHeader}>
                  <Text style={[Typography.headlineMedium, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Create Task
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
                    backgroundColor: isDark ? '#2f3133' : '#f5f5f5',
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
                    backgroundColor: isDark ? '#2f3133' : '#f5f5f5',
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
                  { backgroundColor: isDark ? '#2f3133' : '#f5f5f5' },
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
                  { backgroundColor: isDark ? '#2f3133' : '#f5f5f5' },
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
                style={[styles.dateTimeButton, { backgroundColor: isDark ? '#2f3133' : '#f5f5f5' }]}
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
              <LocationAutocomplete
                value={newTaskAddress}
                onChangeText={setNewTaskAddress}
                onSelectLocation={(location) => {
                  setNewTaskAddress(location.address);
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
                </View>
              )}

              {/* Map Preview */}
              {newTaskLocation && (
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
                  {/* Map instruction hint */}
                  <View style={styles.mapHint}>
                    <Ionicons name="information-circle" size={14} color={Colors[colorScheme ?? 'light'].icon} />
                    <Text style={[Typography.bodySmall, { color: Colors[colorScheme ?? 'light'].icon, marginLeft: 4 }]}>
                      Pinch to zoom • Drag to explore
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
                        backgroundColor: newTaskCategory === cat.id ? cat.color : (isDark ? '#2f3133' : '#f5f5f5'),
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
                <Text style={[Typography.labelLarge, { color: '#ffffff' }]}>Create Task</Text>
              </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Feedback Modal */}
      {feedbackActivity && (
        <FeedbackModal
          visible={showFeedbackModal}
          onClose={handleCloseFeedbackModal}
          activityId={feedbackActivity.activityId || feedbackActivity.eventId}
          activityName={feedbackActivity.activityName}
          activityCategory={feedbackActivity.activityCategory}
          userId={user?.id || ''}
          recommendationId={feedbackActivity.recommendationId || undefined}
        />
      )}
      </View>
    </SwipeableLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + 40,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: `${BrandColors.loopBlue}1A`, // 10% opacity
    borderRadius: BorderRadius.md,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    padding: Spacing.sm,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  emptyText: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
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
});
