-- ============================================================
-- MIGRATION 005 — Payments, Vouchers, Invoices
-- ⚠️ PayPlus ONLY — never Stripe
-- ============================================================

-- ─── PAYMENTS ───────────────────────────────────────────────
CREATE TABLE payments (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id               UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payplus_transaction_id   TEXT,              -- from PayPlus webhook
  payplus_payment_page_id  TEXT,              -- generated link ID
  amount                   NUMERIC(10,2) NOT NULL,
  method                   TEXT NOT NULL DEFAULT 'card'
    CHECK (method IN ('card', 'cash', 'voucher', 'credit', 'other')),
  status                   TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'partial_refund')),
  refund_amount            NUMERIC(10,2),
  paid_at                  TIMESTAMPTZ,
  webhook_payload          JSONB,             -- raw PayPlus webhook payload
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── GIFT VOUCHER TYPES ─────────────────────────────────────
CREATE TABLE gift_voucher_types (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,          -- e.g., "חדר 1 - 4 משתתפים"
  price        NUMERIC(10,2) NOT NULL, -- e.g., 500
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── GIFT VOUCHERS ──────────────────────────────────────────
CREATE TABLE gift_vouchers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                TEXT UNIQUE NOT NULL,   -- e.g., "SHER-2025-ABCD"
  type_id             UUID REFERENCES gift_voucher_types(id),
  price               NUMERIC(10,2) NOT NULL, -- original value
  remaining_amount    NUMERIC(10,2) NOT NULL, -- for partial use
  purchaser_name      TEXT NOT NULL,
  purchaser_phone     TEXT,
  purchaser_email     TEXT,
  recipient_name      TEXT,
  recipient_phone     TEXT,
  status              TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  purchased_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  used_in_booking_id  UUID REFERENCES bookings(id),
  used_at             TIMESTAMPTZ,
  payplus_transaction_id TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INVOICES ───────────────────────────────────────────────
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  morning_doc_id  TEXT,                -- Morning (Green Invoice) document ID
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  pdf_url         TEXT,
  total_amount    NUMERIC(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_booking        ON payments (booking_id);
CREATE INDEX idx_payments_payplus        ON payments (payplus_transaction_id);
CREATE INDEX idx_vouchers_code           ON gift_vouchers (code);
CREATE INDEX idx_vouchers_status         ON gift_vouchers (status);
CREATE INDEX idx_invoices_booking        ON invoices (booking_id);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_voucher_types  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_vouchers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_authenticated_read"   ON payments           FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "payments_service_role_all"     ON payments           FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "voucher_types_public_read"     ON gift_voucher_types FOR SELECT USING (is_active = true);
CREATE POLICY "voucher_types_service_all"     ON gift_voucher_types FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "vouchers_service_role_all"     ON gift_vouchers      FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "invoices_authenticated_read"   ON invoices           FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "invoices_service_role_all"     ON invoices           FOR ALL    USING (auth.role() = 'service_role');
