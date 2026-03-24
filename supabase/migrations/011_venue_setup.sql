-- ============================================================
-- MIGRATION 011 — Venue GPS setup + test branch
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Add venue columns (idempotent — safe to run again)
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS venue_lat            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS venue_lng            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS venue_radius_meters  INT NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS venue_static_ip      TEXT;

-- Step 2: Add test location branch (32°00'37.7"N 34°46'04.2"E)
INSERT INTO branches (id, name, address, timezone, venue_lat, venue_lng, venue_radius_meters)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'בדיקה GPS',
  'מיקום בדיקה — 32°00''37.7"N 34°46''04.2"E',
  'Asia/Jerusalem',
  32.010472,
  34.767833,
  150
)
ON CONFLICT (id) DO UPDATE
  SET venue_lat           = EXCLUDED.venue_lat,
      venue_lng           = EXCLUDED.venue_lng,
      venue_radius_meters = EXCLUDED.venue_radius_meters;

-- Step 3: Update existing branches with GPS coords
-- ⚠️  Replace with actual GPS coordinates for each branch
-- שרלוקד מערב — אלטלנה 14, ראשון לציון
-- UPDATE branches SET venue_lat = 31.XXXXX, venue_lng = 34.XXXXX WHERE id = '00000000-0000-0000-0000-000000000001';

-- שרלוקד מזרח — משה בקר 18, ראשון לציון
-- UPDATE branches SET venue_lat = 31.XXXXX, venue_lng = 34.XXXXX WHERE id = '00000000-0000-0000-0000-000000000002';

-- Step 4: Set static IP for branches (optional — for WiFi-based check-in)
-- UPDATE branches SET venue_static_ip = 'X.X.X.X' WHERE id = '00000000-0000-0000-0000-000000000001';
-- UPDATE branches SET venue_static_ip = 'X.X.X.X' WHERE id = '00000000-0000-0000-0000-000000000002';
