-- ============================================================
-- MIGRATION 013 — Room Schedule Templates
-- Replaces rigid branch hours with exact per-game slot templates
-- ============================================================

CREATE TABLE room_weekly_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_slots JSONB NOT NULL DEFAULT '[]', -- [{"time": "09:00", "is_next_day": false}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, day_of_week)
);

CREATE TRIGGER templates_updated_at BEFORE UPDATE ON room_weekly_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE room_weekly_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_authenticated_read" ON room_weekly_templates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "templates_service_role_all" ON room_weekly_templates
  FOR ALL USING (auth.role() = 'service_role');

-- ─── FUNCTION: APPLY TEMPLATE ─────────────────────────────────
CREATE OR REPLACE FUNCTION apply_room_template(
  p_room_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_game_min INT DEFAULT 60
) RETURNS JSONB AS $$
DECLARE
  v_day DATE;
  v_dow INT;
  v_tz TEXT;
  v_slots JSONB;
  v_slot JSONB;
  v_time TIME;
  v_is_next_day BOOLEAN;
  v_start_at TIMESTAMPTZ;
  v_end_at TIMESTAMPTZ;
  
  v_expected_starts TIMESTAMPTZ[];
  
  v_created INT := 0;
  v_deleted INT := 0;
  v_conflicts JSONB := '[]'::JSONB;
  v_temp_deleted INT;
  v_temp_conflicts JSONB;
BEGIN
  -- Get timezone
  SELECT b.timezone INTO v_tz
  FROM branches b JOIN rooms r ON r.branch_id = b.id WHERE r.id = p_room_id;

  -- Loop exactly over the date range requested
  FOR v_day IN SELECT generate_series(p_start_date, p_end_date, '1 day'::INTERVAL)::DATE LOOP
    v_dow := EXTRACT(DOW FROM v_day)::INT;
    v_expected_starts := ARRAY[]::TIMESTAMPTZ[];

    -- Fetch the configured slots for this day of the week
    SELECT time_slots INTO v_slots
    FROM room_weekly_templates
    WHERE room_id = p_room_id AND day_of_week = v_dow;

    IF v_slots IS NOT NULL AND jsonb_array_length(v_slots) > 0 THEN
      -- Iterate JSON array and insert slots
      FOR v_slot IN SELECT * FROM jsonb_array_elements(v_slots) LOOP
        v_time := (v_slot->>'time')::TIME;
        v_is_next_day := COALESCE((v_slot->>'is_next_day')::BOOLEAN, false);

        IF v_is_next_day THEN
          v_start_at := ((v_day + integer '1')::DATE || ' ' || v_time)::TIMESTAMPTZ AT TIME ZONE v_tz;
        ELSE
          v_start_at := (v_day || ' ' || v_time)::TIMESTAMPTZ AT TIME ZONE v_tz;
        END IF;

        v_expected_starts := array_append(v_expected_starts, v_start_at);
        v_end_at := v_start_at + (p_game_min || ' minutes')::INTERVAL;

        -- Insert only if it does not exist. (ON CONFLICT prevents overwrite)
        INSERT INTO slots (room_id, start_at, end_at, status)
        VALUES (p_room_id, v_start_at, v_end_at, 'available')
        ON CONFLICT (room_id, start_at) DO NOTHING;
        
        -- In PL/pgSQL, checking FOUND for INSERT ON CONFLICT DO NOTHING doesn't always reflect
        -- true if it did nothing! But let's assume worst case, we can't reliably track 'created' precisely here
        -- without a CTE. We'll skip exact 'created' count for simplicity or keep a rough track.
      END LOOP;
    END IF;

    -- Cleanup logic: Any slot in this logical day window (06:00 to 06:00+1) NOT in template
    WITH target_window AS (
      SELECT id, status, start_at FROM slots 
      WHERE room_id = p_room_id 
      AND start_at >= (v_day || ' 06:00')::TIMESTAMPTZ AT TIME ZONE v_tz
      AND start_at < ((v_day + integer '1')::DATE || ' 06:00')::TIMESTAMPTZ AT TIME ZONE v_tz
    ),
    anomalies AS (
      SELECT id, status, start_at FROM target_window 
      WHERE start_at <> ALL (v_expected_starts) OR array_length(v_expected_starts, 1) IS NULL
    ),
    deleted_slots AS (
      DELETE FROM slots WHERE id IN (SELECT id FROM anomalies WHERE status = 'available') RETURNING id
    )
    SELECT count(*) INTO v_temp_deleted FROM deleted_slots;
    v_deleted := v_deleted + v_temp_deleted;
    
    -- Find Booked Conflicts
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'room_id', p_room_id,
      'start_at', a.start_at,
      'status', a.status
    )), '[]'::JSONB) INTO v_temp_conflicts
    FROM anomalies a WHERE status != 'available';
    
    -- Merge Arrays
    SELECT jsonb_agg(elem) INTO v_conflicts FROM (
      SELECT * FROM jsonb_array_elements(v_conflicts)
      UNION ALL
      SELECT * FROM jsonb_array_elements(v_temp_conflicts)
    ) as merged(elem);
    v_conflicts := COALESCE(v_conflicts, '[]'::JSONB);

  END LOOP;

  RETURN jsonb_build_object(
    'deleted', v_deleted,
    'conflicts', v_conflicts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── FUNCTION: APPLY TEMPLATE BATCH (BRANCH) ─────────────────
CREATE OR REPLACE FUNCTION apply_branch_templates(
  p_branch_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS JSONB AS $$
DECLARE
  v_room RECORD;
  v_res JSONB;
  v_total_deleted INT := 0;
  v_total_conflicts JSONB := '[]'::JSONB;
BEGIN
  -- Loop through all active games in the specific branch
  FOR v_room IN 
    SELECT r.id, COALESCE(a.duration_min, 60) as duration_min
    FROM rooms r
    LEFT JOIN activities a ON a.name = r.name AND a.branch_id = p_branch_id
    WHERE r.branch_id = p_branch_id AND r.status = 'active'
  LOOP
    v_res := apply_room_template(v_room.id, p_start_date, p_end_date, v_room.duration_min);
    v_total_deleted := v_total_deleted + COALESCE((v_res->>'deleted')::INT, 0);
    
    -- Merge conflicts arrays
    SELECT jsonb_agg(elem) INTO v_res FROM (
      SELECT * FROM jsonb_array_elements(v_total_conflicts)
      UNION ALL
      SELECT * FROM jsonb_array_elements(v_res->'conflicts')
    ) as merged(elem);
    
    v_total_conflicts := COALESCE(v_res, '[]'::JSONB);
  END LOOP;

  RETURN jsonb_build_object(
    'deleted', v_total_deleted,
    'conflicts', v_total_conflicts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
