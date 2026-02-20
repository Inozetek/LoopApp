import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors, Spacing, BorderRadius, Typography } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

// ── Public interfaces ──────────────────────────────────────────────

export interface RecentLocation {
  address: string;
  placeName: string;
  latitude: number;
  longitude: number;
  category?: string;
  lastUsed: string; // ISO timestamp
}

export interface QuickPickLocation {
  label: string;       // "Home" | "Work"
  icon: string;        // Ionicon name: "home" | "briefcase"
  address: string;
  latitude: number;
  longitude: number;
}

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
  recentLocations?: RecentLocation[];
  quickPickLocations?: QuickPickLocation[];
  onRequestCurrentLocation?: () => void; // Callback to get current location
}

// ── Pure helpers (exported for testing) ────────────────────────────

/** Filter recents by query string (case-insensitive, matches address or placeName) */
export function filterRecentLocations(
  recents: RecentLocation[],
  query: string,
): RecentLocation[] {
  if (!recents.length) return [];
  if (query.length === 0) return recents;
  const q = query.toLowerCase();
  return recents.filter(
    r => r.address.toLowerCase().includes(q) || r.placeName.toLowerCase().includes(q),
  );
}

/** Dedupe locations by normalized address, keeping the most recent */
export function dedupeByAddress(
  rows: Array<{ address: string; lastUsed: string; [key: string]: any }>,
): typeof rows {
  const seen = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = row.address.trim().toLowerCase();
    const existing = seen.get(key);
    if (!existing || row.lastUsed > existing.lastUsed) {
      seen.set(key, row);
    }
  }
  return Array.from(seen.values());
}

// ── Component ──────────────────────────────────────────────────────

export function LocationAutocomplete({
  value,
  onChangeText,
  onSelectLocation,
  placeholder = 'Search for a location',
  isDark = false,
  userLocation,
  recentLocations,
  quickPickLocations,
  onRequestCurrentLocation,
}: LocationAutocompleteProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [predictions, setPredictions] = useState<PlaceAutocomplete[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [justSelected, setJustSelected] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filtered recents (client-side, instant)
  const filteredRecents = useMemo(
    () => filterRecentLocations(recentLocations ?? [], value),
    [recentLocations, value],
  );

  // Should the unified dropdown be visible?
  const hasQuickPicks = (quickPickLocations?.length ?? 0) > 0;
  const hasRecents = filteredRecents.length > 0;
  const hasGoogleResults = showPredictions && predictions.length > 0;
  const showDropdown = isFocused && !justSelected && (hasQuickPicks || hasRecents || hasGoogleResults);

  // Debounce autocomplete requests
  useEffect(() => {
    if (justSelected) return;

    if (value.length < 3) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchPredictions(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value, justSelected]);

  // Cleanup blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, []);

  const handleFocus = useCallback(() => {
    if (blurTimeout.current) {
      clearTimeout(blurTimeout.current);
      blurTimeout.current = null;
    }
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Delay so taps on dropdown items register before we hide
    blurTimeout.current = setTimeout(() => {
      setIsFocused(false);
    }, 200);
  }, []);

  const fetchPredictions = async (input: string) => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY) {
      console.warn('Google Places API key not configured');
      return;
    }

    setLoading(true);
    try {
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
    const requestBody: any = {
      input: input,
      languageCode: 'en',
    };

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
          radius: 50000.0,
        },
      };
      requestBody.inputOffset = input.length;
      requestBody.sessionToken = 'search-session';
      requestBody.includedRegionCodes = ['us'];
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

    const mappedPredictions: PlaceAutocomplete[] = (data.suggestions || [])
      .filter((s: any) => s.placePrediction)
      .map((suggestion: any) => ({
        place_id: suggestion.placePrediction.placeId,
        description: suggestion.placePrediction.text?.text || '',
        structured_formatting: {
          main_text: suggestion.placePrediction.structuredFormat?.mainText?.text || '',
          secondary_text: suggestion.placePrediction.structuredFormat?.secondaryText?.text || '',
        },
        distance_meters: suggestion.placePrediction.distanceMeters,
      }));

    const sortedPredictions = mappedPredictions.sort((a, b) => {
      if (a.distance_meters !== undefined && b.distance_meters !== undefined) {
        return a.distance_meters - b.distance_meters;
      }
      return 0;
    });

    const MAX_DISTANCE_METERS = 50000;
    const nearbyPredictions = sortedPredictions.filter(p => {
      if (p.distance_meters !== undefined) {
        return p.distance_meters <= MAX_DISTANCE_METERS;
      }
      return true;
    });

    setPredictions(nearbyPredictions);
    setShowPredictions(true);
  };

  // Calculate distance between two lat/lng points in meters (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
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
    setJustSelected(true);
    Keyboard.dismiss();
    inputRef.current?.blur();
    setShowPredictions(false);
    setPredictions([]);
    setIsFocused(false);

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
      const latitude = data.location?.latitude;
      const longitude = data.location?.longitude;
      const formattedAddress = data.formattedAddress || prediction.description;
      const placeName = data.displayName?.text || prediction.structured_formatting?.main_text || prediction.description.split(',')[0];
      const types = data.types || [];

      if (latitude && longitude) {
        onSelectLocation({ placeName, address: formattedAddress, latitude, longitude, types });
      }
    } catch (error) {
      console.error('Place details error:', error);
    }
  };

  const handleSelectRecent = useCallback((loc: RecentLocation) => {
    setJustSelected(true);
    Keyboard.dismiss();
    inputRef.current?.blur();
    setShowPredictions(false);
    setPredictions([]);
    setIsFocused(false);
    onSelectLocation({
      placeName: loc.placeName,
      address: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
    });
  }, [onSelectLocation]);

  const handleSelectQuickPick = useCallback((pick: QuickPickLocation) => {
    setJustSelected(true);
    Keyboard.dismiss();
    inputRef.current?.blur();
    setShowPredictions(false);
    setPredictions([]);
    setIsFocused(false);
    onSelectLocation({
      placeName: pick.label,
      address: pick.address,
      latitude: pick.latitude,
      longitude: pick.longitude,
    });
  }, [onSelectLocation]);

  const handleCurrentLocation = useCallback(() => {
    setJustSelected(true);
    Keyboard.dismiss();
    inputRef.current?.blur();
    setIsFocused(false);
    onRequestCurrentLocation?.();
  }, [onRequestCurrentLocation]);

  // ── Render ─────────────────────────────────────────────────────

  const dividerColor = isDark ? '#404040' : '#e0e0e0';

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
            if (justSelected) {
              setJustSelected(false);
            }
            if (text.length >= 3) {
              setShowPredictions(true);
            }
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
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

      {/* Unified dropdown: quick-picks → recents → Google results */}
      {showDropdown && (
        <View
          style={[
            styles.dropdownContainer,
            {
              backgroundColor: isDark ? '#2f3133' : '#ffffff',
              borderColor: dividerColor,
            },
          ]}
        >
          <ScrollView
            style={styles.dropdownScroll}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Quick-pick pills: Home / Work / Current */}
            {(hasQuickPicks || onRequestCurrentLocation) && (
              <View style={styles.quickPickSection}>
                <View style={styles.quickPickRow}>
                  {quickPickLocations?.map((pick) => (
                    <TouchableOpacity
                      key={pick.label}
                      style={[
                        styles.quickPickPill,
                        { backgroundColor: isDark ? '#1a1a1c' : '#f0f0f0' },
                      ]}
                      onPress={() => handleSelectQuickPick(pick)}
                    >
                      <Ionicons
                        name={pick.icon as any}
                        size={14}
                        color={BrandColors.loopBlue}
                      />
                      <Text style={[styles.quickPickLabel, { color: colors.text }]}>
                        {pick.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {onRequestCurrentLocation && (
                    <TouchableOpacity
                      style={[
                        styles.quickPickPill,
                        { backgroundColor: isDark ? '#1a1a1c' : '#f0f0f0' },
                      ]}
                      onPress={handleCurrentLocation}
                    >
                      <Ionicons name="navigate" size={14} color={BrandColors.loopBlue} />
                      <Text style={[styles.quickPickLabel, { color: colors.text }]}>
                        Current
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Recents section */}
            {hasRecents && (
              <>
                {/* Divider after quick-picks */}
                {(hasQuickPicks || onRequestCurrentLocation) && (
                  <View style={[styles.sectionDivider, { backgroundColor: dividerColor }]} />
                )}
                <Text style={[styles.sectionHeader, { color: colors.icon }]}>RECENT</Text>
                {filteredRecents.map((loc, idx) => (
                  <TouchableOpacity
                    key={`recent-${idx}`}
                    style={[
                      styles.predictionItem,
                      { borderBottomColor: dividerColor },
                      idx === filteredRecents.length - 1 && !hasGoogleResults && styles.lastItem,
                    ]}
                    onPress={() => handleSelectRecent(loc)}
                  >
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={colors.icon}
                      style={styles.predictionIcon}
                    />
                    <View style={styles.predictionText}>
                      <Text style={[styles.mainText, { color: colors.text }]} numberOfLines={1}>
                        {loc.placeName}
                      </Text>
                      <Text style={[styles.secondaryText, { color: colors.icon }]} numberOfLines={1}>
                        {loc.address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Google Places results */}
            {hasGoogleResults && (
              <>
                {(hasRecents || hasQuickPicks || onRequestCurrentLocation) && (
                  <View style={[styles.sectionDivider, { backgroundColor: dividerColor }]} />
                )}
                {predictions.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={[
                      styles.predictionItem,
                      { borderBottomColor: dividerColor },
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
              </>
            )}
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
  dropdownContainer: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    maxHeight: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001,
  },
  dropdownScroll: {
    maxHeight: 320,
  },
  // Quick-pick pills
  quickPickSection: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  quickPickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  quickPickLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Section layout
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 4,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.sm,
  },
  // Reused from old predictions dropdown
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  lastItem: {
    borderBottomWidth: 0,
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
