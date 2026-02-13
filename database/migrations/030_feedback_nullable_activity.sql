-- Migration 030: Make activity_id nullable on feedback table
-- Allows feedback on manual calendar events that don't have a corresponding activities row

ALTER TABLE feedback ALTER COLUMN activity_id DROP NOT NULL;
