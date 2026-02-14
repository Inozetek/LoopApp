/**
 * Tests for affiliate-service.ts
 *
 * Tests partner matching, URL building, click tracking, and link opening.
 */

// Mock Supabase client
const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: mockInsert,
    })),
  },
}));

// Mock Linking
const mockCanOpenURL = jest.fn().mockResolvedValue(false);
const mockOpenURL = jest.fn().mockResolvedValue(true);
jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: (...args: any[]) => mockCanOpenURL(...args),
    openURL: (...args: any[]) => mockOpenURL(...args),
  },
}));

import { Recommendation } from '@/types/activity';
import { PARTNER_COMMISSION_RATES } from '@/types/affiliate';
import {
  getMatchingPartners,
  buildBookingUrl,
  trackAffiliateClick,
  openAffiliateLink,
} from '@/services/affiliate-service';
import { AFFILIATE_CONFIG } from '@/constants/affiliate-config';

// Helper to build a minimal Recommendation for testing
function makeRecommendation(overrides: Partial<Recommendation> & Record<string, any> = {}): Recommendation {
  const { event_metadata, ...rest } = overrides;
  const rec: any = {
    id: 'rec-1',
    title: 'Test Place',
    category: 'dining',
    location: '123 Main St',
    distance: '1.2 mi',
    priceRange: 2,
    rating: 4.5,
    imageUrl: 'https://example.com/photo.jpg',
    aiExplanation: 'Great spot',
    isSponsored: false,
    activity: {
      id: 'act-1',
      name: 'Test Place',
      category: 'dining',
      location: { latitude: 32.7767, longitude: -96.7970, address: '123 Main St' },
      priceRange: 2,
      googlePlaceId: 'ChIJ_test123',
    },
    ...rest,
  };
  if (event_metadata) {
    rec.event_metadata = event_metadata;
  }
  return rec as Recommendation;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================
// Partner Matching Tests
// ============================================
describe('getMatchingPartners', () => {
  it('returns opentable for dining category', () => {
    const rec = makeRecommendation({ category: 'dining' });
    const partners = getMatchingPartners(rec);
    const ids = partners.map(p => p.partnerId);
    expect(ids).toContain('opentable');
  });

  it('returns opentable for restaurant category', () => {
    const rec = makeRecommendation({ category: 'restaurant' });
    const partners = getMatchingPartners(rec);
    expect(partners.map(p => p.partnerId)).toContain('opentable');
  });

  it('returns opentable for cafe/coffee categories', () => {
    for (const cat of ['cafe', 'coffee', 'bar']) {
      const rec = makeRecommendation({ category: cat });
      const partners = getMatchingPartners(rec);
      expect(partners.map(p => p.partnerId)).toContain('opentable');
    }
  });

  it('returns ticketmaster for event with ticketmaster URL', () => {
    const rec = makeRecommendation({
      category: 'entertainment',
      event_metadata: { event_url: 'https://www.ticketmaster.com/event/12345' },
    });
    const partners = getMatchingPartners(rec);
    expect(partners.map(p => p.partnerId)).toContain('ticketmaster');
  });

  it('returns eventbrite for event with eventbrite URL', () => {
    const rec = makeRecommendation({
      category: 'entertainment',
      event_metadata: { event_url: 'https://www.eventbrite.com/e/12345' },
    });
    const partners = getMatchingPartners(rec);
    expect(partners.map(p => p.partnerId)).toContain('eventbrite');
  });

  it('returns fandango for event with fandango URL', () => {
    const rec = makeRecommendation({
      category: 'entertainment',
      event_metadata: { event_url: 'https://www.fandango.com/movie/12345' },
    });
    const partners = getMatchingPartners(rec);
    expect(partners.map(p => p.partnerId)).toContain('fandango');
  });

  it('returns uber + lyft when location exists', () => {
    const rec = makeRecommendation({ category: 'entertainment' });
    const partners = getMatchingPartners(rec);
    const ids = partners.map(p => p.partnerId);
    expect(ids).toContain('uber');
    expect(ids).toContain('lyft');
  });

  it('does not return uber/lyft when no location', () => {
    const rec = makeRecommendation({
      category: 'entertainment',
      activity: {
        id: 'act-1',
        name: 'Test',
        category: 'entertainment',
        location: undefined as any,
        priceRange: 0,
      },
    });
    const partners = getMatchingPartners(rec);
    const ids = partners.map(p => p.partnerId);
    expect(ids).not.toContain('uber');
    expect(ids).not.toContain('lyft');
  });

  it('returns multiple partners for dining event with location', () => {
    const rec = makeRecommendation({
      category: 'dining',
      event_metadata: { event_url: 'https://www.ticketmaster.com/event/12345' },
    });
    const partners = getMatchingPartners(rec);
    const ids = partners.map(p => p.partnerId);
    expect(ids).toContain('opentable');
    expect(ids).toContain('ticketmaster');
    expect(ids).toContain('uber');
    expect(ids).toContain('lyft');
  });

  it('returns no partners for non-matching category with no event and no location', () => {
    const rec = makeRecommendation({
      category: 'hiking',
      activity: {
        id: 'act-1',
        name: 'Trail',
        category: 'hiking',
        location: undefined as any,
        priceRange: 0,
      },
    });
    const partners = getMatchingPartners(rec);
    expect(partners).toHaveLength(0);
  });

  it('includes correct CTA text from PARTNER_COMMISSION_RATES', () => {
    const rec = makeRecommendation({ category: 'dining' });
    const partners = getMatchingPartners(rec);
    const opentable = partners.find(p => p.partnerId === 'opentable');
    expect(opentable?.ctaText).toBe(PARTNER_COMMISSION_RATES.opentable.ctaText);
  });

  it('includes icon and color for each partner', () => {
    const rec = makeRecommendation({ category: 'dining' });
    const partners = getMatchingPartners(rec);
    for (const partner of partners) {
      expect(partner.icon).toBeTruthy();
      expect(partner.color).toBeTruthy();
      expect(partner.color).toMatch(/^#/);
    }
  });
});

// ============================================
// URL Building Tests
// ============================================
describe('buildBookingUrl', () => {
  it('builds Uber deep link with lat/lng', () => {
    const rec = makeRecommendation();
    const urls = buildBookingUrl('uber', rec);
    expect(urls.deepLink).toContain('uber://');
    expect(urls.deepLink).toContain('32.7767');
    expect(urls.deepLink).toContain('-96.797');
    expect(urls.webUrl).toContain('m.uber.com');
  });

  it('includes affiliate code in Uber URL when enabled', () => {
    const originalEnabled = AFFILIATE_CONFIG.uber.enabled;
    const originalCode = AFFILIATE_CONFIG.uber.affiliateCode;
    AFFILIATE_CONFIG.uber.enabled = true;
    AFFILIATE_CONFIG.uber.affiliateCode = 'TEST_UBER_CODE';

    const rec = makeRecommendation();
    const urls = buildBookingUrl('uber', rec);
    expect(urls.deepLink).toContain('client_id=TEST_UBER_CODE');
    expect(urls.webUrl).toContain('client_id=TEST_UBER_CODE');

    AFFILIATE_CONFIG.uber.enabled = originalEnabled;
    AFFILIATE_CONFIG.uber.affiliateCode = originalCode;
  });

  it('omits affiliate code in Uber URL when disabled', () => {
    const rec = makeRecommendation();
    const urls = buildBookingUrl('uber', rec);
    expect(urls.deepLink).not.toContain('client_id=');
    expect(urls.webUrl).not.toContain('client_id=');
  });

  it('builds Lyft deep link with lat/lng', () => {
    const rec = makeRecommendation();
    const urls = buildBookingUrl('lyft', rec);
    expect(urls.deepLink).toContain('lyft://');
    expect(urls.deepLink).toContain('32.7767');
    expect(urls.webUrl).toContain('ride.lyft.com');
  });

  it('returns fallback URL when Uber has no location', () => {
    const rec = makeRecommendation({
      activity: {
        id: 'act-1',
        name: 'Test',
        category: 'test',
        location: undefined as any,
        priceRange: 0,
      },
    });
    const urls = buildBookingUrl('uber', rec);
    expect(urls.webUrl).toBe('https://www.uber.com');
  });

  it('builds OpenTable URL with place ID and ref param', () => {
    const rec = makeRecommendation();
    const urls = buildBookingUrl('opentable', rec);
    expect(urls.webUrl).toContain('opentable.com');
    expect(urls.webUrl).toContain('rid=ChIJ_test123');
    expect(urls.webUrl).toContain('ref=loop_app');
  });

  it('appends camefrom param to Ticketmaster event URL', () => {
    const rec = makeRecommendation({
      event_metadata: { event_url: 'https://www.ticketmaster.com/event/12345' },
    });
    const urls = buildBookingUrl('ticketmaster', rec);
    expect(urls.webUrl).toContain('ticketmaster.com/event/12345');
    expect(urls.webUrl).toContain('camefrom=loop_app');
  });

  it('uses & separator when event URL already has query params', () => {
    const rec = makeRecommendation({
      event_metadata: { event_url: 'https://www.ticketmaster.com/event/12345?lang=en' },
    });
    const urls = buildBookingUrl('ticketmaster', rec);
    expect(urls.webUrl).toContain('?lang=en&camefrom=');
  });

  it('appends aff param to Eventbrite event URL', () => {
    const rec = makeRecommendation({
      event_metadata: { event_url: 'https://www.eventbrite.com/e/12345' },
    });
    const urls = buildBookingUrl('eventbrite', rec);
    expect(urls.webUrl).toContain('eventbrite.com/e/12345');
    expect(urls.webUrl).toContain('aff=loop_app');
  });

  it('appends ref param to Fandango event URL', () => {
    const rec = makeRecommendation({
      event_metadata: { event_url: 'https://www.fandango.com/movie/12345' },
    });
    const urls = buildBookingUrl('fandango', rec);
    expect(urls.webUrl).toContain('fandango.com/movie/12345');
    expect(urls.webUrl).toContain('ref=loop_app');
  });

  it('returns fallback for ticketmaster without event URL', () => {
    const rec = makeRecommendation();
    const urls = buildBookingUrl('ticketmaster', rec);
    expect(urls.webUrl).toBe('https://www.ticketmaster.com');
  });
});

// ============================================
// Click Tracking Tests
// ============================================
describe('trackAffiliateClick', () => {
  it('inserts a booking record with status clicked', async () => {
    const rec = makeRecommendation();
    await trackAffiliateClick('user-123', 'opentable', rec);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        partner_id: 'opentable',
        status: 'clicked',
      })
    );
  });

  it('includes commission rate from PARTNER_COMMISSION_RATES', async () => {
    const rec = makeRecommendation();
    await trackAffiliateClick('user-123', 'opentable', rec);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        commission_rate_at_booking: PARTNER_COMMISSION_RATES.opentable.rate,
      })
    );
  });

  it('includes activity metadata in the record', async () => {
    const rec = makeRecommendation();
    await trackAffiliateClick('user-123', 'uber', rec);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        activity_name: 'Test Place',
        activity_category: 'dining',
        place_id: 'ChIJ_test123',
        booking_type: 'ride',
      })
    );
  });

  it('includes attribution source', async () => {
    const rec = makeRecommendation();
    await trackAffiliateClick('user-123', 'uber', rec, 'explore');

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        attribution_source: 'explore',
      })
    );
  });

  it('does nothing when userId is undefined', async () => {
    const rec = makeRecommendation();
    await trackAffiliateClick(undefined, 'uber', rec);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('handles missing optional fields gracefully', async () => {
    const rec = makeRecommendation({
      activity: {
        id: 'act-1',
        name: 'Test',
        category: 'other',
        location: { latitude: 0, longitude: 0, address: '' },
        priceRange: 0,
      },
    });
    await trackAffiliateClick('user-123', 'uber', rec);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        place_id: null,
      })
    );
  });

  it('does not throw on Supabase error', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB error'));
    const rec = makeRecommendation();
    // Should not throw
    await expect(trackAffiliateClick('user-123', 'uber', rec)).resolves.toBeUndefined();
  });
});

// ============================================
// Open Affiliate Link Tests
// ============================================
describe('openAffiliateLink', () => {
  it('tries deep link first when available', async () => {
    mockCanOpenURL.mockResolvedValueOnce(true);
    const rec = makeRecommendation();
    const result = await openAffiliateLink('uber', rec, 'user-123');
    expect(result).toBe(true);
    expect(mockCanOpenURL).toHaveBeenCalledWith(expect.stringContaining('uber://'));
    expect(mockOpenURL).toHaveBeenCalledWith(expect.stringContaining('uber://'));
  });

  it('falls back to web URL when deep link unavailable', async () => {
    mockCanOpenURL.mockResolvedValueOnce(false);
    const rec = makeRecommendation();
    const result = await openAffiliateLink('uber', rec, 'user-123');
    expect(result).toBe(true);
    expect(mockOpenURL).toHaveBeenCalledWith(expect.stringContaining('m.uber.com'));
  });

  it('opens web URL directly for partners without deep links', async () => {
    const rec = makeRecommendation();
    const result = await openAffiliateLink('opentable', rec, 'user-123');
    expect(result).toBe(true);
    expect(mockOpenURL).toHaveBeenCalledWith(expect.stringContaining('opentable.com'));
  });

  it('returns false when opening fails', async () => {
    mockOpenURL.mockRejectedValueOnce(new Error('Cannot open'));
    const rec = makeRecommendation({
      activity: {
        id: 'act-1',
        name: 'Test',
        category: 'test',
        location: undefined as any,
        priceRange: 0,
      },
    });
    // opentable with no deep link, and webUrl open fails
    const result = await openAffiliateLink('opentable', rec, 'user-123');
    expect(result).toBe(false);
  });

  it('tracks click when userId provided', async () => {
    const rec = makeRecommendation();
    await openAffiliateLink('opentable', rec, 'user-123');
    // trackAffiliateClick is fire-and-forget but still calls insert
    // Give it a tick to resolve
    await new Promise(r => setTimeout(r, 10));
    expect(mockInsert).toHaveBeenCalled();
  });
});
