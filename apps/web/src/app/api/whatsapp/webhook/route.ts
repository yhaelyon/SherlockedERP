import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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
  // Validate webhook secret header (Evolution API sends the apikey as a header)
  const authKey = req.headers.get('apikey')
  if (authKey !== process.env.EVOLUTION_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()
  const body = await req.json()
  const event = body?.event as string

  // ─── CONNECTION_UPDATE ───────────────────────────────────────────────────
  if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
    const state = body?.data?.state as string
    const status =
      state === 'open' ? 'connected' :
      state === 'connecting' ? 'connecting' :
      'disconnected'

    await supabase.from('whatsapp_config').update({
      status,
      phone_number: body?.data?.me?.id?.replace('@s.whatsapp.net', '') ?? undefined,
      last_connected: status === 'connected' ? new Date().toISOString() : undefined,
      qr_code: status === 'connected' ? null : undefined,
      updated_at: new Date().toISOString(),
    }).eq('id', '00000000-0000-0000-0000-000000000001')
  }

  // ─── QRCODE_UPDATED ──────────────────────────────────────────────────────
  if (event === 'qrcode.updated' || event === 'QRCODE_UPDATED') {
    const base64 = body?.data?.qrcode?.base64 ?? body?.data?.base64 ?? null
    if (base64) {
      await supabase.from('whatsapp_config').update({
        qr_code: base64,
        status: 'qr',
        updated_at: new Date().toISOString(),
      }).eq('id', '00000000-0000-0000-0000-000000000001')
    }
  }

  // ─── MESSAGES_UPSERT (incoming client messages) ──────────────────────────
  if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
    const message = body?.data
    // Ignore messages sent BY us (fromMe=true)
    if (message?.key?.fromMe) {
      return NextResponse.json({ received: true })
    }

    const senderNumber = message?.key?.remoteJid?.replace('@s.whatsapp.net', '')
    const messageText  = (
      message?.message?.conversation ??
      message?.message?.extendedTextMessage?.text ??
      ''
    ).trim().toLowerCase()

    if (!senderNumber || !messageText) {
      return NextResponse.json({ received: true })
    }

    // --- Smart Reply Logic ---
    // Find the last outbound message sent to this number
    const { data: lastSent } = await supabase
      .from('whatsapp_messages')
      .select('id, trigger_type, reference_id, status')
      .eq('to_number', senderNumber)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    const confirmWords = ['כן', 'yes', 'ok', 'אוקי', 'מאשר', 'מאשרת', '✅', '👍', 'בסדר', 'confirmed']
    const cancelWords  = ['לא', 'ביטול', 'cancel', 'לבטל', 'מבטל', 'מבטלת', '❌', 'no']

    const isConfirm = confirmWords.some(w => messageText.includes(w))
    const isCancel  = cancelWords.some(w => messageText.includes(w))

    if (lastSent?.reference_id) {
      // ── Booking reminder confirmation ──────────────────────────────────
      if (lastSent.trigger_type === 'booking_reminder') {
        if (isConfirm) {
          // Mark booking as WhatsApp-confirmed
          await supabase.from('bookings').update({
            whatsapp_confirmed: true,
            whatsapp_confirmed_at: new Date().toISOString(),
          }).eq('id', lastSent.reference_id)

          // Send auto-reply
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/whatsapp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: senderNumber,
              message: 'תודה על האישור! 🎉 מחכים לכם ממש בקרוב. — Sherlocked',
              triggerType: 'auto_reply_confirm',
              referenceId: lastSent.reference_id,
            }),
          }).catch(() => {})
        }

        if (isCancel) {
          // Mark booking for manager review
          await supabase.from('bookings').update({
            status: 'pending_cancellation',
          }).eq('id', lastSent.reference_id)

          await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/whatsapp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: senderNumber,
              message: 'קיבלנו את בקשת הביטול שלכם. מנהל ייצור איתכם קשר בהקדם. — Sherlocked',
              triggerType: 'auto_reply_cancel',
              referenceId: lastSent.reference_id,
            }),
          }).catch(() => {})
        }
      }

      // ── Payment request reply ──────────────────────────────────────────
      if (lastSent.trigger_type === 'payment_request' && isConfirm) {
        // Log that client confirmed they paid (manual verification still needed)
        await supabase.from('whatsapp_messages').update({
          error: 'client_confirmed_payment',
        }).eq('id', lastSent.id)
      }
    }

    // Store the incoming message in our log (direction: in)
    await supabase.from('whatsapp_messages').insert({
      to_number: senderNumber,
      message: messageText,
      status: 'received',
      trigger_type: 'incoming',
    })
  }

  return NextResponse.json({ received: true })
}
