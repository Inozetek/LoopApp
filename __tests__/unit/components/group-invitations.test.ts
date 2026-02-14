/**
 * Tests for group invitations — RSVP location parsing and creator name resolution.
 * Tests pure logic extracted from the component.
 */
import { parseLocation } from '@/utils/location-parser';

describe('Group Invitations - Location Parsing', () => {
  describe('RSVP calendar event should use real meeting_location', () => {
    it('generates correct WKT from parsed meeting_location', () => {
      const meetingLocation = parseLocation('POINT(-96.797 32.7767)');
      expect(meetingLocation).not.toBeNull();

      // Simulate what the component does to build the WKT for the calendar insert
      const locationWKT = meetingLocation
        ? `POINT(${meetingLocation.longitude} ${meetingLocation.latitude})`
        : `POINT(0 0)`;

      expect(locationWKT).toBe('POINT(-96.797 32.7767)');
      expect(locationWKT).not.toBe('POINT(0 0)');
    });

    it('generates correct WKT from GeoJSON meeting_location', () => {
      const meetingLocation = parseLocation({ coordinates: [-96.797, 32.7767] });
      expect(meetingLocation).not.toBeNull();

      const locationWKT = meetingLocation
        ? `POINT(${meetingLocation.longitude} ${meetingLocation.latitude})`
        : `POINT(0 0)`;

      expect(locationWKT).toBe('POINT(-96.797 32.7767)');
    });

    it('falls back to POINT(0 0) when meeting_location is null', () => {
      const meetingLocation = parseLocation(null);
      expect(meetingLocation).toBeNull();

      const locationWKT = meetingLocation
        ? `POINT(${meetingLocation.longitude} ${meetingLocation.latitude})`
        : `POINT(0 0)`;

      expect(locationWKT).toBe('POINT(0 0)');
    });
  });
});

describe('Group Invitations - Creator Name Resolution', () => {
  function resolveCreatorName(creatorUser: any): string {
    // Replicate the logic from the component transform
    const creatorName = Array.isArray(creatorUser)
      ? creatorUser[0]?.name
      : creatorUser?.name;
    return creatorName || 'A friend';
  }

  it('resolves name from single object (common Supabase format)', () => {
    expect(resolveCreatorName({ name: 'Sarah Johnson' })).toBe('Sarah Johnson');
  });

  it('resolves name from array format', () => {
    expect(resolveCreatorName([{ name: 'Mike Chen' }])).toBe('Mike Chen');
  });

  it('falls back to "A friend" when user object is null', () => {
    expect(resolveCreatorName(null)).toBe('A friend');
  });

  it('falls back to "A friend" when user object is undefined', () => {
    expect(resolveCreatorName(undefined)).toBe('A friend');
  });

  it('falls back to "A friend" for empty array', () => {
    expect(resolveCreatorName([])).toBe('A friend');
  });

  it('falls back to "A friend" when name field is missing', () => {
    expect(resolveCreatorName({ email: 'test@test.com' })).toBe('A friend');
  });
});
