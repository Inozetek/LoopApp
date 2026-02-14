/**
 * Affiliate Program Configuration
 *
 * Uber Affiliate Program Setup Instructions:
 *
 * 1. Sign up at: https://affiliates.uber.com/
 * 2. Complete application and get approved
 * 3. Obtain your unique affiliate client_id
 * 4. Replace 'LOOP_AFFILIATE_CODE_PLACEHOLDER' with your real code
 * 5. Set enabled: true to activate affiliate tracking
 *
 * Earnings: Uber pays commission per first ride from referred users
 * Typical rate: $5-15 per successful referral
 *
 * Deep Link Format:
 * uber://?action=setPickup&dropoff[latitude]=X&dropoff[longitude]=Y&client_id=YOUR_CODE
 */

export const AFFILIATE_CONFIG: Record<string, { affiliateCode: string; enabled: boolean }> = {
  uber: {
    // Placeholder - replace with real affiliate code after signup
    affiliateCode: 'LOOP_AFFILIATE_CODE_PLACEHOLDER',
    enabled: false, // Set to true after adding real code
  },
  lyft: {
    affiliateCode: 'LOOP_LYFT_PLACEHOLDER',
    enabled: false,
  },
  opentable: {
    affiliateCode: 'LOOP_OPENTABLE_PLACEHOLDER',
    enabled: false,
  },
  fandango: {
    affiliateCode: 'LOOP_FANDANGO_PLACEHOLDER',
    enabled: false,
  },
  eventbrite: {
    affiliateCode: 'LOOP_EVENTBRITE_PLACEHOLDER',
    enabled: false,
  },
  ticketmaster: {
    affiliateCode: 'LOOP_TICKETMASTER_PLACEHOLDER',
    enabled: false,
  },
  airbnb: {
    affiliateCode: 'LOOP_AIRBNB_PLACEHOLDER',
    enabled: false,
  },
  groupon: {
    affiliateCode: 'LOOP_GROUPON_PLACEHOLDER',
    enabled: false,
  },
};
