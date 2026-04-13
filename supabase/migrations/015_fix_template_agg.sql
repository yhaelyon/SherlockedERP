-- ============================================================
-- FIX: apply_room_template & apply_branch_templates
-- Prevents "cannot call json_array_elements on a null value" 
-- by using the || operator for array concatenation.
-- ============================================================

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
  
  -- Default to UTC if branch timezone is missing
  v_tz := COALESCE(v_tz, 'UTC');

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
    
    -- Merge Arrays Safely with || operator
    v_conflicts := v_conflicts || v_temp_conflicts;

  END LOOP;

  RETURN jsonb_build_object(
    'deleted', v_deleted,
    'conflicts', v_conflicts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


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
    
    -- Merge conflicts arrays safely
    v_total_conflicts := v_total_conflicts || (v_res->'conflicts');
  END LOOP;

  RETURN jsonb_build_object(
    'deleted', v_total_deleted,
    'conflicts', v_total_conflicts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
