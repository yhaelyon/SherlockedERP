-- Migration 025: Merge duplicate WhatsApp conversations for same phone number.
--
-- Root cause: The legacy (sherlocked-main) conversation was created during local
-- development; the real Evolution instance is named 'sherlocked'.  Incoming
-- webhooks write to the 'sherlocked' conversation while outbound messages went
-- to 'sherlocked-main', so users saw a split inbox.
--
-- Fix: move all messages from the sherlocked-main conversation into the
-- sherlocked one, then delete the empty duplicate.

DO $$
DECLARE
  keep_id  UUID := '854c00b8-14ef-4010-8334-7c2d1d2aa74b'; -- instance sherlocked  (real incoming)
  drop_id  UUID := 'd398384b-142e-4fa4-8ec6-0e34c85037c8'; -- instance sherlocked-main (legacy local)
BEGIN
  -- Only run if both conversations still exist
  IF NOT EXISTS (SELECT 1 FROM whatsapp_inbox_conversations WHERE id = keep_id) OR
     NOT EXISTS (SELECT 1 FROM whatsapp_inbox_conversations WHERE id = drop_id) THEN
    RAISE NOTICE 'One or both conversations not found – skipping merge.';
    RETURN;
  END IF;

  -- Move messages (they keep their own instance_id; only conversation_id changes)
  UPDATE whatsapp_inbox_messages
  SET conversation_id = keep_id
  WHERE conversation_id = drop_id;

  -- Refresh the canonical conversation's preview and unread count
  UPDATE whatsapp_inbox_conversations
  SET
    display_name         = '972503011632',
    last_message_preview = (
      SELECT body
      FROM whatsapp_inbox_messages
      WHERE conversation_id = keep_id
      ORDER BY COALESCE(received_at, sent_at, created_at) DESC
      LIMIT 1
    ),
    last_message_at = (
      SELECT MAX(COALESCE(received_at, sent_at, created_at))
      FROM whatsapp_inbox_messages
      WHERE conversation_id = keep_id
    ),
    unread_count = 0,
    updated_at   = NOW()
  WHERE id = keep_id;

  -- Delete the now-empty duplicate conversation
  DELETE FROM whatsapp_inbox_conversations WHERE id = drop_id;

  RAISE NOTICE 'Merged conversations: % <- %', keep_id, drop_id;
END $$;
