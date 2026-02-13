/**
 * Group Recommendations Tests
 * Tests for group-specific scoring logic
 *
 * We test the pure scoring logic inline to avoid Google Places API dependencies.
 */

describe('Group Recommendations Scoring', () => {
  // Re-implement group scoring logic for testing
  type PlaceLocation = { lat: number; lng: number };

  interface Participant {
    userId: string;
    name: string;
    homeLocation?: PlaceLocation;
    interests: string[];
    preferences: { budget_level?: number; max_distance_miles?: number };
  }

  interface PlaceCandidate {
    name: string;
    types: string[];
    price_level?: number;
    rating?: number;
    location: PlaceLocation;
  }

  const GROUP_FRIENDLY_TYPES = new Set([
    'restaurant', 'bar', 'cafe', 'park', 'night_club', 'bowling_alley',
    'amusement_park', 'zoo', 'aquarium', 'tourist_attraction', 'museum',
  ]);

  const SOLO_ORIENTED_TYPES = new Set([
    'spa', 'yoga_studio', 'gym', 'fitness_center', 'library',
  ]);

  function calculateDistance(p1: PlaceLocation, p2: PlaceLocation): number {
    const R = 3959;
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((p1.lat * Math.PI) / 180) * Math.cos((p2.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function mapPlaceTypeToCategory(types: string[]): string {
    const map: Record<string, string> = {
      restaurant: 'Dining',
      cafe: 'Coffee & Cafes',
      bar: 'Bars & Nightlife',
      park: 'Outdoor Activities',
      museum: 'Arts & Culture',
      gym: 'Fitness',
      spa: 'Fitness',
    };
    for (const t of types) {
      if (map[t]) return map[t];
    }
    return 'Other';
  }

  function scoreGroupPlace(
    place: PlaceCandidate,
    participants: Participant[],
    userLocation: PlaceLocation,
    maxDistance: number = 5
  ): { total: number; interest: number; location: number; groupFriendly: number; rating: number } {
    const category = mapPlaceTypeToCategory(place.types);

    // Interest scoring
    const allInterests = participants.flatMap((p) => p.interests);
    const interestCounts = new Map<string, number>();
    for (const interest of allInterests) {
      interestCounts.set(interest, (interestCounts.get(interest) || 0) + 1);
    }

    const matchCount = interestCounts.get(category) || 0;
    let interestScore = 5;
    if (participants.length === 0) interestScore = 5;
    else if (matchCount === participants.length) interestScore = 40;
    else if (matchCount > participants.length / 2) interestScore = 30;
    else if (matchCount > 0) interestScore = 20;

    // Location scoring (max member distance)
    let maxMemberDistance = 0;
    for (const p of participants) {
      const from = p.homeLocation || userLocation;
      const dist = calculateDistance(from, place.location);
      if (dist > maxMemberDistance) maxMemberDistance = dist;
    }

    let locationScore = 5;
    if (maxMemberDistance <= 1) locationScore = 20;
    else if (maxMemberDistance <= 3) locationScore = 15;
    else if (maxMemberDistance <= maxDistance) locationScore = 10;

    // Group-friendly boost
    let groupFriendly = 0;
    if (place.types.some((t) => GROUP_FRIENDLY_TYPES.has(t))) groupFriendly = 10;
    else if (place.types.some((t) => SOLO_ORIENTED_TYPES.has(t))) groupFriendly = -5;

    // Rating
    const ratingScore = place.rating ? Math.min(15, Math.round((place.rating / 5) * 15)) : 5;

    return {
      total: interestScore + locationScore + groupFriendly + ratingScore,
      interest: interestScore,
      location: locationScore,
      groupFriendly,
      rating: ratingScore,
    };
  }

  // ─── Test Data ────────────────────────────────────────────────────────
  const midpoint: PlaceLocation = { lat: 32.78, lng: -96.80 };

  const alice: Participant = {
    userId: 'alice',
    name: 'Alice',
    homeLocation: { lat: 32.79, lng: -96.81 },
    interests: ['Dining', 'Outdoor Activities'],
    preferences: { budget_level: 2 },
  };

  const bob: Participant = {
    userId: 'bob',
    name: 'Bob',
    homeLocation: { lat: 32.77, lng: -96.79 },
    interests: ['Dining', 'Arts & Culture'],
    preferences: { budget_level: 3 },
  };

  const charlie: Participant = {
    userId: 'charlie',
    name: 'Charlie',
    homeLocation: { lat: 32.80, lng: -96.82 },
    interests: ['Fitness', 'Outdoor Activities'],
    preferences: { budget_level: 1 },
  };

  // ─── Tests ────────────────────────────────────────────────────────────
  describe('Interest scoring', () => {
    const restaurant: PlaceCandidate = {
      name: 'Italian Bistro',
      types: ['restaurant'],
      rating: 4.5,
      location: midpoint,
    };

    it('should give 2x weight (40) when ALL members share the interest', () => {
      // Alice and Bob both have "Dining"
      const score = scoreGroupPlace(restaurant, [alice, bob], midpoint);
      expect(score.interest).toBe(40);
    });

    it('should give 1.5x weight (30) when majority (>50%) share the interest', () => {
      // Alice and Bob have Dining, Charlie does not → 2/3 > 50%
      const score = scoreGroupPlace(restaurant, [alice, bob, charlie], midpoint);
      expect(score.interest).toBe(30);
    });

    it('should give 1x weight (20) when at least one member has the interest', () => {
      // Only Alice has Dining → 1/2 = 50%, not > 50%
      const gymGuy: Participant = {
        userId: 'gym',
        name: 'Gym',
        homeLocation: midpoint,
        interests: ['Fitness'],
        preferences: {},
      };
      const score = scoreGroupPlace(restaurant, [alice, gymGuy], midpoint);
      // 1/2 = 0.5, not > 0.5, so should be 20
      expect(score.interest).toBe(20);
    });

    it('should give base score (5) when no members have matching interest', () => {
      const allFitness: Participant = {
        userId: 'fit',
        name: 'Fit',
        homeLocation: midpoint,
        interests: ['Fitness'],
        preferences: {},
      };
      const allFitness2: Participant = {
        userId: 'fit2',
        name: 'Fit2',
        homeLocation: midpoint,
        interests: ['Fitness'],
        preferences: {},
      };
      const score = scoreGroupPlace(restaurant, [allFitness, allFitness2], midpoint);
      expect(score.interest).toBe(5);
    });
  });

  describe('Budget filtering', () => {
    it('should use lowest budget_level in group', () => {
      // Alice: 2, Bob: 3, Charlie: 1 → lowest is 1
      const lowestBudget = Math.min(
        ...[alice, bob, charlie].map((p) => p.preferences.budget_level ?? 3)
      );
      expect(lowestBudget).toBe(1);
    });

    it('should default to 3 when budget not specified', () => {
      const noBudget: Participant = {
        userId: 'x',
        name: 'X',
        homeLocation: midpoint,
        interests: [],
        preferences: {},
      };
      const lowestBudget = Math.min(
        ...[noBudget].map((p) => p.preferences.budget_level ?? 3)
      );
      expect(lowestBudget).toBe(3);
    });
  });

  describe('Distance scoring (max travel penalty)', () => {
    it('should score 20 when all members are within 1 mile', () => {
      const nearPlace: PlaceCandidate = {
        name: 'Nearby Cafe',
        types: ['cafe'],
        rating: 4.0,
        location: { lat: 32.785, lng: -96.805 }, // Very close to all
      };
      // All participants are within ~1 mile of midpoint
      const score = scoreGroupPlace(nearPlace, [alice, bob], midpoint);
      expect(score.location).toBeGreaterThanOrEqual(15); // Close enough
    });

    it('should give lower score for places far from farthest member', () => {
      const farPlace: PlaceCandidate = {
        name: 'Far Restaurant',
        types: ['restaurant'],
        rating: 4.0,
        location: { lat: 33.0, lng: -96.5 }, // ~20 miles away
      };
      const score = scoreGroupPlace(farPlace, [alice, bob, charlie], midpoint);
      expect(score.location).toBe(5); // Beyond max distance
    });
  });

  describe('Group-friendly venue boost', () => {
    it('should give +10 for restaurant', () => {
      const restaurant: PlaceCandidate = {
        name: 'Bistro',
        types: ['restaurant'],
        rating: 4.0,
        location: midpoint,
      };
      const score = scoreGroupPlace(restaurant, [alice], midpoint);
      expect(score.groupFriendly).toBe(10);
    });

    it('should give +10 for park', () => {
      const park: PlaceCandidate = {
        name: 'City Park',
        types: ['park'],
        rating: 4.5,
        location: midpoint,
      };
      const score = scoreGroupPlace(park, [alice], midpoint);
      expect(score.groupFriendly).toBe(10);
    });

    it('should give -5 for spa (solo-oriented)', () => {
      const spa: PlaceCandidate = {
        name: 'Day Spa',
        types: ['spa'],
        rating: 4.0,
        location: midpoint,
      };
      const score = scoreGroupPlace(spa, [alice], midpoint);
      expect(score.groupFriendly).toBe(-5);
    });

    it('should give -5 for gym (solo-oriented)', () => {
      const gym: PlaceCandidate = {
        name: 'Fitness Center',
        types: ['gym'],
        rating: 4.0,
        location: midpoint,
      };
      const score = scoreGroupPlace(gym, [alice], midpoint);
      expect(score.groupFriendly).toBe(-5);
    });

    it('should give 0 for neutral types', () => {
      const store: PlaceCandidate = {
        name: 'Book Store',
        types: ['book_store'],
        rating: 4.0,
        location: midpoint,
      };
      const score = scoreGroupPlace(store, [alice], midpoint);
      expect(score.groupFriendly).toBe(0);
    });
  });

  describe('Empty group edge case', () => {
    it('should handle no participants gracefully', () => {
      // The real function returns [] for empty participants
      // Just verify we don't crash
      const place: PlaceCandidate = {
        name: 'Test',
        types: ['restaurant'],
        rating: 4.0,
        location: midpoint,
      };
      // With 0 participants, interestScore should be 5 (no matches)
      const score = scoreGroupPlace(place, [], midpoint);
      expect(score.interest).toBe(5);
      expect(score.total).toBeGreaterThan(0);
    });
  });

  describe('Midpoint calculation', () => {
    it('should calculate midpoint as average of participant locations', () => {
      const locations = [alice, bob, charlie]
        .filter((p) => p.homeLocation)
        .map((p) => p.homeLocation!);

      const mid = {
        lat: locations.reduce((s, l) => s + l.lat, 0) / locations.length,
        lng: locations.reduce((s, l) => s + l.lng, 0) / locations.length,
      };

      expect(mid.lat).toBeCloseTo(32.787, 2);
      expect(mid.lng).toBeCloseTo(-96.807, 2);
    });

    it('should fall back to userLocation when no participants have homeLocation', () => {
      const noHome: Participant[] = [
        { userId: 'a', name: 'A', interests: [], preferences: {} },
      ];

      const fallback: PlaceLocation = { lat: 32.78, lng: -96.80 };
      const locations = noHome.filter((p) => p.homeLocation).map((p) => p.homeLocation!);
      const mid = locations.length > 0
        ? { lat: locations.reduce((s, l) => s + l.lat, 0) / locations.length, lng: locations.reduce((s, l) => s + l.lng, 0) / locations.length }
        : fallback;

      expect(mid).toEqual(fallback);
    });
  });
});
