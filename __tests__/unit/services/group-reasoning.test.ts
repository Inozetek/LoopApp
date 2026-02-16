/**
 * Group Reasoning Tests
 * Tests for per-member matching, rich explanation generation,
 * and integration with the group scoring engine.
 *
 * Mirrors the pure logic from services/recommendations.ts
 * to avoid Google Places API dependencies.
 */

describe('Group Per-Member Reasoning', () => {
  // ─── Types (mirror production) ────────────────────────────────────────
  type PlaceLocation = { lat: number; lng: number };

  interface GroupMemberMatch {
    userId: string;
    name: string;
    matchedInterests: string[];
    distanceMiles: number;
    profilePicUrl?: string;
  }

  interface Participant {
    userId: string;
    name: string;
    homeLocation?: PlaceLocation;
    interests: string[];
    profilePicUrl?: string;
  }

  // ─── Helper functions (mirror production) ─────────────────────────────

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

  function interestMatchesCategory(interest: string, category: string): boolean {
    const a = interest.toLowerCase();
    const b = category.toLowerCase();
    if (a === b) return true;

    const aliases: Record<string, string[]> = {
      'dining': ['food', 'restaurant', 'food & drink'],
      'food & drink': ['dining', 'restaurant'],
      'coffee & cafes': ['coffee', 'cafe'],
      'coffee': ['coffee & cafes', 'cafe'],
      'bars & nightlife': ['nightlife', 'bar', 'bars'],
      'nightlife': ['bars & nightlife', 'bar', 'bars'],
      'outdoor activities': ['outdoor', 'parks', 'nature', 'hiking'],
      'outdoor': ['outdoor activities', 'parks'],
      'arts & culture': ['culture', 'museum', 'art', 'gallery'],
      'culture': ['arts & culture', 'museum'],
      'entertainment': ['fun', 'movies', 'theater'],
      'fitness': ['gym', 'sports', 'active'],
      'shopping': ['store', 'mall', 'retail'],
      'wellness': ['spa', 'relaxing'],
      'live music': ['music', 'concerts'],
    };

    const aAliases = aliases[a] || [];
    if (aAliases.includes(b)) return true;
    if (a.includes(b) || b.includes(a)) return true;

    return false;
  }

  function computeGroupMemberMatches(
    participants: Participant[],
    category: string,
    placeLocation: PlaceLocation,
    userLocation: PlaceLocation
  ): GroupMemberMatch[] {
    return participants.map((p) => {
      const from = p.homeLocation || userLocation;
      const dist = calculateDistance(from, placeLocation);
      const matched = (p.interests || []).filter(
        (interest) => interest === category || interestMatchesCategory(interest, category)
      );
      return {
        userId: p.userId,
        name: p.name,
        matchedInterests: matched,
        distanceMiles: Math.round(dist * 10) / 10,
        profilePicUrl: p.profilePicUrl,
      };
    });
  }

  function buildGroupExplanation(
    placeName: string,
    category: string,
    members: GroupMemberMatch[]
  ): string {
    const matchingMembers = members.filter((m) => m.matchedInterests.length > 0);
    const farthest = members.reduce(
      (prev, curr) => curr.distanceMiles > prev.distanceMiles ? curr : prev,
      members[0]
    );

    if (matchingMembers.length === members.length && members.length > 0) {
      const names = matchingMembers.map((m) => m.name.split(' ')[0]);
      if (names.length === 1) {
        return `${names[0]} loves ${category.toLowerCase()} — ${placeName} is a perfect pick.`;
      }
      if (names.length === 2) {
        return `${names[0]} and ${names[1]} both love ${category.toLowerCase()} — great match for everyone!`;
      }
      return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} all love ${category.toLowerCase()}!`;
    }

    if (matchingMembers.length > 0) {
      const names = matchingMembers.map((m) => m.name.split(' ')[0]);
      const nameStr = names.length === 1
        ? names[0]
        : names.length === 2
          ? `${names[0]} and ${names[1]}`
          : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
      return `${nameStr} ${matchingMembers.length === 1 ? 'likes' : 'like'} ${category.toLowerCase()} — and it's only ${farthest.distanceMiles.toFixed(1)} mi from ${farthest.name.split(' ')[0]}.`;
    }

    return `${placeName} is a group-friendly ${category.toLowerCase()} spot ${farthest.distanceMiles.toFixed(1)} mi from ${farthest.name.split(' ')[0]}.`;
  }

  // ─── Test Data ────────────────────────────────────────────────────────
  const midpoint: PlaceLocation = { lat: 32.78, lng: -96.80 };
  const placeNearby: PlaceLocation = { lat: 32.785, lng: -96.805 };
  const placeFar: PlaceLocation = { lat: 32.90, lng: -96.60 };

  const james: Participant = {
    userId: 'james-1',
    name: 'James Smith',
    homeLocation: { lat: 32.79, lng: -96.81 },
    interests: ['Dining', 'Live Music'],
    profilePicUrl: 'https://example.com/james.jpg',
  };

  const sarah: Participant = {
    userId: 'sarah-1',
    name: 'Sarah Jones',
    homeLocation: { lat: 32.77, lng: -96.79 },
    interests: ['Outdoor Activities', 'Arts & Culture'],
    profilePicUrl: 'https://example.com/sarah.jpg',
  };

  const alex: Participant = {
    userId: 'alex-1',
    name: 'Alex Brown',
    homeLocation: { lat: 32.80, lng: -96.82 },
    interests: ['Dining', 'Fitness'],
  };

  const you: Participant = {
    userId: 'you-1',
    name: 'You',
    homeLocation: midpoint,
    interests: ['Dining', 'Coffee & Cafes'],
  };

  // ─── Per-Member Matching Tests ────────────────────────────────────────
  describe('Per-member matching', () => {
    it('should match all members when everyone has the category as an interest', () => {
      const matches = computeGroupMemberMatches(
        [james, alex, you],
        'Dining',
        placeNearby,
        midpoint
      );

      expect(matches).toHaveLength(3);
      expect(matches[0].matchedInterests).toContain('Dining');
      expect(matches[1].matchedInterests).toContain('Dining');
      expect(matches[2].matchedInterests).toContain('Dining');
    });

    it('should have partial matches when only some members share the interest', () => {
      const matches = computeGroupMemberMatches(
        [james, sarah, alex],
        'Dining',
        placeNearby,
        midpoint
      );

      // James and Alex have Dining, Sarah does not
      expect(matches[0].matchedInterests).toContain('Dining');
      expect(matches[1].matchedInterests).toEqual([]);
      expect(matches[2].matchedInterests).toContain('Dining');
    });

    it('should return empty matchedInterests for all when no one matches', () => {
      const matches = computeGroupMemberMatches(
        [james, sarah, alex],
        'Shopping',
        placeNearby,
        midpoint
      );

      for (const match of matches) {
        expect(match.matchedInterests).toEqual([]);
      }
    });

    it('should match via aliases (e.g., Outdoor Activities matches Outdoor)', () => {
      const matches = computeGroupMemberMatches(
        [sarah],
        'Outdoor',
        placeNearby,
        midpoint
      );

      expect(matches[0].matchedInterests).toContain('Outdoor Activities');
    });

    it('should match via aliases (Coffee & Cafes matches Coffee)', () => {
      const matches = computeGroupMemberMatches(
        [you],
        'Coffee',
        placeNearby,
        midpoint
      );

      expect(matches[0].matchedInterests).toContain('Coffee & Cafes');
    });

    it('should calculate distance per member correctly', () => {
      const matches = computeGroupMemberMatches(
        [james, you],
        'Dining',
        placeNearby,
        midpoint
      );

      // Both should have non-negative distances
      expect(matches[0].distanceMiles).toBeGreaterThanOrEqual(0);
      expect(matches[1].distanceMiles).toBeGreaterThanOrEqual(0);

      // "You" is at midpoint, place is near midpoint — should be <= james
      expect(matches[1].distanceMiles).toBeLessThanOrEqual(matches[0].distanceMiles);
    });

    it('should use midpoint as fallback when member has no homeLocation', () => {
      const noHome: Participant = {
        userId: 'no-home',
        name: 'No Home',
        interests: ['Dining'],
      };

      const matches = computeGroupMemberMatches(
        [noHome],
        'Dining',
        placeNearby,
        midpoint
      );

      // Should use midpoint as home — distance should be small
      expect(matches[0].distanceMiles).toBeLessThan(1);
    });

    it('should preserve userId and name correctly', () => {
      const matches = computeGroupMemberMatches(
        [james, sarah],
        'Dining',
        placeNearby,
        midpoint
      );

      expect(matches[0].userId).toBe('james-1');
      expect(matches[0].name).toBe('James Smith');
      expect(matches[1].userId).toBe('sarah-1');
      expect(matches[1].name).toBe('Sarah Jones');
    });

    it('should preserve profilePicUrl when provided', () => {
      const matches = computeGroupMemberMatches(
        [james, alex],
        'Dining',
        placeNearby,
        midpoint
      );

      expect(matches[0].profilePicUrl).toBe('https://example.com/james.jpg');
      expect(matches[1].profilePicUrl).toBeUndefined();
    });

    it('should handle empty participants array', () => {
      const matches = computeGroupMemberMatches(
        [],
        'Dining',
        placeNearby,
        midpoint
      );

      expect(matches).toEqual([]);
    });

    it('should handle member with empty interests array', () => {
      const noInterests: Participant = {
        userId: 'empty',
        name: 'Empty Interests',
        interests: [],
      };

      const matches = computeGroupMemberMatches(
        [noInterests],
        'Dining',
        placeNearby,
        midpoint
      );

      expect(matches[0].matchedInterests).toEqual([]);
    });

    it('should match array length to participant count', () => {
      const matches = computeGroupMemberMatches(
        [james, sarah, alex, you],
        'Dining',
        placeNearby,
        midpoint
      );

      expect(matches).toHaveLength(4);
    });
  });

  // ─── Rich Explanation Generation Tests ────────────────────────────────
  describe('Rich explanation generation', () => {
    it('should name all members when everyone matches', () => {
      const matches = computeGroupMemberMatches(
        [james, alex, you],
        'Dining',
        placeNearby,
        midpoint
      );

      const explanation = buildGroupExplanation('Italian Bistro', 'Dining', matches);
      expect(explanation).toContain('James');
      expect(explanation).toContain('Alex');
      expect(explanation).toContain('You');
      expect(explanation).toContain('dining');
    });

    it('should use "both love" phrasing for 2-person all-match', () => {
      const matches = computeGroupMemberMatches(
        [james, alex],
        'Dining',
        placeNearby,
        midpoint
      );

      const explanation = buildGroupExplanation('Italian Bistro', 'Dining', matches);
      expect(explanation).toContain('both love');
    });

    it('should use singular phrasing for 1-person all-match', () => {
      const matches = computeGroupMemberMatches(
        [james],
        'Dining',
        placeNearby,
        midpoint
      );

      const explanation = buildGroupExplanation('Italian Bistro', 'Dining', matches);
      expect(explanation).toContain('James');
      expect(explanation).toContain('loves');
      expect(explanation).toContain('perfect pick');
    });

    it('should name only matching members when partial match', () => {
      const matches = computeGroupMemberMatches(
        [james, sarah, alex],
        'Dining',
        placeNearby,
        midpoint
      );

      const explanation = buildGroupExplanation('Italian Bistro', 'Dining', matches);
      // James and Alex match, Sarah does not
      expect(explanation).toContain('James');
      expect(explanation).toContain('Alex');
      expect(explanation).toContain('like');
    });

    it('should fall back to distance/group-friendly phrasing when no matches', () => {
      const matches = computeGroupMemberMatches(
        [james, sarah],
        'Shopping',
        placeNearby,
        midpoint
      );

      const explanation = buildGroupExplanation('Dallas Mall', 'Shopping', matches);
      expect(explanation).toContain('group-friendly');
      expect(explanation).toContain('mi from');
    });

    it('should mention the farthest member by first name in fallback', () => {
      const matches = computeGroupMemberMatches(
        [james, sarah],
        'Shopping',
        placeFar,
        midpoint
      );

      const explanation = buildGroupExplanation('Far Mall', 'Shopping', matches);
      // One of them should be named as farthest
      const mentionsName = explanation.includes('James') || explanation.includes('Sarah');
      expect(mentionsName).toBe(true);
    });

    it('should include distance in partial match explanation', () => {
      const matches = computeGroupMemberMatches(
        [james, sarah],
        'Dining',
        placeNearby,
        midpoint
      );

      const explanation = buildGroupExplanation('Italian Bistro', 'Dining', matches);
      // James matches, explanation should mention distance
      expect(explanation).toMatch(/\d+\.\d+ mi/);
    });

    it('should use "all love" phrasing for 3+ person all-match', () => {
      const matches = computeGroupMemberMatches(
        [james, alex, you],
        'Dining',
        placeNearby,
        midpoint
      );

      const explanation = buildGroupExplanation('Italian Bistro', 'Dining', matches);
      expect(explanation).toContain('all love');
    });
  });

  // ─── interestMatchesCategory Tests ────────────────────────────────────
  describe('interestMatchesCategory', () => {
    it('should match exact same strings', () => {
      expect(interestMatchesCategory('Dining', 'Dining')).toBe(true);
    });

    it('should match case-insensitively', () => {
      expect(interestMatchesCategory('dining', 'Dining')).toBe(true);
      expect(interestMatchesCategory('DINING', 'dining')).toBe(true);
    });

    it('should match via alias (Dining → Food & Drink)', () => {
      expect(interestMatchesCategory('Dining', 'Food & Drink')).toBe(true);
    });

    it('should match via alias (Coffee & Cafes → Coffee)', () => {
      expect(interestMatchesCategory('Coffee & Cafes', 'Coffee')).toBe(true);
    });

    it('should match via alias (Bars & Nightlife → Nightlife)', () => {
      expect(interestMatchesCategory('Bars & Nightlife', 'Nightlife')).toBe(true);
    });

    it('should match via alias (Outdoor Activities → Outdoor)', () => {
      expect(interestMatchesCategory('Outdoor Activities', 'Outdoor')).toBe(true);
    });

    it('should match via substring containment', () => {
      expect(interestMatchesCategory('Live Music', 'Music')).toBe(true);
    });

    it('should not match unrelated categories', () => {
      expect(interestMatchesCategory('Dining', 'Fitness')).toBe(false);
      expect(interestMatchesCategory('Shopping', 'Live Music')).toBe(false);
    });
  });
});
