-- ============================================================
-- MIGRATION 009 — Linked Rooms (physical room sharing)
--
-- Some rooms share a physical space but have two versions
-- (e.g. adults vs family). When one version is booked,
-- the other version's slot at the same time is auto-blocked.
--
-- Pairs:
--   אנתרקס          ↔  הפרופסור המפוזר   (West)
--   הקוסם מארץ עוץ  ↔  אוז               (West)
--   השאגה המסתורית  ↔  השאגה האפלה       (East)
-- ============================================================

-- ─── ADD linked_room_id TO ROOMS ────────────────────────────
ALTER TABLE rooms
  ADD COLUMN linked_room_id UUID REFERENCES rooms(id);

-- ─── TRIGGER: auto-block / auto-unblock linked slot ─────────
CREATE OR REPLACE FUNCTION sync_linked_room_slot()
RETURNS TRIGGER AS $$
DECLARE
  v_linked_room_id    UUID;
  v_linked_slot_status TEXT;
BEGIN
  -- Skip if status did not change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Find linked physical room
  SELECT linked_room_id INTO v_linked_room_id
  FROM rooms WHERE id = NEW.room_id;

  IF v_linked_room_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- ── Slot became booked or pending → block linked slot ─────
  IF NEW.status IN ('booked', 'pending') THEN
    UPDATE slots
    SET status = 'blocked',
        note   = '[auto-blocked: linked room ' || NEW.room_id::TEXT || ']'
    WHERE room_id  = v_linked_room_id
      AND start_at = NEW.start_at
      AND status   = 'available';

  -- ── Slot freed (cancelled or back to available) → unblock ─
  ELSIF NEW.status IN ('available', 'cancelled')
    AND OLD.status IN ('booked', 'pending')
  THEN
    SELECT status INTO v_linked_slot_status
    FROM slots
    WHERE room_id = v_linked_room_id AND start_at = NEW.start_at;

    IF v_linked_slot_status = 'blocked' THEN
      UPDATE slots
      SET status = 'available',
          note   = NULL
      WHERE room_id  = v_linked_room_id
        AND start_at = NEW.start_at
        AND status   = 'blocked';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_linked_room_slot
  AFTER UPDATE ON slots
  FOR EACH ROW
  EXECUTE FUNCTION sync_linked_room_slot();

-- ─── INDEX ───────────────────────────────────────────────────
CREATE INDEX idx_rooms_linked ON rooms (linked_room_id) WHERE linked_room_id IS NOT NULL;
