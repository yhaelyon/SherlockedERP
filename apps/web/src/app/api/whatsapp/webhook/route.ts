import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { logWhatsAppEvent, queryParams, safeHeaders } from '../_logging'

export const dynamic = 'force-dynamic'

function loadRootEnvForServerRoutes() {
  const candidates = [
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
  ]

  for (const file of candidates) {
    if (!existsSync(file)) continue

    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue

      const index = trimmed.indexOf('=')
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '')
      if (key && process.env[key] === undefined) process.env[key] = value
    }

    return
  }
}

loadRootEnvForServerRoutes()

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }
  return null
}

function normalizePhone(input: string): string {
  const raw = String(input ?? '').trim()
  const withoutJid = raw.split('@')[0]?.split(':')[0] ?? raw
  let digits = withoutJid.replace(/\D/g, '')

  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('9720')) digits = `972${digits.slice(4)}`
  if (digits.startsWith('0')) digits = `972${digits.slice(1)}`

  return digits
}

function timestampToIso(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000
    return new Date(millis).toISOString()
  }

  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return timestampToIso(numeric)
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }

  return new Date().toISOString()
}

function webhookSecrets(): string[] {
  return [
    process.env.WHATSAPP_WEBHOOK_SECRET,
    process.env.EVOLUTION_API_KEY,
    process.env.WHATSAPP_WEBHOOK_SECRET_LEGACY,
  ].filter((value): value is string => Boolean(value))
}

function isWebhookAuthorized(req: NextRequest, payload?: Record<string, unknown>): boolean {
  const secrets = webhookSecrets()
  if (secrets.length === 0) return true

  const candidates = [
    req.headers.get('apikey'),
    req.headers.get('x-api-key'),
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, ''),
    req.nextUrl.searchParams.get('secret'),
    req.nextUrl.searchParams.get('token'),
    pickString(payload?.apikey, payload?.apiKey),
  ]

  return candidates.some((value) => typeof value === 'string' && secrets.includes(value))
}

function messageCandidates(payload: Record<string, unknown>): Record<string, unknown>[] {
  const data = payload.data
  if (Array.isArray(data)) return data.map(asRecord)

  const dataRecord = asRecord(data)
  const messages = dataRecord.messages
  if (Array.isArray(messages)) return messages.map(asRecord)

  const message = dataRecord.message
  if (message && typeof message === 'object' && !('conversation' in asRecord(message))) {
    return [asRecord(message)]
  }

  if (dataRecord.key || dataRecord.message) return [dataRecord]
  if (payload.key || payload.message) return [payload]

  return []
}

function textFromMessage(message: Record<string, unknown>): string | null {
  const content = asRecord(message.message)
  const extendedText = asRecord(content.extendedTextMessage)

  return pickString(
    content.conversation,
    extendedText.text,
    asRecord(content.buttonsResponseMessage).selectedDisplayText,
    asRecord(content.listResponseMessage).title,
    message.text,
    message.body,
  )
}

function isIgnoredRemoteJid(remoteJid: string | null): boolean {
  return (
    !remoteJid ||
    remoteJid.endsWith('@g.us') ||
    remoteJid === 'status@broadcast' ||
    remoteJid.includes('@broadcast')
  )
}

async function storeIncomingMessage(params: {
  supabase: ReturnType<typeof getAdminClient>
  payload: Record<string, unknown>
  message: Record<string, unknown>
}) {
  const key = asRecord(params.message.key)
  if (key.fromMe === true || params.message.fromMe === true) return null

  const remoteJid = pickString(key.remoteJid, params.message.remoteJid, params.message.chatId)
  if (isIgnoredRemoteJid(remoteJid)) return null

  const phone = normalizePhone(remoteJid ?? '')
  const body = textFromMessage(params.message)?.trim()
  if (!phone || !body) return null

  const instanceId = pickString(params.payload.instance, params.message.instance, asRecord(params.payload.data).instance)
    ?? process.env.EVOLUTION_INSTANCE_NAME
    ?? 'sherlocked-main'
  const externalMessageId = pickString(key.id, params.message.id, params.message.messageId)
  const occurredAt = timestampToIso(params.message.messageTimestamp ?? params.message.timestamp ?? asRecord(params.payload.data).date_time)

  const { error } = await params.supabase
    .from('whatsapp_messages')
    .insert({
      instance_id: instanceId,
      external_message_id: externalMessageId,
      to_phone: phone,
      body,
      to_number: phone,
      message: body,
      status: 'received',
      trigger_type: 'incoming',
      created_at: occurredAt,
      updated_at: occurredAt,
    })

  if (error && !error.message.includes('duplicate')) throw error
  return { phone, body, externalMessageId }
}

function firstMessageLogDetails(payload: Record<string, unknown>) {
  const message = messageCandidates(payload)[0]
  const key = asRecord(message?.key)
  const remoteJid = pickString(key.remoteJid, message?.remoteJid, message?.chatId)
  const externalMessageId = pickString(key.id, message?.id, message?.messageId)
  const fromMe = key.fromMe === true || message?.fromMe === true

  return {
    instance_id: pickString(payload.instance, message?.instance, asRecord(payload.data).instance),
    remote_jid: remoteJid,
    external_message_id: externalMessageId,
    direction: fromMe ? 'outbound' : remoteJid ? 'inbound' : null,
    phone: remoteJid ? normalizePhone(remoteJid) : null,
  }
}

/**
 * POST /api/whatsapp/webhook
 * Receives events from Evolution API (webhooks).
 *
 * Handles:
 *   CONNECTION_UPDATE  → update whatsapp_config status + QR
 *   QRCODE_UPDATED     → store new QR code in DB
 *   MESSAGES_UPSERT    → process incoming client messages (smart replies + booking confirmation)
 */
export async function POST(req: NextRequest) {
  const supabase = getAdminClient()
  const baseLog = {
    endpoint: '/api/whatsapp/webhook',
    method: 'POST',
    request_headers: safeHeaders(req),
    query: queryParams(req),
  }

  let body: Record<string, unknown>
  try {
    body = asRecord(await req.json())
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid JSON payload'
    await logWhatsAppEvent(supabase, {
      ...baseLog,
      status: 'failed',
      auth_ok: null,
      error_message: errorMessage,
    })
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const event = pickString(body.event, body.type)
  const details = firstMessageLogDetails(body)
  const authOk = isWebhookAuthorized(req, body)

  await logWhatsAppEvent(supabase, {
    ...baseLog,
    ...details,
    event,
    auth_ok: authOk,
    status: authOk ? 'received' : 'unauthorized',
    payload: body,
  })

  // Evolution can call this route directly, or via the thin relay service. Keep
  // this compatibility endpoint while Fastify remains the long-term owner.
  if (!authOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ─── CONNECTION_UPDATE ─────────────────────────────────────────────────
    if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
      const data = asRecord(body.data)
      const me = asRecord(data.me)
      const state = pickString(data.state, data.status, data.connection)
      const status =
        state === 'open' || state === 'connected' ? 'connected' :
        state === 'connecting' ? 'connecting' :
        'disconnected'

      await supabase.from('whatsapp_config').update({
        status,
        phone_number: pickString(me.id)?.replace('@s.whatsapp.net', '') ?? undefined,
        last_connected: status === 'connected' ? new Date().toISOString() : undefined,
        qr_code: status === 'connected' ? null : undefined,
        updated_at: new Date().toISOString(),
      }).eq('id', '00000000-0000-0000-0000-000000000001')

      await logWhatsAppEvent(supabase, {
        ...baseLog,
        event,
        auth_ok: true,
        status: 'processed',
        response: { status },
      })
      return NextResponse.json({ received: true, processed: 1 })
    }

    // ─── QRCODE_UPDATED ────────────────────────────────────────────────────
    if (event === 'qrcode.updated' || event === 'QRCODE_UPDATED') {
      const data = asRecord(body.data)
      const base64 = pickString(asRecord(data.qrcode).base64, data.base64)
      if (base64) {
        await supabase.from('whatsapp_config').update({
          qr_code: base64,
          status: 'qr',
          updated_at: new Date().toISOString(),
        }).eq('id', '00000000-0000-0000-0000-000000000001')
      }

      await logWhatsAppEvent(supabase, {
        ...baseLog,
        event,
        auth_ok: true,
        status: base64 ? 'processed' : 'ignored',
        ignored_reason: base64 ? null : 'missing_qr_payload',
      })
      return NextResponse.json({ received: true, processed: base64 ? 1 : 0 })
    }

    // ─── MESSAGES_UPSERT (incoming client messages) ────────────────────────
    if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
      const messages = messageCandidates(body)
      let processed = 0

      for (const message of messages) {
        const stored = await storeIncomingMessage({ supabase, payload: body, message })
        if (!stored) continue
        processed += 1
        const messageText = stored.body.toLowerCase()

        // Verify the bridge trigger wrote to whatsapp_inbox_messages
        let bridgeRow: { id: string; conversation_id: string } | null = null
        let bridgeError: { message: string } | null = null

        if (stored.externalMessageId) {
          const result = await supabase
            .from('whatsapp_inbox_messages')
            .select('id, conversation_id')
            .eq('external_message_id', stored.externalMessageId)
            .eq('direction', 'inbound')
            .maybeSingle()
          bridgeRow = result.data as typeof bridgeRow
          bridgeError = result.error
        } else {
          const result = await supabase
            .from('whatsapp_inbox_messages')
            .select('id, conversation_id')
            .eq('direction', 'inbound')
            .gte('created_at', new Date(Date.now() - 5000).toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          bridgeRow = result.data as typeof bridgeRow
          bridgeError = result.error
        }

        await logWhatsAppEvent(supabase, {
          ...baseLog,
          event: 'bridge.verify',
          auth_ok: true,
          phone: stored.phone,
          external_message_id: stored.externalMessageId ?? null,
          status: bridgeRow ? 'processed' : 'failed',
          ignored_reason: bridgeRow ? null : bridgeError ? bridgeError.message : 'bridge_trigger_did_not_write_inbox_message',
          response: bridgeRow
            ? { inbox_message_id: bridgeRow.id, conversation_id: bridgeRow.conversation_id }
            : { phone: stored.phone, external_message_id: stored.externalMessageId },
        })

        // --- Smart Reply Logic ---
        // Find the last outbound message sent to this number
        const { data: lastSent } = await supabase
          .from('whatsapp_messages')
          .select('id, trigger_type, reference_id, status')
          .eq('to_number', stored.phone)
          .eq('status', 'sent')
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const confirmWords = ['כן', 'yes', 'ok', 'אוקי', 'מאשר', 'מאשרת', '✅', '👍', 'בסדר', 'confirmed']
        const cancelWords  = ['לא', 'ביטול', 'cancel', 'לבטל', 'מבטל', 'מבטלת', '❌', 'no']

        const isConfirm = confirmWords.some(w => messageText.includes(w))
        const isCancel  = cancelWords.some(w => messageText.includes(w))

        if (lastSent?.reference_id) {
          // ── Booking reminder confirmation ────────────────────────────────
          if (lastSent.trigger_type === 'booking_reminder') {
            if (isConfirm) {
              await supabase.from('bookings').update({
                whatsapp_confirmed: true,
                whatsapp_confirmed_at: new Date().toISOString(),
              }).eq('id', lastSent.reference_id)

              await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/whatsapp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: stored.phone,
                  message: 'תודה על האישור! 🎉 מחכים לכם ממש בקרוב. — Sherlocked',
                  triggerType: 'auto_reply_confirm',
                  referenceId: lastSent.reference_id,
                }),
              }).catch(() => {})
            }

            if (isCancel) {
              await supabase.from('bookings').update({
                status: 'pending_cancellation',
              }).eq('id', lastSent.reference_id)

              await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/whatsapp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: stored.phone,
                  message: 'קיבלנו את בקשת הביטול שלכם. מנהל ייצור איתכם קשר בהקדם. — Sherlocked',
                  triggerType: 'auto_reply_cancel',
                  referenceId: lastSent.reference_id,
                }),
              }).catch(() => {})
            }
          }

          // ── Payment request reply ────────────────────────────────────────
          if (lastSent.trigger_type === 'payment_request' && isConfirm) {
            await supabase.from('whatsapp_messages').update({
              error: 'client_confirmed_payment',
            }).eq('id', lastSent.id)
          }
        }
      }

      await logWhatsAppEvent(supabase, {
        ...baseLog,
        ...details,
        event,
        auth_ok: true,
        status: processed > 0 ? 'processed' : 'ignored',
        processed_count: processed,
        ignored_reason: processed > 0 ? null : 'no_supported_incoming_text_messages',
        response: { processed, candidates: messages.length },
      })

      return NextResponse.json({ received: true, processed })
    }

    await logWhatsAppEvent(supabase, {
      ...baseLog,
      ...details,
      event,
      auth_ok: true,
      status: 'ignored',
      ignored_reason: 'unsupported_event',
      response: { event },
    })

    return NextResponse.json({ received: true, ignored: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Webhook processing failed'
    await logWhatsAppEvent(supabase, {
      ...baseLog,
      ...details,
      event,
      auth_ok: true,
      status: 'failed',
      error_message: errorMessage,
      payload: body,
    })
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
