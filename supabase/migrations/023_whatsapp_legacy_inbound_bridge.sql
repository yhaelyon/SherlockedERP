-- Compatibility bridge for the currently deployed legacy WhatsApp webhook.
--
-- The deployed Next webhook writes incoming replies to whatsapp_messages using
-- the newer column names (to_number/message) while migration 008 originally
-- required legacy audit columns (to_phone/body). Keep that legacy insert path
-- working, then mirror incoming rows into the dedicated inbox tables.

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS external_message_id TEXT;

ALTER TABLE whatsapp_messages
  ALTER COLUMN to_phone DROP NOT NULL,
  ALTER COLUMN body DROP NOT NULL,
  ALTER COLUMN instance_id SET DEFAULT 'sherlocked-main',
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_external_message_id
  ON whatsapp_messages (instance_id, external_message_id);

CREATE OR REPLACE FUNCTION sync_legacy_whatsapp_incoming_to_inbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  canonical_phone TEXT;
  raw_phone TEXT;
  wa_remote_jid TEXT;
  wa_conversation_id UUID;
  message_body TEXT;
  occurred_at TIMESTAMPTZ;
  wa_instance TEXT;
BEGIN
  IF NEW.status <> 'received' OR COALESCE(NEW.trigger_type, '') <> 'incoming' THEN
    RETURN NEW;
  END IF;

  raw_phone := COALESCE(NEW.to_number, NEW.to_phone);
  message_body := NULLIF(COALESCE(NEW.message, NEW.body), '');

  IF raw_phone IS NULL OR message_body IS NULL THEN
    RETURN NEW;
  END IF;

  canonical_phone := regexp_replace(raw_phone, '\D', '', 'g');
  IF canonical_phone LIKE '0%' THEN
    canonical_phone := '972' || substring(canonical_phone FROM 2);
  END IF;

  IF canonical_phone = '' THEN
    RETURN NEW;
  END IF;

  wa_instance := COALESCE(NEW.instance_id, 'sherlocked-main');
  wa_remote_jid := canonical_phone || '@s.whatsapp.net';
  occurred_at := COALESCE(NEW.created_at, NOW());

  INSERT INTO whatsapp_inbox_conversations (
    instance_id,
    remote_jid,
    phone,
    raw_phone,
    display_name,
    last_message_preview,
    last_message_at,
    unread_count,
    status,
    created_at,
    updated_at
  )
  VALUES (
    wa_instance,
    wa_remote_jid,
    canonical_phone,
    raw_phone,
    canonical_phone,
    LEFT(message_body, 180),
    occurred_at,
    1,
    'open',
    occurred_at,
    NOW()
  )
  ON CONFLICT (instance_id, remote_jid) DO UPDATE SET
    phone = EXCLUDED.phone,
    raw_phone = EXCLUDED.raw_phone,
    display_name = COALESCE(whatsapp_inbox_conversations.display_name, EXCLUDED.display_name),
    last_message_preview = EXCLUDED.last_message_preview,
    last_message_at = GREATEST(
      COALESCE(whatsapp_inbox_conversations.last_message_at, 'epoch'::timestamptz),
      EXCLUDED.last_message_at
    ),
    unread_count = whatsapp_inbox_conversations.unread_count + 1,
    updated_at = NOW()
  RETURNING id INTO wa_conversation_id;

  INSERT INTO whatsapp_inbox_messages (
    conversation_id,
    instance_id,
    external_message_id,
    direction,
    from_me,
    message_type,
    body,
    status,
    raw_payload,
    received_at,
    created_at
  )
  VALUES (
    wa_conversation_id,
    wa_instance,
    COALESCE(NEW.external_message_id, 'legacy:' || NEW.id::TEXT),
    'inbound',
    FALSE,
    'text',
    message_body,
    'received',
    TO_JSONB(NEW),
    occurred_at,
    occurred_at
  )
  ON CONFLICT (instance_id, external_message_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_messages_legacy_incoming_to_inbox ON whatsapp_messages;
CREATE TRIGGER whatsapp_messages_legacy_incoming_to_inbox
  AFTER INSERT ON whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION sync_legacy_whatsapp_incoming_to_inbox();
