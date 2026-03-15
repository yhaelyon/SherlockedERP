-- ============================================================
-- MIGRATION 010 — Flexible slot duration
--
-- Removes the hardcoded 60-minute constraint on slots so that
-- non-escape-room activities (e.g. ויקינגים: 75-min game) can
-- have their own duration.
--
-- Also adds generate_activity_slots() for variable-duration rooms.
-- ============================================================

-- ─── DROP 60-MINUTE CONSTRAINT ──────────────────────────────
ALTER TABLE slots DROP CONSTRAINT IF EXISTS slot_duration_check;

-- Replace with a looser constraint: end must be after start
ALTER TABLE slots ADD CONSTRAINT slot_end_after_start CHECK (end_at > start_at);

-- ─── GENERIC SLOT GENERATOR (variable duration + interval) ─
-- p_game_min     — actual game length in minutes  (e.g. 75)
-- p_interval_min — slot interval in minutes        (e.g. 90)
CREATE OR REPLACE FUNCTION generate_activity_slots(
  p_room_id      UUID,
  p_branch_id    UUID,
  p_game_min     INT DEFAULT 60,
  p_interval_min INT DEFAULT 90,
  p_days         INT DEFAULT 60
) RETURNS INT AS $$
DECLARE
  v_day         DATE;
  v_day_of_week INT;
  v_open        TIME;
  v_close       TIME;
  v_slot_start  TIMESTAMPTZ;
  v_slot_end    TIMESTAMPTZ;
  v_count       INT := 0;
  v_tz          TEXT;
BEGIN
  SELECT timezone INTO v_tz FROM branches WHERE id = p_branch_id;

  FOR v_day IN
    SELECT generate_series(CURRENT_DATE, CURRENT_DATE + p_days - 1, '1 day'::INTERVAL)::DATE
  LOOP
    v_day_of_week := EXTRACT(DOW FROM v_day)::INT;

    SELECT open_time, close_time
      INTO v_open, v_close
      FROM branch_hours
     WHERE branch_id = p_branch_id AND day_of_week = v_day_of_week;

    IF NOT FOUND THEN CONTINUE; END IF;

    v_slot_start := (v_day || ' ' || v_open)::TIMESTAMPTZ AT TIME ZONE v_tz;

    WHILE v_slot_start + (p_game_min || ' minutes')::INTERVAL <=
          (v_day || ' ' || v_close)::TIMESTAMPTZ AT TIME ZONE v_tz LOOP

      v_slot_end := v_slot_start + (p_game_min || ' minutes')::INTERVAL;

      INSERT INTO slots (room_id, start_at, end_at, status)
        VALUES (p_room_id, v_slot_start, v_slot_end, 'available')
        ON CONFLICT (room_id, start_at) DO NOTHING;

      v_count     := v_count + 1;
      v_slot_start := v_slot_start + (p_interval_min || ' minutes')::INTERVAL;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ─── UPDATE existing generate_slots_for_room to use new fn ──
-- Keep backward-compatible wrapper (60-min game, 90-min interval)
CREATE OR REPLACE FUNCTION generate_slots_for_room(
  p_room_id    UUID,
  p_branch_id  UUID,
  p_days       INT DEFAULT 60
) RETURNS INT AS $$
BEGIN
  RETURN generate_activity_slots(p_room_id, p_branch_id, 60, 90, p_days);
END;
$$ LANGUAGE plpgsql;
