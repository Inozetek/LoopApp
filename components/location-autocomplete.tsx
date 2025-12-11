import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors, Spacing, BorderRadius, Typography } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface PlaceAutocomplete {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  distance_meters?: number;
}

interface LocationAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectLocation: (location: {
    placeName: string; // Place name (e.g., "Starbucks")
    address: string;
    latitude: number;
    longitude: number;
    types?: string[]; // Google place types
  }) => void;
  placeholder?: string;
  isDark?: boolean;
  userLocation?: { latitude: number; longitude: number }; // For location biasing
}

export function LocationAutocomplete({
  value,
  onChangeText,
  onSelectLocation,
  placeholder = 'Search for a location',
  isDark = false,
  userLocation,
}: LocationAutocompleteProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [predictions, setPredictions] = useState<PlaceAutocomplete[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [justSelected, setJustSelected] = useState(false); // Track if we just selected a prediction
  const inputRef = React.useRef<TextInput>(null);

  // Debounce autocomplete requests
  useEffect(() => {
    // Don't fetch if we just selected a prediction
    if (justSelected) {
      setJustSelected(false);
      return;
    }

    if (value.length < 3) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchPredictions(value);
    }, 300); // Wait 300ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [value, justSelected]);

  const fetchPredictions = async (input: string) => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY) {
      console.warn('Google Places API key not configured');
      return;
    }

    setLoading(true);
    try {
      // Use Autocomplete API (like Google Maps does)
      // It's better at understanding place names and providing relevant suggestions
      // Already sorted by distance via the origin parameter
      await fetchAutocompleteResults(input);
    } catch (error) {
      console.error('Search error:', error);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch results using Autocomplete API (fast, curated suggestions)
  const fetchAutocompleteResults = async (input: string) => {
    // Build request body with location biasing
    const requestBody: any = {
      input: input,
      languageCode: 'en',
    };

    // Add location origin if user location is available (for distance calculation)
    if (userLocation) {
      requestBody.origin = {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      };
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          },
          radius: 50000.0, // 50km radius for biasing (includes nearby suburbs like Addison)
        },
      };
      // Request more results to increase chances of finding the closest match
      requestBody.inputOffset = input.length; // Help Google understand where query ends
      requestBody.sessionToken = 'search-session'; // Group requests for billing
      requestBody.includedRegionCodes = ['us']; // Limit to US for better relevance (lowercase)
    }

    const response = await fetch(
      `https://places.googleapis.com/v1/places:autocomplete`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY!,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    console.log('📍 Autocomplete API response:', JSON.stringify(data, null, 2));

    // Map Google Places API (New) response to our interface
    const mappedPredictions: PlaceAutocomplete[] = (data.suggestions || [])
      .filter((s: any) => s.placePrediction) // Only include place predictions (not query suggestions)
      .map((suggestion: any) => ({
        place_id: suggestion.placePrediction.placeId,
        description: suggestion.placePrediction.text?.text || '',
        structured_formatting: {
          main_text: suggestion.placePrediction.structuredFormat?.mainText?.text || '',
          secondary_text: suggestion.placePrediction.structuredFormat?.secondaryText?.text || '',
        },
        distance_meters: suggestion.placePrediction.distanceMeters, // Distance from user location
      }));

    console.log('📏 Mapped predictions with distances:', mappedPredictions.map(p => ({
      name: p.structured_formatting.main_text,
      distance_meters: p.distance_meters,
      distance_miles: p.distance_meters ? (p.distance_meters / 1609.34).toFixed(1) : 'N/A'
    })));

    // Sort by distance if available (closest first)
    const sortedPredictions = mappedPredictions.sort((a, b) => {
      if (a.distance_meters !== undefined && b.distance_meters !== undefined) {
        return a.distance_meters - b.distance_meters;
      }
      // If distance not available, keep original order
      return 0;
    });

    console.log('✅ Sorted predictions:', sortedPredictions.map(p => ({
      name: p.structured_formatting.main_text,
      distance_miles: p.distance_meters ? (p.distance_meters / 1609.34).toFixed(1) : 'N/A'
    })));

    setPredictions(sortedPredictions);
    setShowPredictions(true);
  };

  // Fetch results using Text Search API (comprehensive, all nearby results)
  const fetchTextSearchResults = async (input: string) => {
    if (!userLocation) return;

    // Track API usage BEFORE making request
    const { trackPlacesAPIRequest } = await import('@/utils/api-cost-tracker');
    const allowRequest = await trackPlacesAPIRequest('text_search');

    if (!allowRequest) {
      console.error('🚨 API request blocked - free tier limit reached!');
      setPredictions([]);
      return;
    }

    console.log(`🔍 Text Search query: "${input}"`);

    // Build request body - simple and straightforward
    const requestBody: any = {
      textQuery: input,
      locationBias: {
        circle: {
          center: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          },
          radius: 10000.0, // 10km (~6 miles)
        },
      },
      maxResultCount: 20,
    };

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY!,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    console.log('🔍 Text Search API response:', JSON.stringify(data, null, 2));

    // Map Text Search results to autocomplete format
    const places = data.places || [];
    const mappedPredictions: PlaceAutocomplete[] = places.map((place: any) => {
      // Calculate distance from user location
      const placeLat = place.location?.latitude || 0;
      const placeLng = place.location?.longitude || 0;
      const distance_meters = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        placeLat,
        placeLng
      );

      return {
        place_id: place.id,
        description: place.formattedAddress || place.displayName?.text || '',
        structured_formatting: {
          main_text: place.displayName?.text || place.displayName || 'Unknown Place',
          secondary_text: place.formattedAddress || '',
        },
        distance_meters,
      };
    });

    // Sort by distance (closest first) - THIS IS CRITICAL
    const sortedPredictions = mappedPredictions.sort((a, b) => {
      const distA = a.distance_meters || Infinity;
      const distB = b.distance_meters || Infinity;
      return distA - distB; // Ascending order (smallest = closest = first)
    });

    console.log('✅ FINAL SORTED RESULTS (closest → furthest):');
    sortedPredictions.forEach((p, index) => {
      console.log(`  ${index + 1}. ${p.structured_formatting.main_text} - ${(p.distance_meters! / 1609.34).toFixed(2)} mi`);
    });

    setPredictions(sortedPredictions);
    setShowPredictions(true);
  };

  // Calculate distance between two lat/lng points in meters (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleSelectPrediction = async (prediction: PlaceAutocomplete) => {
    // Mark that we just selected (prevents refetching)
    setJustSelected(true);

    // Dismiss keyboard
    Keyboard.dismiss();
    inputRef.current?.blur();

    // Close predictions immediately
    setShowPredictions(false);

    // Fetch place details to get coordinates and types
    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${prediction.place_id}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY!,
            'X-Goog-FieldMask': 'id,displayName,location,formattedAddress,types',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Extract coordinates, formatted address, and place types
      const latitude = data.location?.latitude;
      const longitude = data.location?.longitude;
      const formattedAddress = data.formattedAddress || prediction.description;
      const placeName = data.displayName?.text || prediction.structured_formatting?.main_text || prediction.description.split(',')[0];
      const types = data.types || [];

      if (latitude && longitude) {
        onSelectLocation({
          placeName,
          address: formattedAddress,
          latitude,
          longitude,
          types,
        });
      }
    } catch (error) {
      console.error('Place details error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            Typography.bodyLarge,
            {
              backgroundColor: isDark ? '#2f3133' : '#f5f5f5',
              color: colors.text,
            },
          ]}
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            // Only show predictions if we didn't just select one
            if (!justSelected && text.length >= 3) {
              setShowPredictions(true);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.icon}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          blurOnSubmit={true}
        />
        {loading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color={BrandColors.loopBlue} />
          </View>
        )}
      </View>

      {/* Predictions dropdown */}
      {showPredictions && predictions.length > 0 && (
        <View
          style={[
            styles.predictionsContainer,
            {
              backgroundColor: isDark ? '#2f3133' : '#ffffff',
              borderColor: isDark ? '#404040' : '#e0e0e0',
            },
          ]}
        >
          <ScrollView
            style={styles.predictionsList}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {predictions.map((item) => (
              <TouchableOpacity
                key={item.place_id}
                style={[
                  styles.predictionItem,
                  {
                    borderBottomColor: isDark ? '#404040' : '#e0e0e0',
                  },
                ]}
                onPress={() => handleSelectPrediction(item)}
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={colors.icon}
                  style={styles.predictionIcon}
                />
                <View style={styles.predictionText}>
                  <View style={styles.mainTextRow}>
                    <Text style={[styles.mainText, { color: colors.text }]}>
                      {item.structured_formatting.main_text}
                    </Text>
                    {item.distance_meters !== undefined && (
                      <Text style={[styles.distanceText, { color: BrandColors.loopBlue }]}>
                        {(item.distance_meters / 1609.34).toFixed(1)} mi
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.secondaryText, { color: colors.icon }]}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  loadingIndicator: {
    position: 'absolute',
    right: Spacing.md,
    top: 14,
  },
  predictionsContainer: {
    position: 'absolute',
    top: 56, // Just below the input
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001,
  },
  predictionsList: {
    maxHeight: 250,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  predictionIcon: {
    marginRight: Spacing.sm,
  },
  predictionText: {
    flex: 1,
  },
  mainTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  mainText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryText: {
    fontSize: 13,
  },
});
