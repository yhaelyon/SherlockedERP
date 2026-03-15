-- ============================================================
-- MIGRATION 003 — Customers + Escape Club
-- ============================================================

-- ─── CUSTOMERS ──────────────────────────────────────────────
CREATE TABLE customers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone               TEXT UNIQUE NOT NULL,     -- format: 0501234567
  first_name          TEXT NOT NULL,
  last_name           TEXT,
  email               TEXT,                     -- optional per spec
  referral_source     TEXT CHECK (referral_source IN ('google', 'facebook', 'friend', 'sign', 'other')),
  escape_experience   TEXT CHECK (escape_experience IN ('first', '1-3', '4+', 'expert')),
  notes               TEXT,
  consent_marketing   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── ESCAPE CLUB MEMBERS ────────────────────────────────────
-- Benefit: ₪15 discount per person (not applicable on Mythos room)
-- Birthday: ₪50 gift credit (valid 30 days)
CREATE TABLE escape_club_members (
  customer_id   UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  id_number     TEXT NOT NULL,                  -- Israeli ID
  dob           DATE NOT NULL,                  -- for birthday gift
  area          TEXT,                           -- geographic region
  member_since  DATE NOT NULL DEFAULT CURRENT_DATE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  discount_per_person INT NOT NULL DEFAULT 15,  -- ₪15 (configurable)
  birthday_gift_amount INT NOT NULL DEFAULT 50, -- ₪50 (configurable)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER escape_club_updated_at BEFORE UPDATE ON escape_club_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX idx_customers_phone     ON customers (phone);
CREATE INDEX idx_customers_email     ON customers (email);
CREATE INDEX idx_club_status         ON escape_club_members (status);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE escape_club_members  ENABLE ROW LEVEL SECURITY;

-- Customers — staff can read/write; service role can do anything
CREATE POLICY "customers_authenticated_read" ON customers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "customers_service_role_all" ON customers
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "club_authenticated_read" ON escape_club_members
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "club_service_role_all" ON escape_club_members
  FOR ALL USING (auth.role() = 'service_role');
