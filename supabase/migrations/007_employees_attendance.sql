-- ============================================================
-- MIGRATION 007 — Employees, Attendance, Payroll
-- ============================================================

-- ─── USER PROFILES ──────────────────────────────────────────
CREATE TABLE user_profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                   TEXT NOT NULL DEFAULT 'staff'
    CHECK (role IN ('staff', 'shift_lead', 'manager', 'admin')),
  branch_id              UUID REFERENCES branches(id),
  full_name              TEXT NOT NULL,
  id_number              TEXT,              -- Israeli ID
  phone                  TEXT,
  hourly_rate            NUMERIC(8,2),      -- ₪/hour
  employment_type        TEXT NOT NULL DEFAULT 'hourly'
    CHECK (employment_type IN ('hourly', 'global')),
  global_monthly_salary  NUMERIC(10,2),    -- if employment_type='global'
  travel_per_shift       NUMERIC(6,2),     -- ₪ travel per shift
  max_travel_monthly     NUMERIC(8,2),     -- ₪ monthly travel cap
  overtime_eligible      BOOLEAN NOT NULL DEFAULT TRUE,
  vacation_pay_eligible  BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_health_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  monthly_health_amount  NUMERIC(8,2),
  active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── SHIFT CONSTRAINTS ──────────────────────────────────────
-- Employee submits weekly availability
CREATE TABLE shift_constraints (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  week_start     DATE NOT NULL,             -- always a Sunday
  constraints_json JSONB NOT NULL DEFAULT '{}',
  -- {"0": {"morning": true, "evening": false}, "1": {...}, ...}
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

-- ─── SHIFT ASSIGNMENTS ──────────────────────────────────────
CREATE TABLE shift_assignments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  branch_id    UUID NOT NULL REFERENCES branches(id),
  date         DATE NOT NULL,
  shift_type   TEXT NOT NULL CHECK (shift_type IN ('morning', 'evening')),
  order_number INT  NOT NULL DEFAULT 1, -- 1=first arrival, 2=second arrival
  note         TEXT,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date, shift_type)
);

-- ─── ATTENDANCE LOGS ────────────────────────────────────────
CREATE TABLE attendance_logs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  branch_id             UUID NOT NULL REFERENCES branches(id),
  clock_in              TIMESTAMPTZ NOT NULL,
  clock_out             TIMESTAMPTZ,
  total_minutes         INT GENERATED ALWAYS AS (
    CASE WHEN clock_out IS NOT NULL
      THEN EXTRACT(EPOCH FROM (clock_out - clock_in))::INT / 60
      ELSE NULL END
  ) STORED,
  wifi_token_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  manual_entry          BOOLEAN NOT NULL DEFAULT FALSE,
  manual_by             UUID REFERENCES auth.users(id),
  note                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PAYROLL PERIODS ────────────────────────────────────────
-- Israeli overtime law: 100% | 125% | 150% | 175% | 200% | Shabbat
CREATE TABLE payroll_periods (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  -- Hours by rate category
  hours_100        NUMERIC(6,2) NOT NULL DEFAULT 0,
  hours_125        NUMERIC(6,2) NOT NULL DEFAULT 0,
  hours_150        NUMERIC(6,2) NOT NULL DEFAULT 0,
  hours_175        NUMERIC(6,2) NOT NULL DEFAULT 0,
  hours_200        NUMERIC(6,2) NOT NULL DEFAULT 0,
  hours_shabbat    NUMERIC(6,2) NOT NULL DEFAULT 0,
  -- Summary
  work_days        INT  NOT NULL DEFAULT 0,
  travel_total     NUMERIC(10,2) NOT NULL DEFAULT 0,
  bonus            NUMERIC(10,2) NOT NULL DEFAULT 0,
  vacation_pay     NUMERIC(10,2) NOT NULL DEFAULT 0,
  monthly_health   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_salary     NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Status
  status           TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'paid')),
  approved_by      UUID REFERENCES auth.users(id),
  approved_at      TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_start)
);

CREATE TRIGGER payroll_periods_updated_at BEFORE UPDATE ON payroll_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── EMPLOYEE BANK ACCOUNTS ─────────────────────────────────
CREATE TABLE employee_bank (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  bank_name           TEXT NOT NULL,
  bank_number         TEXT NOT NULL,
  branch_number       TEXT NOT NULL,
  account_number      TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER employee_bank_updated_at BEFORE UPDATE ON employee_bank
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── HOLIDAY CALENDAR ───────────────────────────────────────
CREATE TABLE holiday_calendar (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('holiday', 'special')),
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  overtime_pct  INT NOT NULL DEFAULT 150   -- e.g. 150 means 150% rate
);

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX idx_attendance_user_date  ON attendance_logs (user_id, clock_in);
CREATE INDEX idx_attendance_branch     ON attendance_logs (branch_id, clock_in);
CREATE INDEX idx_payroll_user_period   ON payroll_periods (user_id, period_start);
CREATE INDEX idx_shift_assign_date     ON shift_assignments (date, branch_id);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_constraints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods    ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_bank      ENABLE ROW LEVEL SECURITY;
ALTER TABLE holiday_calendar   ENABLE ROW LEVEL SECURITY;

-- Users can see their own profile; managers see all
CREATE POLICY "profiles_own"              ON user_profiles      FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_service_role_all" ON user_profiles      FOR ALL    USING (auth.role() = 'service_role');

-- Employees see own constraints; managers see all
CREATE POLICY "constraints_own"           ON shift_constraints  FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "constraints_service_all"   ON shift_constraints  FOR ALL    USING (auth.role() = 'service_role');

-- Shift assignments: authenticated can read
CREATE POLICY "assignments_authenticated" ON shift_assignments  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "assignments_service_all"   ON shift_assignments  FOR ALL    USING (auth.role() = 'service_role');

-- Attendance: own records (for clock-in/out); service for all
CREATE POLICY "attendance_own"            ON attendance_logs    FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "attendance_service_all"    ON attendance_logs    FOR ALL    USING (auth.role() = 'service_role');

-- Payroll: managers (via service role) only
CREATE POLICY "payroll_service_all"       ON payroll_periods    FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "bank_own"                  ON employee_bank      FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "bank_service_all"          ON employee_bank      FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "holidays_public_read"      ON holiday_calendar   FOR SELECT USING (true);
CREATE POLICY "holidays_service_all"      ON holiday_calendar   FOR ALL    USING (auth.role() = 'service_role');
