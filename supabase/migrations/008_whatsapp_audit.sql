-- ============================================================
-- MIGRATION 008 — WhatsApp (Evolution API) + Audit Log
-- ============================================================

-- ─── WHATSAPP MESSAGES ──────────────────────────────────────
CREATE TABLE whatsapp_messages (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_phone       TEXT NOT NULL,              -- 972501234567 format
  instance_id    TEXT NOT NULL DEFAULT 'sherlocked-main',
  template_name  TEXT,                       -- confirmation | reminder | birthday | debt
  body           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'cancelled')),
  booking_id     UUID REFERENCES bookings(id) ON DELETE SET NULL,
  error_msg      TEXT,
  sent_at        TIMESTAMPTZ,
  retry_count    INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── WHATSAPP CONNECTION STATUS ─────────────────────────────
CREATE TABLE whatsapp_connection (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id       TEXT UNIQUE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected', 'qr_required', 'connecting')),
  qr_code_data      TEXT,                    -- base64 QR for admin panel
  last_connected_at TIMESTAMPTZ,
  last_checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AUDIT LOG ──────────────────────────────────────────────
-- All mutations go through here (changes to rooms, bookings, payroll, etc.)
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id     UUID REFERENCES auth.users(id),
  actor_name   TEXT,                         -- snapshot of user name
  action       TEXT NOT NULL,               -- CREATE | UPDATE | DELETE | CANCEL | APPROVE
  entity_type  TEXT NOT NULL,               -- booking | payment | room | employee | slot
  entity_id    TEXT NOT NULL,
  before_json  JSONB,
  after_json   JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX idx_wa_messages_booking   ON whatsapp_messages (booking_id);
CREATE INDEX idx_wa_messages_status    ON whatsapp_messages (status);
CREATE INDEX idx_audit_entity          ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_actor           ON audit_log (actor_id, created_at DESC);
CREATE INDEX idx_audit_created         ON audit_log (created_at DESC);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE whatsapp_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_connection  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_messages_authenticated_read" ON whatsapp_messages   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "wa_messages_service_all"        ON whatsapp_messages   FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "wa_conn_authenticated_read"     ON whatsapp_connection FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "wa_conn_service_all"            ON whatsapp_connection FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "audit_authenticated_read"       ON audit_log           FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "audit_service_all"              ON audit_log           FOR ALL    USING (auth.role() = 'service_role');

-- ─── SEED INITIAL WHATSAPP INSTANCE ─────────────────────────
INSERT INTO whatsapp_connection (instance_id, status)
VALUES ('sherlocked-main', 'disconnected')
ON CONFLICT (instance_id) DO NOTHING;

-- ─── PG_CRON JOBS ───────────────────────────────────────────
-- Requires pg_cron extension (enable in Supabase dashboard → Extensions)
-- Run in Supabase SQL editor after enabling pg_cron:
-- SELECT cron.schedule('expire-pending-slots', '* * * * *', 'SELECT expire_pending_slots()');
-- SELECT cron.schedule('expire-pending-slots', '* * * * *', $$SELECT expire_pending_slots()$$);
