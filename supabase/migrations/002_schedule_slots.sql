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

-- ─── SLOT GENERATION LOGIC ──────────────────────────────────

-- Function: Calculate and generate slots for a specific room and date
CREATE OR REPLACE FUNCTION generate_slots_for_day(p_room_id UUID, p_date DATE)
RETURNS void AS $$
DECLARE
  v_branch_id UUID;
  v_open_time TIME;
  v_close_time TIME;
  v_duration INTERVAL := '60 minutes';
  v_interval INTERVAL := '90 minutes';
  v_offset INTERVAL := '40 minutes';
  v_current_start TIMESTAMPTZ;
  v_day_of_week INT;
  v_tz TEXT;
BEGIN
  -- Get branch ID and timezone
  SELECT b.id, b.timezone INTO v_branch_id, v_tz
  FROM branches b
  JOIN rooms r ON r.branch_id = b.id
  WHERE r.id = p_room_id;

  v_day_of_week := extract(dow from p_date);

  -- Fetch branch hours for the specific day of week
  SELECT open_time, close_time INTO v_open_time, v_close_time
  FROM branch_hours
  WHERE branch_id = v_branch_id AND day_of_week = v_day_of_week;

  -- Skip if branch is closed or hours not defined
  IF v_open_time IS NULL THEN
    RETURN;
  END IF;

  -- Initial start time: open_time + offset
  -- Use timezone from branch record
  v_current_start := (p_date + v_open_time + v_offset) AT TIME ZONE v_tz;

  -- Loop through the day and insert slots until close_time is reached
  WHILE (v_current_start + v_duration) <= (p_date + v_close_time) AT TIME ZONE v_tz LOOP
    INSERT INTO slots (room_id, start_at, end_at, status)
    VALUES (p_room_id, v_current_start, v_current_start + v_duration, 'available')
    ON CONFLICT (room_id, start_at) DO NOTHING;

    v_current_start := v_current_start + v_interval;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Bulk generate slots for all active rooms for N days ahead
CREATE OR REPLACE FUNCTION generate_all_slots_for_active_rooms(p_days_ahead INT DEFAULT 60)
RETURNS void AS $$
DECLARE
  v_room RECORD;
  v_date DATE;
BEGIN
  FOR v_room IN SELECT id FROM rooms WHERE status = 'active' LOOP
    FOR i IN 0..(p_days_ahead - 1) LOOP
      v_date := CURRENT_DATE + i;
      PERFORM generate_slots_for_day(v_room.id, v_date);
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── AUTOMATION (pg_cron) ───────────────────────────────────

-- Enable pg_cron if not already enabled (Supabase usually handles this)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the job to run every night at 03:00 AM
-- Note: 'cron' schema must be available and user must have permissions
-- SELECT cron.schedule('generate-slots-daily', '0 3 * * *', 'SELECT generate_all_slots_for_active_rooms(60)');

