-- ============================================================
-- MIGRATION 017 — Fix Timezone Double-Conversion Bug
-- The previous apply_room_template used ::TIMESTAMPTZ which
-- treated local times as UTC before applying AT TIME ZONE,
-- causing all slots to be stored 3 hours early (UTC+3 offset).
-- The fix: use ::TIMESTAMP (no tz) AT TIME ZONE so PostgreSQL
-- correctly interprets the time string as local and converts to UTC.
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
  
  v_has_bookings BOOLEAN;
  
  v_created INT := 0;
  v_deleted INT := 0;
  v_skipped_days INT := 0;
BEGIN
  -- 1. Get branch timezone
  SELECT b.timezone INTO v_tz
  FROM branches b JOIN rooms r ON r.branch_id = b.id WHERE r.id = p_room_id;

  -- Default to Israel if not set
  IF v_tz IS NULL THEN v_tz := 'Asia/Jerusalem'; END IF;

  -- 2. Iterate through each day in the requested range
  FOR v_day IN SELECT generate_series(p_start_date, p_end_date, '1 day'::INTERVAL)::DATE LOOP
    v_dow := EXTRACT(DOW FROM v_day)::INT;
    
    -- 3. Check if ANY slot in this operational window (06:00–06:00) has a real booking
    SELECT EXISTS (
      SELECT 1 FROM slots s
      WHERE s.room_id = p_room_id
      -- FIX: Use ::TIMESTAMP (no tz) AT TIME ZONE for correct local time boundary
      AND s.start_at >= (v_day::TEXT || ' 06:00:00')::TIMESTAMP AT TIME ZONE v_tz
      AND s.start_at < ((v_day + integer '1')::TEXT || ' 06:00:00')::TIMESTAMP AT TIME ZONE v_tz
      AND (
        s.status NOT IN ('available', 'cancelled')
        OR EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status != 'cancelled')
      )
    ) INTO v_has_bookings;

    -- 4. SAFETY LOCK: Skip days with existing bookings
    IF v_has_bookings THEN
      v_skipped_days := v_skipped_days + 1;
      CONTINUE;
    END IF;

    -- 5. CLEAN SLATE: Delete ALL slots in this operational window before re-inserting
    DELETE FROM slots 
    WHERE room_id = p_room_id
    -- FIX: Use ::TIMESTAMP (no tz) AT TIME ZONE for correct local time boundary
    AND start_at >= (v_day::TEXT || ' 06:00:00')::TIMESTAMP AT TIME ZONE v_tz
    AND start_at < ((v_day + integer '1')::TEXT || ' 06:00:00')::TIMESTAMP AT TIME ZONE v_tz;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- 6. Insert fresh slots from the template
    SELECT time_slots INTO v_slots
    FROM room_weekly_templates
    WHERE room_id = p_room_id AND day_of_week = v_dow;

    IF v_slots IS NOT NULL AND jsonb_array_length(v_slots) > 0 THEN
      FOR v_slot IN SELECT * FROM jsonb_array_elements(v_slots) LOOP
        v_time := (v_slot->>'time')::TIME;
        v_is_next_day := COALESCE((v_slot->>'is_next_day')::BOOLEAN, false);

        -- KEY FIX: ::TIMESTAMP (no timezone) AT TIME ZONE v_tz
        -- This correctly means: "this time string IS in v_tz local time, store as UTC"
        IF v_is_next_day THEN
          v_start_at := ((v_day + integer '1')::TEXT || ' ' || v_time::TEXT)::TIMESTAMP AT TIME ZONE v_tz;
        ELSE
          v_start_at := (v_day::TEXT || ' ' || v_time::TEXT)::TIMESTAMP AT TIME ZONE v_tz;
        END IF;

        v_end_at := v_start_at + (p_game_min || ' minutes')::INTERVAL;

        INSERT INTO slots (room_id, start_at, end_at, status)
        VALUES (p_room_id, v_start_at, v_end_at, 'available')
        ON CONFLICT (room_id, start_at) DO NOTHING;
        
        v_created := v_created + 1;
      END LOOP;
    END IF;

  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created,
    'deleted', v_deleted,
    'skipped_days', v_skipped_days,
    'status', 'success'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix apply_branch_templates to pass correct duration
CREATE OR REPLACE FUNCTION apply_branch_templates(
  p_branch_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS JSONB AS $$
DECLARE
  v_room RECORD;
  v_res JSONB;
  v_total_created INT := 0;
  v_total_deleted INT := 0;
  v_total_skipped INT := 0;
BEGIN
  FOR v_room IN 
    SELECT r.id, COALESCE(a.duration_min, 60) as duration_min
    FROM rooms r
    LEFT JOIN activities a ON a.name = r.name AND a.branch_id = p_branch_id
    WHERE r.branch_id = p_branch_id AND r.status = 'active'
  LOOP
    v_res := apply_room_template(v_room.id, p_start_date, p_end_date, v_room.duration_min);
    v_total_created := v_total_created + COALESCE((v_res->>'created')::INT, 0);
    v_total_deleted := v_total_deleted + COALESCE((v_res->>'deleted')::INT, 0);
    v_total_skipped := v_total_skipped + COALESCE((v_res->>'skipped_days')::INT, 0);
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_total_created,
    'deleted', v_total_deleted,
    'skipped_days', v_total_skipped,
    'status', 'success'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
