import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendText, renderTemplate } from '@/lib/whatsapp-client'

export const dynamic = 'force-dynamic'

async function sendViaFallback(body: unknown) {
  const fallbackUrl = process.env.WHATSAPP_SEND_FALLBACK_URL
  if (!fallbackUrl) return null

  const res = await fetch(fallbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    const message = payload?.error ?? `Fallback send failed (${res.status})`
    throw new Error(message)
  }

  return payload
}

function remoteJidForPhone(phone: string) {
  return `${phone}@s.whatsapp.net`
}

async function recordInboxOutbound(params: {
  supabase: ReturnType<typeof getAdminClient>
  phone: string
  toName?: string | null
  text: string
  rawPayload?: Record<string, unknown>
}) {
  const instanceId = process.env.EVOLUTION_INSTANCE_NAME ?? 'sherlocked'
  const remoteJid = remoteJidForPhone(params.phone)
  const now = new Date().toISOString()

  const { data: existing } = await params.supabase
    .from('whatsapp_inbox_conversations')
    .select('id')
    .eq('instance_id', instanceId)
    .eq('remote_jid', remoteJid)
    .maybeSingle()

  let conversationId = existing?.id as string | undefined

  if (!conversationId) {
    const { data: conversation, error } = await params.supabase
      .from('whatsapp_inbox_conversations')
      .insert({
        instance_id: instanceId,
        remote_jid: remoteJid,
        phone: params.phone,
        raw_phone: params.phone,
        display_name: params.toName || params.phone,
        last_message_preview: params.text.slice(0, 180),
        last_message_at: now,
        unread_count: 0,
        status: 'open',
      })
      .select('id')
      .single()

    if (error) throw error
    conversationId = conversation.id
  } else {
    await params.supabase
      .from('whatsapp_inbox_conversations')
      .update({
        last_message_preview: params.text.slice(0, 180),
        last_message_at: now,
        updated_at: now,
      })
      .eq('id', conversationId)
  }

  await params.supabase
    .from('whatsapp_inbox_messages')
    .insert({
      conversation_id: conversationId,
      instance_id: instanceId,
      direction: 'outbound',
      from_me: true,
      message_type: 'text',
      body: params.text,
      status: 'sent',
      sent_at: now,
      raw_payload: params.rawPayload ?? null,
    })
}

/**
 * POST /api/whatsapp/send
 * Sends a WhatsApp message to a phone number.
 *
 * Body: {
 *   to: string           // phone number (any format, e.g. 0501234567 or +972501234567)
 *   toName?: string      // recipient name for logs
 *   templateKey?: string // template to use (from whatsapp_templates table)
 *   vars?: Record<string, string|number>  // template variables
 *   message?: string     // raw message (used if no templateKey)
 *   triggerType?: string // 'booking_confirm' | 'booking_reminder' | 'manual' | etc.
 *   referenceId?: string // booking_id, payment_id, etc.
 * }
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { to, toName, templateKey, vars = {}, message, triggerType, referenceId } = body

  if (!to) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  }

  // Normalize phone number to international format (Israel 972xxx)
  let phone = to.replace(/\D/g, '')
  if (phone.startsWith('0')) phone = '972' + phone.slice(1)

  const supabase = getAdminClient()

  // Resolve message text
  let text = message ?? ''
  if (templateKey) {
    const { data: tpl } = await supabase
      .from('whatsapp_templates')
      .select('body, enabled')
      .eq('key', templateKey)
      .single()

    if (!tpl) {
      return NextResponse.json({ error: `Template '${templateKey}' not found` }, { status: 404 })
    }
    if (!tpl.enabled) {
      return NextResponse.json({ error: `Template '${templateKey}' is disabled` }, { status: 400 })
    }
    text = renderTemplate(tpl.body, vars)
  }

  if (!text.trim()) {
    return NextResponse.json({ error: 'Message body is empty' }, { status: 400 })
  }

  // Insert pending log entry
  const { data: logEntry } = await supabase.from('whatsapp_messages').insert({
    to_phone: phone,
    body: text,
    to_number: phone,
    to_name: toName ?? null,
    message: text,
    template_key: templateKey ?? null,
    status: 'pending',
    trigger_type: triggerType ?? 'manual',
    reference_id: referenceId ?? null,
  }).select().single()

  // Send via Evolution API
  try {
    const result = await sendText(phone, text)

    // Update log to sent
    await supabase.from('whatsapp_messages').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    }).eq('id', logEntry?.id)

    await recordInboxOutbound({ supabase, phone, toName, text, rawPayload: result as unknown as Record<string, unknown> })

    return NextResponse.json({ success: true, messageId: logEntry?.id })
  } catch (e: unknown) {
    try {
      const fallback = await sendViaFallback({
        to,
        toName,
        templateKey,
        vars,
        message: text,
        triggerType,
        referenceId,
      })

      if (fallback) {
        await supabase.from('whatsapp_messages').update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error: null,
        }).eq('id', logEntry?.id)

        await recordInboxOutbound({ supabase, phone, toName, text, rawPayload: fallback as Record<string, unknown> })

        return NextResponse.json({ success: true, messageId: logEntry?.id, fallback: true })
      }
    } catch (fallbackError) {
      const errMsg = fallbackError instanceof Error ? fallbackError.message : 'Fallback send failed'

      await supabase.from('whatsapp_messages').update({
        status: 'failed',
        error: errMsg,
      }).eq('id', logEntry?.id)

      return NextResponse.json({ success: false, error: errMsg }, { status: 500 })
    }

    const errMsg = e instanceof Error ? e.message : 'Send failed'

    await supabase.from('whatsapp_messages').update({
      status: 'failed',
      error: errMsg,
    }).eq('id', logEntry?.id)

    return NextResponse.json({ success: false, error: errMsg }, { status: 500 })
  }
}
