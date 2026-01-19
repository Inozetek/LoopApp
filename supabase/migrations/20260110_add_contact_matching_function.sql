/**
 * Migration: Add Contact Matching Function
 *
 * Privacy-preserving contact matching using SHA-256 hashes:
 * - Hash user phone/email on server side
 * - Match against hashed contact lists
 * - Never expose raw contact data
 */

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS find_users_by_hashed_contacts(TEXT[], TEXT[]);

-- Function to hash a value using SHA-256
CREATE OR REPLACE FUNCTION hash_contact_value(p_value TEXT)
RETURNS TEXT AS $$
BEGIN
  -- PostgreSQL's built-in SHA-256 function
  RETURN encode(digest(lower(trim(p_value)), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find Loop users by hashed phone numbers and emails
CREATE FUNCTION find_users_by_hashed_contacts(
  p_hashed_phones TEXT[],
  p_hashed_emails TEXT[]
)
RETURNS TABLE (
  user_id UUID,
  contact_hash TEXT,
  match_type VARCHAR(10)
) AS $$
BEGIN
  -- Find matches by phone
  RETURN QUERY
  SELECT
    u.id AS user_id,
    hash_contact_value(u.phone) AS contact_hash,
    'phone'::VARCHAR(10) AS match_type
  FROM users u
  WHERE u.phone IS NOT NULL
    AND hash_contact_value(u.phone) = ANY(p_hashed_phones);

  -- Find matches by email
  RETURN QUERY
  SELECT
    u.id AS user_id,
    hash_contact_value(u.email) AS contact_hash,
    'email'::VARCHAR(10) AS match_type
  FROM users u
  WHERE u.email IS NOT NULL
    AND hash_contact_value(u.email) = ANY(p_hashed_emails);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION hash_contact_value IS 'Hash a contact value (phone/email) using SHA-256 for privacy-preserving matching';
COMMENT ON FUNCTION find_users_by_hashed_contacts IS 'Find Loop users by matching hashed phone numbers and emails (privacy-preserving)';
