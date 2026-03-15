-- ============================================================
-- MIGRATION 006 — Operations
-- Tasks, checklists, cash registers, operator info, comp credits
-- ============================================================

-- ─── TASKS ──────────────────────────────────────────────────
CREATE TABLE tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  day_of_week  INT  CHECK (day_of_week BETWEEN 0 AND 6),  -- NULL = every day
  assigned_to  UUID REFERENCES auth.users(id),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  hour         TIME,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TASK TEMPLATES ─────────────────────────────────────────
CREATE TABLE task_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('opening', 'closing')),
  items_json  JSONB NOT NULL DEFAULT '[]', -- [{text: "...", order: 1}]
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER task_templates_updated_at BEFORE UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── DAILY CHECKLISTS ───────────────────────────────────────
CREATE TABLE task_checklist_daily (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id   UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  items_json    JSONB NOT NULL DEFAULT '[]', -- [{text, done, done_by, done_at}]
  completed_by  UUID REFERENCES auth.users(id),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, date)
);

-- ─── CASH REGISTERS ─────────────────────────────────────────
-- ⚠️ EACH ROOM HAS ITS OWN SEPARATE REGISTER
CREATE TABLE cash_registers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  room_id         UUID NOT NULL REFERENCES rooms(id),     -- per-room register
  date            DATE NOT NULL,
  shift_type      TEXT NOT NULL CHECK (shift_type IN ('morning', 'evening')),
  opening_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  closing_amount  NUMERIC(10,2),
  cash_sales      NUMERIC(10,2) NOT NULL DEFAULT 0,
  card_sales      NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  submitted_by    UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, date, shift_type)
);

CREATE TRIGGER cash_registers_updated_at BEFORE UPDATE ON cash_registers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── OPERATOR INFO ──────────────────────────────────────────
-- Rich text info per room (manager-edit only)
CREATE TABLE operator_info (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id      UUID UNIQUE NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  content_html TEXT,
  updated_by   UUID REFERENCES auth.users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── COMP CREDITS ───────────────────────────────────────────
CREATE TABLE comp_credits (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount            NUMERIC(10,2) NOT NULL,
  expires_at        TIMESTAMPTZ,
  source_booking_id UUID REFERENCES bookings(id),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
  note              TEXT,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE tasks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checklist_daily   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_info          ENABLE ROW LEVEL SECURITY;
ALTER TABLE comp_credits           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_authenticated_read"           ON tasks                FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tasks_service_role_all"             ON tasks                FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "templates_authenticated_read"       ON task_templates       FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "templates_service_role_all"         ON task_templates       FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "checklists_authenticated_read"      ON task_checklist_daily FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "checklists_service_role_all"        ON task_checklist_daily FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "cash_reg_authenticated_read"        ON cash_registers       FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "cash_reg_service_role_all"          ON cash_registers       FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "operator_info_authenticated_read"   ON operator_info        FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "operator_info_service_role_all"     ON operator_info        FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "comp_credits_authenticated_read"    ON comp_credits         FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "comp_credits_service_role_all"      ON comp_credits         FOR ALL    USING (auth.role() = 'service_role');
