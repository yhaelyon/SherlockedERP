-- ============================================================
-- MIGRATION 024 — WhatsApp webhook trace logs
-- ============================================================
-- Railway filesystem logs are ephemeral. Store webhook traces in Supabase so
-- incoming-message problems can be inspected from the ERP after deployment.

CREATE TABLE IF NOT EXISTS whatsapp_webhook_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint            TEXT NOT NULL,
  method              TEXT NOT NULL DEFAULT 'POST',
  source              TEXT NOT NULL DEFAULT 'evolution',
  event               TEXT,
  instance_id         TEXT,
  remote_jid          TEXT,
  external_message_id TEXT,
  direction           TEXT,
  phone               TEXT,
  auth_ok             BOOLEAN,
  status              TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'unauthorized', 'failed')),
  processed_count     INT NOT NULL DEFAULT 0,
  ignored_reason      TEXT,
  error_message       TEXT,
  request_headers     JSONB,
  query               JSONB,
  payload             JSONB,
  response            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_webhook_logs_created
  ON whatsapp_webhook_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_webhook_logs_status
  ON whatsapp_webhook_logs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_webhook_logs_event
  ON whatsapp_webhook_logs (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_webhook_logs_external
  ON whatsapp_webhook_logs (instance_id, external_message_id);

ALTER TABLE whatsapp_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_webhook_logs_authenticated_read" ON whatsapp_webhook_logs;
DROP POLICY IF EXISTS "wa_webhook_logs_service_all" ON whatsapp_webhook_logs;

CREATE POLICY "wa_webhook_logs_authenticated_read" ON whatsapp_webhook_logs
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "wa_webhook_logs_service_all" ON whatsapp_webhook_logs
  FOR ALL USING (auth.role() = 'service_role');
