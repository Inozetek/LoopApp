-- Affiliate Commission & Booking Tracking System
-- Tracks bookings made through Loop affiliate links and calculates commissions

-- Affiliate partner configuration
CREATE TABLE IF NOT EXISTS affiliate_partners (
  id VARCHAR(50) PRIMARY KEY, -- 'opentable', 'fandango', 'uber', 'lyft', 'eventbrite', 'airbnb'
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'reservations', 'tickets', 'rides', 'events', 'lodging'

  -- Commission structure
  commission_type VARCHAR(20) NOT NULL DEFAULT 'percentage'
    CHECK (commission_type IN ('percentage', 'flat_rate', 'tiered')),
  commission_rate DECIMAL(5,2), -- percentage (e.g., 10.00 = 10%) or flat rate in cents
  min_commission_cents INTEGER DEFAULT 0,
  max_commission_cents INTEGER, -- cap per transaction

  -- API configuration (keys stored in env vars, this tracks which are active)
  is_active BOOLEAN DEFAULT FALSE,
  api_endpoint TEXT,
  webhook_endpoint TEXT,
  deep_link_template TEXT, -- e.g., 'opentable://reserve?rid={place_id}&ref=loop'

  -- Tracking
  total_bookings INTEGER DEFAULT 0,
  total_commission_cents INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default partner configs
INSERT INTO affiliate_partners (id, name, category, commission_type, commission_rate, deep_link_template) VALUES
  ('opentable', 'OpenTable', 'reservations', 'percentage', 10.00, 'https://www.opentable.com/r/{place_id}?ref=loop'),
  ('fandango', 'Fandango', 'tickets', 'percentage', 15.00, 'https://www.fandango.com/redirect?ref=loop&mid={place_id}'),
  ('uber', 'Uber', 'rides', 'flat_rate', 500, 'uber://?action=setPickup&pickup=my_location&dropoff[latitude]={lat}&dropoff[longitude]={lng}'),
  ('lyft', 'Lyft', 'rides', 'flat_rate', 500, 'lyft://ridetype?id=lyft&destination[latitude]={lat}&destination[longitude]={lng}'),
  ('eventbrite', 'Eventbrite', 'events', 'percentage', 5.00, 'https://www.eventbrite.com/e/{event_id}?aff=loop'),
  ('ticketmaster', 'Ticketmaster', 'events', 'percentage', 8.00, 'https://www.ticketmaster.com/event/{event_id}?camefrom=loop'),
  ('airbnb', 'Airbnb', 'lodging', 'percentage', 3.00, NULL),
  ('groupon', 'Groupon', 'deals', 'percentage', 5.00, NULL)
ON CONFLICT (id) DO NOTHING;

-- Booking transactions - tracks every booking attempt through Loop
CREATE TABLE IF NOT EXISTS affiliate_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_id VARCHAR(50) NOT NULL REFERENCES affiliate_partners(id),

  -- What was booked
  activity_name VARCHAR(255) NOT NULL,
  activity_category VARCHAR(100),
  place_id VARCHAR(255), -- Google Place ID or partner-specific ID
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,

  -- Booking details
  booking_type VARCHAR(50) NOT NULL
    CHECK (booking_type IN ('reservation', 'ticket', 'ride', 'deal', 'lodging')),
  booking_url TEXT NOT NULL, -- The affiliate deep link that was opened

  -- Financial
  transaction_amount_cents INTEGER, -- Total value of the booking (if known)
  commission_rate_at_booking DECIMAL(5,2), -- Snapshot of rate at time of booking
  estimated_commission_cents INTEGER, -- Calculated commission

  -- Status tracking
  status VARCHAR(30) DEFAULT 'clicked'
    CHECK (status IN ('clicked', 'pending', 'confirmed', 'completed', 'cancelled', 'expired')),
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ, -- Partner webhook confirms booking
  completed_at TIMESTAMPTZ, -- User completed the activity
  cancelled_at TIMESTAMPTZ,

  -- Attribution
  attribution_source VARCHAR(50) DEFAULT 'feed'
    CHECK (attribution_source IN ('feed', 'explore', 'calendar', 'group_plan', 'notification', 'search')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_affiliate_bookings_user ON affiliate_bookings(user_id, created_at DESC);
CREATE INDEX idx_affiliate_bookings_partner ON affiliate_bookings(partner_id, status);
CREATE INDEX idx_affiliate_bookings_status ON affiliate_bookings(status, created_at DESC);
CREATE INDEX idx_affiliate_bookings_place ON affiliate_bookings(place_id);

-- Commission ledger - finalized commission records (monthly settlement)
CREATE TABLE IF NOT EXISTS commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id VARCHAR(50) NOT NULL REFERENCES affiliate_partners(id),

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Totals
  total_bookings INTEGER DEFAULT 0,
  confirmed_bookings INTEGER DEFAULT 0,
  total_transaction_cents INTEGER DEFAULT 0,
  total_commission_cents INTEGER DEFAULT 0,

  -- Settlement
  settlement_status VARCHAR(20) DEFAULT 'pending'
    CHECK (settlement_status IN ('pending', 'invoiced', 'paid', 'disputed')),
  settled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(partner_id, period_start, period_end)
);

CREATE INDEX idx_commission_ledger_partner ON commission_ledger(partner_id, period_start DESC);

-- NOTE: referral_rewards table already created in migration 009.
-- Do not recreate here to avoid column conflicts (009 uses user_id, this had referrer_id).

-- Add ambassador status to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_ambassador BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ambassador_discount_percent INTEGER DEFAULT 0;
