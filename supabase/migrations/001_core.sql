-- ============================================================
-- MIGRATION 001 — Core: branches, activities, rooms
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── BRANCHES ───────────────────────────────────────────────
CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  address     TEXT,
  wifi_ssid   TEXT NOT NULL DEFAULT 'sherlocked',
  timezone    TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ACTIVITIES ─────────────────────────────────────────────
CREATE TABLE activities (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  duration_min  INT  NOT NULL DEFAULT 60,
  buffer_min    INT  NOT NULL DEFAULT 30,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ROOMS ──────────────────────────────────────────────────
CREATE TABLE rooms (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id      UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  capacity_min   INT  NOT NULL DEFAULT 2,
  capacity_max   INT  NOT NULL DEFAULT 10,
  color_hex      TEXT NOT NULL DEFAULT '#4A9EFF',
  display_order  INT  NOT NULL DEFAULT 0,
  is_mythos      BOOLEAN NOT NULL DEFAULT FALSE, -- VIP room: no discounts, age_min=16
  age_min        INT  NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  slug           TEXT UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── UPDATED_AT TRIGGER ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE branches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms      ENABLE ROW LEVEL SECURITY;

-- Branches readable by all authenticated users
CREATE POLICY "branches_authenticated_read" ON branches
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "branches_service_role_all" ON branches
  FOR ALL USING (auth.role() = 'service_role');

-- Rooms readable by all authenticated users; public can read active rooms
CREATE POLICY "rooms_authenticated_read" ON rooms
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "rooms_public_read_active" ON rooms
  FOR SELECT USING (status = 'active');

CREATE POLICY "rooms_service_role_all" ON rooms
  FOR ALL USING (auth.role() = 'service_role');
