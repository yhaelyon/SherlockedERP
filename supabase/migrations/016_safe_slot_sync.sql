-- ============================================================
-- MIGRATION 016 — Safe Slot Sync (Preserve Booked Days)
-- Ensures that clicking 'Apply Template' does not corrupt days
-- that already have real business bookings.
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
  v_conflicts JSONB := '[]'::JSONB;
BEGIN
  -- 1. Get branch timezone
  SELECT b.timezone INTO v_tz
  FROM branches b JOIN rooms r ON r.branch_id = b.id WHERE r.id = p_room_id;

  -- 2. Iterate through each day in the requested range
  FOR v_day IN SELECT generate_series(p_start_date, p_end_date, '1 day'::INTERVAL)::DATE LOOP
    v_dow := EXTRACT(DOW FROM v_day)::INT;
    
    -- 3. Define the Operational Window: 06:00 on v_day to 06:00 the following morning
    -- We check if ANY slot in this window is booked or has a real booking record.
    SELECT EXISTS (
      SELECT 1 FROM slots s
      WHERE s.room_id = p_room_id
      AND s.start_at >= (v_day || ' 06:00')::TIMESTAMPTZ AT TIME ZONE v_tz
      AND s.start_at < ((v_day + integer '1')::DATE || ' 06:00')::TIMESTAMPTZ AT TIME ZONE v_tz
      AND (
        s.status NOT IN ('available', 'cancelled')
        OR EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status != 'cancelled')
      )
    ) INTO v_has_bookings;

    -- 4. CRITICAL SAFETY LOCK
    -- If there are bookings, we SKIP this day to preserve data integrity.
    IF v_has_bookings THEN
      v_skipped_days := v_skipped_days + 1;
      CONTINUE; -- Move to the next day
    END IF;

    -- 5. DAY IS EMPTY: Clean slate strategy
    -- Delete all existing slots in this operational window
    DELETE FROM slots 
    WHERE room_id = p_room_id
    AND start_at >= (v_day || ' 06:00')::TIMESTAMPTZ AT TIME ZONE v_tz
    AND start_at < ((v_day + integer '1')::DATE || ' 06:00')::TIMESTAMPTZ AT TIME ZONE v_tz;

    -- 6. Insert new slots from the template
    SELECT time_slots INTO v_slots
    FROM room_weekly_templates
    WHERE room_id = p_room_id AND day_of_week = v_dow;

    IF v_slots IS NOT NULL AND jsonb_array_length(v_slots) > 0 THEN
      FOR v_slot IN SELECT * FROM jsonb_array_elements(v_slots) LOOP
        v_time := (v_slot->>'time')::TIME;
        v_is_next_day := COALESCE((v_slot->>'is_next_day')::BOOLEAN, false);

        IF v_is_next_day THEN
          v_start_at := ((v_day + integer '1')::DATE || ' ' || v_time)::TIMESTAMPTZ AT TIME ZONE v_tz;
        ELSE
          v_start_at := (v_day || ' ' || v_time)::TIMESTAMPTZ AT TIME ZONE v_tz;
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
    'skipped_days', v_skipped_days,
    'status', 'success'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
