-- ============================================================
-- PASTE THIS ENTIRE SCRIPT IN SUPABASE SQL EDITOR
-- URL: https://supabase.com/dashboard/project/rqjxemirswoxxsmjvfrc/sql/new
-- 
-- WHAT THIS FIXES:
-- 1. Timezone bug: slots were stored 3 hours early (UTC instead of Israel local time)
-- 2. Ghost slots: old bad slots are now completely wiped per day before re-inserting
-- 3. Safety lock: days with bookings are skipped and reported
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
  v_skipped_dates TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT b.timezone INTO v_tz
  FROM branches b JOIN rooms r ON r.branch_id = b.id WHERE r.id = p_room_id;
  IF v_tz IS NULL THEN v_tz := 'Asia/Jerusalem'; END IF;

  FOR v_day IN SELECT generate_series(p_start_date, p_end_date, '1 day'::INTERVAL)::DATE LOOP
    v_dow := EXTRACT(DOW FROM v_day)::INT;

    -- SAFETY CHECK: Does this day have any real bookings?
    SELECT EXISTS (
      SELECT 1 FROM slots s
      WHERE s.room_id = p_room_id
      AND s.start_at >= (v_day::TEXT || ' 06:00:00')::TIMESTAMP AT TIME ZONE v_tz
      AND s.start_at <  ((v_day + integer '1')::TEXT || ' 06:00:00')::TIMESTAMP AT TIME ZONE v_tz
      AND (
        s.status NOT IN ('available', 'cancelled')
        OR EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status NOT IN ('cancelled'))
      )
    ) INTO v_has_bookings;

    -- Skip and record days with bookings
    IF v_has_bookings THEN
      v_skipped_days := v_skipped_days + 1;
      v_skipped_dates := array_append(v_skipped_dates, v_day::TEXT);
      CONTINUE;
    END IF;

    -- CLEAN SLATE: Delete ALL slots in the operational window AND any legacy bad-timezone slots
    DELETE FROM slots 
    WHERE room_id = p_room_id
    AND (
      -- Normal window (correct timezone): 06:00 local today to 06:00 local tomorrow
      (start_at >= (v_day::TEXT || ' 06:00:00')::TIMESTAMP AT TIME ZONE v_tz
       AND start_at <  ((v_day + integer '1')::TEXT || ' 06:00:00')::TIMESTAMP AT TIME ZONE v_tz)
      OR
      -- Legacy bad-TZ window: catches slots stored 3h early (as raw UTC)
      -- e.g. was 10:15 local -> stored as 07:15 UTC -> shows as 07:15 wrong
      -- These old slots sit between midnight and 06:00 UTC on the same calendar date
      (start_at >= (v_day::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE 'UTC'
       AND start_at <  (v_day::TEXT || ' 06:00:00')::TIMESTAMP AT TIME ZONE 'UTC')
    );

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- INSERT: Fresh slots from the template with CORRECT timezone handling
    SELECT time_slots INTO v_slots
    FROM room_weekly_templates
    WHERE room_id = p_room_id AND day_of_week = v_dow;

    IF v_slots IS NOT NULL AND jsonb_array_length(v_slots) > 0 THEN
      FOR v_slot IN SELECT * FROM jsonb_array_elements(v_slots) LOOP
        v_time := (v_slot->>'time')::TIME;
        v_is_next_day := COALESCE((v_slot->>'is_next_day')::BOOLEAN, false);

        -- KEY FIX: ::TIMESTAMP (without tz) AT TIME ZONE = 
        -- "this time string IS in local timezone, convert to UTC for storage"
        -- Previously ::TIMESTAMPTZ was used which treated the string as UTC first = WRONG
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
    'skipped_dates', to_jsonb(v_skipped_dates),
    'status', 'success'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── BATCH FUNCTION (BRANCH) ─────────────────────────────────
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
  v_all_skipped_dates JSONB := '[]'::JSONB;
BEGIN
  FOR v_room IN 
    SELECT r.id, r.name, COALESCE(a.duration_min, 60) as duration_min
    FROM rooms r
    LEFT JOIN activities a ON a.name = r.name AND a.branch_id = p_branch_id
    WHERE r.branch_id = p_branch_id AND r.status = 'active'
  LOOP
    v_res := apply_room_template(v_room.id, p_start_date, p_end_date, v_room.duration_min);
    v_total_created := v_total_created + COALESCE((v_res->>'created')::INT, 0);
    v_total_deleted := v_total_deleted + COALESCE((v_res->>'deleted')::INT, 0);
    v_total_skipped := v_total_skipped + COALESCE((v_res->>'skipped_days')::INT, 0);

    SELECT jsonb_agg(elem) INTO v_all_skipped_dates 
    FROM (
      SELECT * FROM jsonb_array_elements(v_all_skipped_dates)
      UNION ALL
      SELECT * FROM jsonb_array_elements(COALESCE(v_res->'skipped_dates', '[]'::JSONB))
    ) t(elem);
    v_all_skipped_dates := COALESCE(v_all_skipped_dates, '[]'::JSONB);
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_total_created,
    'deleted', v_total_deleted,
    'skipped_days', v_total_skipped,
    'skipped_dates', v_all_skipped_dates,
    'status', 'success'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
