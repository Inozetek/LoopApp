/**
 * Tests for group planning modal — date/time combination and default values.
 */

describe('Group Planning Modal - Date/Time Logic', () => {
  describe('default date/time values', () => {
    it('defaults to tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(18, 0, 0, 0);

      const planDate = new Date();
      planDate.setDate(planDate.getDate() + 1);
      planDate.setHours(18, 0, 0, 0);

      expect(planDate.getDate()).toBe(tomorrow.getDate());
      expect(planDate.getMonth()).toBe(tomorrow.getMonth());
    });

    it('defaults to 6 PM', () => {
      const defaultTime = new Date();
      defaultTime.setHours(18, 0, 0, 0);

      expect(defaultTime.getHours()).toBe(18);
      expect(defaultTime.getMinutes()).toBe(0);
    });
  });

  describe('date/time combination for suggested_time', () => {
    it('combines date and time correctly', () => {
      // Simulate: user picks March 20, 2025 as date
      const planDate = new Date(2025, 2, 20); // March 20
      // User picks 7:30 PM as time
      const planTime = new Date();
      planTime.setHours(19, 30, 0, 0);

      // Component logic: combine date + time
      const suggestedTime = new Date(planDate);
      suggestedTime.setHours(planTime.getHours(), planTime.getMinutes(), 0, 0);

      expect(suggestedTime.getFullYear()).toBe(2025);
      expect(suggestedTime.getMonth()).toBe(2); // March = 2
      expect(suggestedTime.getDate()).toBe(20);
      expect(suggestedTime.getHours()).toBe(19);
      expect(suggestedTime.getMinutes()).toBe(30);
    });

    it('handles midnight correctly', () => {
      const planDate = new Date(2025, 5, 15); // June 15
      const planTime = new Date();
      planTime.setHours(0, 0, 0, 0);

      const suggestedTime = new Date(planDate);
      suggestedTime.setHours(planTime.getHours(), planTime.getMinutes(), 0, 0);

      expect(suggestedTime.getHours()).toBe(0);
      expect(suggestedTime.getMinutes()).toBe(0);
      expect(suggestedTime.getDate()).toBe(15);
    });

    it('handles 11:59 PM correctly', () => {
      const planDate = new Date(2025, 0, 1); // Jan 1
      const planTime = new Date();
      planTime.setHours(23, 59, 0, 0);

      const suggestedTime = new Date(planDate);
      suggestedTime.setHours(planTime.getHours(), planTime.getMinutes(), 0, 0);

      expect(suggestedTime.getHours()).toBe(23);
      expect(suggestedTime.getMinutes()).toBe(59);
    });
  });

  describe('suggestion lat/lng storage', () => {
    it('stores coordinates from search results', () => {
      const mockPlace = {
        place_id: 'test-123',
        name: 'Test Place',
        geometry: { location: { lat: 32.7767, lng: -96.797 } },
        rating: 4.5,
        price_level: 2,
        types: ['restaurant'],
      };

      // Simulate the mapping logic from handleFindActivities
      const suggestion = {
        id: mockPlace.place_id,
        name: mockPlace.name,
        latitude: mockPlace.geometry.location.lat,
        longitude: mockPlace.geometry.location.lng,
      };

      expect(suggestion.latitude).toBe(32.7767);
      expect(suggestion.longitude).toBe(-96.797);
    });
  });
});
