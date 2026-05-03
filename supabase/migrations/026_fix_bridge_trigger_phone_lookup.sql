-- Migration 026: Fix bridge trigger to prevent split conversations.
--
-- Root cause: bridge trigger used ON CONFLICT (instance_id, remote_jid) as the
-- upsert key. When an incoming message carries a different instance_id (e.g.
-- 'sherlocked-main' vs 'sherlocked'), the trigger created a second conversation
-- for the same phone number instead of updating the existing one.
--
-- Fix (two parts):
--   1. Merge any duplicate conversations created since migration 025.
--   2. Rewrite the trigger to look up conversations by phone first (any
--      instance_id), falling back to INSERT only when no conversation exists
--      for that phone at all.

-- ─── PART 1: merge new duplicates ──────────────────────────────────────────

DO $$
DECLARE
  dup_phone    TEXT;
  keeper_id    UUID;
BEGIN
  FOR dup_phone IN
    SELECT phone
    FROM   whatsapp_inbox_conversations
    GROUP  BY phone
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the conversation with the most-recent activity (or latest created_at).
    SELECT id
    INTO   keeper_id
    FROM   whatsapp_inbox_conversations
    WHERE  phone = dup_phone
    ORDER  BY COALESCE(last_message_at, created_at) DESC
    LIMIT  1;

    -- Re-parent all messages from duplicate conversations to the keeper.
    UPDATE whatsapp_inbox_messages
    SET    conversation_id = keeper_id
    WHERE  conversation_id IN (
      SELECT id FROM whatsapp_inbox_conversations
      WHERE  phone = dup_phone AND id <> keeper_id
    );

    -- Delete the now-empty duplicates.
    DELETE FROM whatsapp_inbox_conversations
    WHERE  phone = dup_phone AND id <> keeper_id;

    -- Refresh keeper metadata from the merged message set.
    UPDATE whatsapp_inbox_conversations
    SET
      last_message_preview = (
        SELECT COALESCE(body, '[media]')
        FROM   whatsapp_inbox_messages
        WHERE  conversation_id = keeper_id
        ORDER  BY COALESCE(received_at, sent_at, created_at) DESC
        LIMIT  1
      ),
      last_message_at = (
        SELECT MAX(COALESCE(received_at, sent_at, created_at))
        FROM   whatsapp_inbox_messages
        WHERE  conversation_id = keeper_id
      ),
      unread_count = (
        SELECT COUNT(*)::INT
        FROM   whatsapp_inbox_messages
        WHERE  conversation_id = keeper_id
          AND  direction = 'inbound'
          AND  status    = 'received'
      ),
      updated_at = NOW()
    WHERE id = keeper_id;

    RAISE NOTICE 'Merged duplicate conversations for phone % → keeper %', dup_phone, keeper_id;
  END LOOP;
END $$;

-- ─── PART 2: phone-first bridge trigger ────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_legacy_whatsapp_incoming_to_inbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  canonical_phone  TEXT;
  raw_phone        TEXT;
  wa_remote_jid    TEXT;
  wa_conversation_id UUID;
  message_body     TEXT;
  occurred_at      TIMESTAMPTZ;
  wa_instance      TEXT;
BEGIN
  IF NEW.status <> 'received' OR COALESCE(NEW.trigger_type, '') <> 'incoming' THEN
    RETURN NEW;
  END IF;

  raw_phone    := COALESCE(NEW.to_number, NEW.to_phone);
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

  wa_instance   := COALESCE(NEW.instance_id, 'sherlocked-main');
  wa_remote_jid := canonical_phone || '@s.whatsapp.net';
  occurred_at   := COALESCE(NEW.created_at, NOW());

  -- ── Find any existing conversation for this phone (ignore instance_id) ──
  SELECT id
  INTO   wa_conversation_id
  FROM   whatsapp_inbox_conversations
  WHERE  phone = canonical_phone
  ORDER  BY COALESCE(last_message_at, created_at) DESC
  LIMIT  1;

  IF wa_conversation_id IS NOT NULL THEN
    -- Re-use the existing conversation regardless of which instance delivered it.
    UPDATE whatsapp_inbox_conversations
    SET
      last_message_preview = LEFT(message_body, 180),
      last_message_at      = GREATEST(
                               COALESCE(last_message_at, 'epoch'::timestamptz),
                               occurred_at
                             ),
      unread_count = unread_count + 1,
      updated_at   = NOW()
    WHERE id = wa_conversation_id;

  ELSE
    -- No conversation exists yet for this phone — create one.
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
      phone                = EXCLUDED.phone,
      raw_phone            = EXCLUDED.raw_phone,
      display_name         = COALESCE(whatsapp_inbox_conversations.display_name, EXCLUDED.display_name),
      last_message_preview = EXCLUDED.last_message_preview,
      last_message_at      = GREATEST(
                               COALESCE(whatsapp_inbox_conversations.last_message_at, 'epoch'::timestamptz),
                               EXCLUDED.last_message_at
                             ),
      unread_count = whatsapp_inbox_conversations.unread_count + 1,
      updated_at   = NOW()
    RETURNING id INTO wa_conversation_id;
  END IF;

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
