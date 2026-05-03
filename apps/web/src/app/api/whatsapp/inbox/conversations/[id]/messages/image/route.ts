import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import {
  ConversationRow,
  extractExternalMessageId,
  normalizePhone,
  previewForMessage,
  requireInboxUser,
  sendInboxImage,
} from '../../../../_lib'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, response } = await requireInboxUser(req)
  if (response) return response

  const { mediaUrl, caption, mimeType, fileName } = await req.json() as {
    mediaUrl?: string
    caption?: string
    mimeType?: string
    fileName?: string
  }

  if (!mediaUrl) return NextResponse.json({ error: 'Image mediaUrl is required' }, { status: 400 })

  const supabase = getAdminClient()
  const { data: conversation, error: convError } = await supabase
    .from('whatsapp_inbox_conversations')
    .select('id, instance_id, remote_jid, phone, customer_id, display_name, unread_count')
    .eq('id', params.id)
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const row = conversation as ConversationRow
  const occurredAt = new Date().toISOString()
  const body = caption?.trim() || null
  const { data: pending, error: insertError } = await supabase
    .from('whatsapp_inbox_messages')
    .insert({
      conversation_id: params.id,
      instance_id: row.instance_id,
      direction: 'outbound',
      from_me: true,
      sender_user_id: user?.id,
      message_type: 'image',
      body,
      media_url: mediaUrl,
      media_mime_type: mimeType ?? 'image/jpeg',
      status: 'pending',
      sent_at: occurredAt,
    })
    .select('*')
    .single()

  if (insertError || !pending) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to create image message' }, { status: 500 })
  }

  await supabase
    .from('whatsapp_inbox_conversations')
    .update({
      last_message_preview: previewForMessage('image', body),
      last_message_at: occurredAt,
    })
    .eq('id', params.id)

  try {
    const result = await sendInboxImage({
      phone: normalizePhone(row.phone),
      mediaUrl,
      caption: body ?? undefined,
      mimeType,
      fileName,
    })
    const externalMessageId = extractExternalMessageId(result)

    const { data: updated } = await supabase
      .from('whatsapp_inbox_messages')
      .update({
        external_message_id: externalMessageId,
        status: 'sent',
        raw_payload: result as Record<string, unknown>,
      })
      .eq('id', pending.id)
      .select('*')
      .single()

    if (updated) return NextResponse.json(updated)

    // Defensive: never let the UI think the row is still 'pending' after a successful send.
    const { data: refetched } = await supabase
      .from('whatsapp_inbox_messages')
      .select('*')
      .eq('id', pending.id)
      .single()

    return NextResponse.json(refetched ?? { ...pending, status: 'sent', external_message_id: externalMessageId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Send failed'
    const { data: failed } = await supabase
      .from('whatsapp_inbox_messages')
      .update({ status: 'failed', raw_payload: { error: message } })
      .eq('id', pending.id)
      .select('*')
      .single()

    return NextResponse.json({ error: message, message: failed ?? pending }, { status: 502 })
  }
}
