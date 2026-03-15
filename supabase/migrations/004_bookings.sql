-- ============================================================
-- MIGRATION 004 — Bookings
-- ============================================================

-- ─── BOOKINGS ───────────────────────────────────────────────
CREATE TABLE bookings (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id                   UUID NOT NULL REFERENCES branches(id),
  room_id                     UUID NOT NULL REFERENCES rooms(id),
  slot_id                     UUID NOT NULL REFERENCES slots(id),
  customer_id                 UUID NOT NULL REFERENCES customers(id),

  -- Participants & pricing
  participants_count          INT  NOT NULL CHECK (participants_count >= 1),
  is_club_member              BOOLEAN NOT NULL DEFAULT FALSE,
  price_regular               NUMERIC(10,2) NOT NULL,
  price_member                NUMERIC(10,2),              -- NULL if not member
  price_total                 NUMERIC(10,2) NOT NULL,     -- final total after discounts
  amount_paid                 NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_total              NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_breakdown_json     JSONB NOT NULL DEFAULT '{}', -- {"club":60,"military":0,...}

  -- Voucher
  voucher_code                TEXT,
  voucher_amount              NUMERIC(10,2),

  -- Policy
  cancellation_policy_applied TEXT,           -- stores policy version
  cancellation_fee            NUMERIC(10,2),

  -- Status
  status                      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'no_show')),

  -- Meta
  notes                       TEXT,
  internal_notes              TEXT,
  terms_accepted              BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted_at           TIMESTAMPTZ,
  created_by                  UUID REFERENCES auth.users(id), -- NULL = public booking
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX idx_bookings_room_slot       ON bookings (room_id, slot_id);
CREATE INDEX idx_bookings_customer        ON bookings (customer_id);
CREATE INDEX idx_bookings_status          ON bookings (status);
CREATE INDEX idx_bookings_created_at      ON bookings (created_at DESC);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_authenticated_read" ON bookings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "bookings_service_role_all" ON bookings
  FOR ALL USING (auth.role() = 'service_role');

-- ─── CANCELLATION FEE FUNCTION ──────────────────────────────
CREATE OR REPLACE FUNCTION calculate_cancellation_fee(
  p_booking_id   UUID,
  p_cancelled_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS NUMERIC AS $$
DECLARE
  v_booking      bookings%ROWTYPE;
  v_slot         slots%ROWTYPE;
  v_hours_until  FLOAT;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  SELECT * INTO v_slot    FROM slots    WHERE id = v_booking.slot_id;

  v_hours_until := EXTRACT(EPOCH FROM (v_slot.start_at - p_cancelled_at)) / 3600;

  IF v_hours_until >= 24 THEN
    RETURN 0;                                -- Full refund
  ELSIF v_hours_until >= 2 THEN
    RETURN v_booking.price_total * 0.5;     -- 50% fee
  ELSE
    RETURN v_booking.price_total;           -- 100% fee
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
