-- ============================================================
-- MIGRATION 022 — WhatsApp shared team inbox MVP
-- ============================================================
-- Compatibility decision:
-- Keep the legacy whatsapp_messages audit table for automated/admin sends.
-- The shared team inbox uses dedicated tables below so legacy audit fields
-- (to_phone/body/template_name) and newer admin UI fields (to_number/message/
-- template_key/trigger_type) can coexist without becoming the inbox source.

-- ─── LEGACY ADMIN COMPATIBILITY ─────────────────────────────
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS to_number TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS to_name TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS template_key TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS trigger_type TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;
ALTER TABLE whatsapp_messages ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status IN ('queued', 'pending', 'sent', 'delivered', 'read', 'received', 'failed', 'cancelled'));

CREATE TABLE IF NOT EXISTS whatsapp_config (
  id             UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  instance_id    TEXT NOT NULL DEFAULT 'sherlocked-main',
  status         TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('unconfigured', 'connected', 'disconnected', 'qr', 'qr_required', 'connecting')),
  phone_number   TEXT,
  qr_code        TEXT,
  last_connected TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS instance_id TEXT NOT NULL DEFAULT 'sherlocked-main';
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'disconnected';
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS last_connected TIMESTAMPTZ;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE whatsapp_config DROP CONSTRAINT IF EXISTS whatsapp_config_status_check;
ALTER TABLE whatsapp_config ADD CONSTRAINT whatsapp_config_status_check
  CHECK (status IN ('unconfigured', 'connected', 'disconnected', 'qr', 'qr_required', 'connecting'));

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,
  body        TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_config_authenticated_read" ON whatsapp_config;
DROP POLICY IF EXISTS "wa_config_service_all" ON whatsapp_config;
DROP POLICY IF EXISTS "wa_templates_authenticated_read" ON whatsapp_templates;
DROP POLICY IF EXISTS "wa_templates_service_all" ON whatsapp_templates;

CREATE POLICY "wa_config_authenticated_read" ON whatsapp_config
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "wa_config_service_all" ON whatsapp_config
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "wa_templates_authenticated_read" ON whatsapp_templates
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "wa_templates_service_all" ON whatsapp_templates
  FOR ALL USING (auth.role() = 'service_role');

INSERT INTO whatsapp_config (id, instance_id, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'sherlocked-main', 'disconnected')
ON CONFLICT (id) DO NOTHING;

INSERT INTO whatsapp_templates (key, label, body, enabled)
VALUES
  ('manual', 'הודעה ידנית', '{{message}}', TRUE),
  ('booking_confirm', 'אישור הזמנה', 'שלום {{firstName}}, ההזמנה שלך אושרה.', TRUE),
  ('booking_reminder', 'תזכורת להזמנה', 'תזכורת: מחכים לכם מחר בשעה {{time}}.', TRUE),
  ('payment_request', 'בקשת תשלום', 'שלום {{firstName}}, ניתן לשלם בקישור: {{link}}', TRUE)
ON CONFLICT (key) DO NOTHING;

-- ─── PERMISSION HELPER ──────────────────────────────────────
CREATE OR REPLACE FUNCTION has_whatsapp_inbox_permission()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND active = TRUE
      AND role IN ('admin', 'manager', 'shift_lead', 'staff')
  );
$$;

-- ─── INBOX CONVERSATIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_inbox_conversations (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id          TEXT NOT NULL DEFAULT 'sherlocked-main',
  remote_jid           TEXT NOT NULL,
  phone                TEXT NOT NULL,
  raw_phone            TEXT,
  customer_id          UUID REFERENCES customers(id) ON DELETE SET NULL,
  display_name         TEXT,
  last_message_preview TEXT,
  last_message_at      TIMESTAMPTZ,
  unread_count         INT NOT NULL DEFAULT 0,
  assigned_to          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status               TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending', 'closed')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instance_id, remote_jid)
);

DROP TRIGGER IF EXISTS whatsapp_inbox_conversations_updated_at ON whatsapp_inbox_conversations;
CREATE TRIGGER whatsapp_inbox_conversations_updated_at
  BEFORE UPDATE ON whatsapp_inbox_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_wa_inbox_conversations_last
  ON whatsapp_inbox_conversations (last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_wa_inbox_conversations_phone
  ON whatsapp_inbox_conversations (phone);
CREATE INDEX IF NOT EXISTS idx_wa_inbox_conversations_customer
  ON whatsapp_inbox_conversations (customer_id);
CREATE INDEX IF NOT EXISTS idx_wa_inbox_conversations_status
  ON whatsapp_inbox_conversations (status);

-- ─── INBOX MESSAGES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_inbox_messages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id     UUID NOT NULL REFERENCES whatsapp_inbox_conversations(id) ON DELETE CASCADE,
  instance_id         TEXT NOT NULL DEFAULT 'sherlocked-main',
  external_message_id TEXT,
  direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_me             BOOLEAN NOT NULL DEFAULT FALSE,
  sender_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_type        TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'unknown')),
  body                TEXT,
  media_url           TEXT,
  media_mime_type     TEXT,
  status              TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'read', 'pending', 'sent', 'failed', 'delivered')),
  raw_payload         JSONB,
  sent_at             TIMESTAMPTZ,
  received_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instance_id, external_message_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_inbox_messages_conversation_time
  ON whatsapp_inbox_messages (conversation_id, (COALESCE(received_at, sent_at, created_at)));
CREATE INDEX IF NOT EXISTS idx_wa_inbox_messages_external
  ON whatsapp_inbox_messages (instance_id, external_message_id);
CREATE INDEX IF NOT EXISTS idx_wa_inbox_messages_status
  ON whatsapp_inbox_messages (status);
CREATE INDEX IF NOT EXISTS idx_wa_inbox_messages_created
  ON whatsapp_inbox_messages (created_at DESC);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE whatsapp_inbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_inbox_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_inbox_conversations_read" ON whatsapp_inbox_conversations;
DROP POLICY IF EXISTS "wa_inbox_conversations_service_all" ON whatsapp_inbox_conversations;
DROP POLICY IF EXISTS "wa_inbox_messages_read" ON whatsapp_inbox_messages;
DROP POLICY IF EXISTS "wa_inbox_messages_service_all" ON whatsapp_inbox_messages;

CREATE POLICY "wa_inbox_conversations_read" ON whatsapp_inbox_conversations
  FOR SELECT USING (has_whatsapp_inbox_permission());
CREATE POLICY "wa_inbox_conversations_service_all" ON whatsapp_inbox_conversations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "wa_inbox_messages_read" ON whatsapp_inbox_messages
  FOR SELECT USING (has_whatsapp_inbox_permission());
CREATE POLICY "wa_inbox_messages_service_all" ON whatsapp_inbox_messages
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE whatsapp_inbox_conversations REPLICA IDENTITY FULL;
ALTER TABLE whatsapp_inbox_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'whatsapp_inbox_conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_inbox_conversations;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'whatsapp_inbox_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_inbox_messages;
    END IF;
  END IF;
END $$;
