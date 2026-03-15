-- ============================================================
-- MIGRATION 002 — Schedule & Slots
-- Slot interval: 90 min | Game duration: 60 min | Buffer: 30 min
-- ============================================================

-- ─── BRANCH HOURS ───────────────────────────────────────────
CREATE TABLE branch_hours (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  day_of_week  INT  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  open_time    TIME NOT NULL DEFAULT '09:00',
  close_time   TIME NOT NULL DEFAULT '23:00',
  UNIQUE (branch_id, day_of_week)
);

-- ─── ROOM SCHEDULE OVERRIDES ────────────────────────────────
-- Allows custom slot overrides for specific dates per room
CREATE TABLE room_schedule_overrides (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id           UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  custom_slots_json JSONB NOT NULL DEFAULT '[]', -- [{start: "10:00", end: "11:00"}]
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, date)
);

-- ─── SLOTS ──────────────────────────────────────────────────
-- status: available | pending (5-min hold) | booked | blocked | cancelled
CREATE TABLE slots (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id             UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ NOT NULL,  -- start_at + 60 min
  status              TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'pending', 'booked', 'blocked', 'cancelled')),
  block_expires_at    TIMESTAMPTZ,           -- NULL if not pending/blocked
  blocked_by_session  TEXT,                  -- session token that holds the block
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT slot_duration_check CHECK (end_at = start_at + INTERVAL '60 minutes'),
  UNIQUE (room_id, start_at)                 -- no duplicate slots for same room+time
);

CREATE TRIGGER slots_updated_at BEFORE UPDATE ON slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX idx_slots_room_start     ON slots (room_id, start_at);
CREATE INDEX idx_slots_status         ON slots (status);
CREATE INDEX idx_slots_block_expires  ON slots (block_expires_at) WHERE block_expires_at IS NOT NULL;

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE branch_hours              ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_schedule_overrides   ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots                     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slots_public_read_available" ON slots
  FOR SELECT USING (status IN ('available', 'pending', 'booked'));

CREATE POLICY "slots_authenticated_read" ON slots
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "slots_service_role_all" ON slots
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "branch_hours_authenticated_read" ON branch_hours
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "branch_hours_service_role_all" ON branch_hours
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "overrides_authenticated_read" ON room_schedule_overrides
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "overrides_service_role_all" ON room_schedule_overrides
  FOR ALL USING (auth.role() = 'service_role');

-- ─── EXPIRE PENDING SLOTS FUNCTION ──────────────────────────
-- Called by pg_cron every minute
CREATE OR REPLACE FUNCTION expire_pending_slots()
RETURNS void AS $$
BEGIN
  UPDATE slots
  SET status = 'available',
      block_expires_at = NULL,
      blocked_by_session = NULL
  WHERE status = 'pending'
    AND block_expires_at IS NOT NULL
    AND block_expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
