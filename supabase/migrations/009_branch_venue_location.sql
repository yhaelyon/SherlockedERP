-- ============================================================
-- MIGRATION 009 — Add venue GPS coordinates to branches
-- ============================================================

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS venue_lat            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS venue_lng            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS venue_radius_meters  INT NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS venue_static_ip      TEXT;
