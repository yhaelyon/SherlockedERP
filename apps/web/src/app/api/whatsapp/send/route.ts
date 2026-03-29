import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendText, renderTemplate } from '@/lib/whatsapp-client'

export const dynamic = 'force-dynamic'

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
    await sendText(phone, text)

    // Update log to sent
    await supabase.from('whatsapp_messages').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    }).eq('id', logEntry?.id)

    return NextResponse.json({ success: true, messageId: logEntry?.id })
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : 'Send failed'

    await supabase.from('whatsapp_messages').update({
      status: 'failed',
      error: errMsg,
    }).eq('id', logEntry?.id)

    return NextResponse.json({ success: false, error: errMsg }, { status: 500 })
  }
}
