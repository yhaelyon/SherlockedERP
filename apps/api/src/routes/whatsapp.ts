import type { FastifyInstance, FastifyRequest } from 'fastify'
import { supabase } from '../lib/supabase'
import { sendEvolutionImage, sendEvolutionText } from '../lib/evolution'
import { isIgnoredRemoteJid, jidToPhone, normalizePhone, toIsraeliLocalPhone } from '../lib/phone'
import { requirePermission } from '../lib/permissions'

const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? 'sherlocked-main'

interface ConversationRow {
  id: string
  instance_id: string
  remote_jid: string
  phone: string
  customer_id: string | null
  display_name: string | null
  unread_count: number
}

interface CustomerRow {
  id: string
  first_name: string
  last_name: string | null
  phone: string
}

interface ParsedWebhookMessage {
  instanceId: string
  externalMessageId: string | null
  remoteJid: string
  phone: string
  fromMe: boolean
  direction: 'inbound' | 'outbound'
  pushName: string | null
  messageType: 'text' | 'image' | 'unknown'
  body: string | null
  mediaUrl: string | null
  mediaMimeType: string | null
  occurredAt: string
  raw: Record<string, unknown>
}

function webhookSecrets(): string[] {
  return [process.env.WHATSAPP_WEBHOOK_SECRET, process.env.EVOLUTION_API_KEY].filter((value): value is string => Boolean(value))
}

function isWebhookAuthorized(req: FastifyRequest): boolean {
  const secrets = webhookSecrets()
  if (secrets.length === 0) return true

  const query = asRecord(req.query)
  const payload = asRecord(req.body)
  const candidates = [
    req.headers.apikey,
    req.headers['x-api-key'],
    req.headers.authorization?.replace(/^Bearer\s+/i, ''),
    query.secret,
    query.token,
    payload.apikey,
    payload.apiKey,
  ].flatMap((value) => (Array.isArray(value) ? value : [value]))

  return candidates.some((value) => typeof value === 'string' && secrets.includes(value))
}

async function logWebhookEvent(input: {
  endpoint: string
  method?: string
  event?: string | null
  instanceId?: string | null
  remoteJid?: string | null
  externalMessageId?: string | null
  direction?: string | null
  phone?: string | null
  authOk?: boolean | null
  status: 'received' | 'processed' | 'ignored' | 'unauthorized' | 'failed'
  processedCount?: number
  ignoredReason?: string | null
  errorMessage?: string | null
  payload?: unknown
  response?: unknown
}) {
  const { error } = await supabase.from('whatsapp_webhook_logs').insert({
    endpoint: input.endpoint,
    method: input.method ?? 'POST',
    source: 'fastify-api',
    event: input.event ?? null,
    instance_id: input.instanceId ?? null,
    remote_jid: input.remoteJid ?? null,
    external_message_id: input.externalMessageId ?? null,
    direction: input.direction ?? null,
    phone: input.phone ?? null,
    auth_ok: input.authOk ?? null,
    status: input.status,
    processed_count: input.processedCount ?? 0,
    ignored_reason: input.ignoredReason ?? null,
    error_message: input.errorMessage ?? null,
    payload: input.payload ?? null,
    response: input.response ?? null,
  })

  if (error) {
    console.warn('[WhatsAppWebhookLog] Failed to persist log', error.message)
  }
}

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

function parseMessageContent(message: Record<string, unknown>): {
  messageType: 'text' | 'image' | 'unknown'
  body: string | null
  mediaUrl: string | null
  mediaMimeType: string | null
} {
  const content = asRecord(message.message)
  const extendedText = asRecord(content.extendedTextMessage)
  const image = asRecord(content.imageMessage)

  const text = pickString(
    content.conversation,
    extendedText.text,
    asRecord(content.buttonsResponseMessage).selectedDisplayText,
    asRecord(content.listResponseMessage).title,
    message.text,
    message.body,
  )

  if (Object.keys(image).length > 0) {
    return {
      messageType: 'image',
      body: pickString(image.caption, text),
      mediaUrl: pickString(image.url, image.mediaUrl, message.mediaUrl),
      mediaMimeType: pickString(image.mimetype, message.mimetype),
    }
  }

  if (text) {
    return { messageType: 'text', body: text, mediaUrl: null, mediaMimeType: null }
  }

  return { messageType: 'unknown', body: null, mediaUrl: null, mediaMimeType: null }
}

function parseWebhookMessage(payload: Record<string, unknown>, message: Record<string, unknown>): ParsedWebhookMessage | null {
  const key = asRecord(message.key)
  const instanceId = pickString(payload.instance, message.instance, asRecord(payload.data).instance) ?? INSTANCE
  const remoteJid = pickString(key.remoteJid, message.remoteJid, message.chatId)
  if (!remoteJid || isIgnoredRemoteJid(remoteJid)) return null

  const fromMe = key.fromMe === true || message.fromMe === true
  const phone = jidToPhone(remoteJid)
  if (!phone) return null

  const content = parseMessageContent(message)

  return {
    instanceId,
    externalMessageId: pickString(key.id, message.id, message.messageId),
    remoteJid,
    phone,
    fromMe,
    direction: fromMe ? 'outbound' : 'inbound',
    pushName: pickString(message.pushName, message.notifyName, asRecord(payload.data).pushName),
    messageType: content.messageType,
    body: content.body,
    mediaUrl: content.mediaUrl,
    mediaMimeType: content.mediaMimeType,
    occurredAt: timestampToIso(message.messageTimestamp ?? message.timestamp ?? asRecord(payload.data).date_time),
    raw: message,
  }
}

function previewForMessage(messageType: string, body: string | null): string {
  if (body?.trim()) return body.trim().slice(0, 180)
  if (messageType === 'image') return 'תמונה'
  return 'הודעה'
}

function extractExternalMessageId(result: unknown): string | null {
  const record = asRecord(result)
  const key = asRecord(record.key)
  const message = asRecord(record.message)
  const messageKey = asRecord(message.key)
  return pickString(key.id, messageKey.id, record.id, record.messageId)
}

async function findCustomerByPhone(phone: string): Promise<CustomerRow | null> {
  const local = toIsraeliLocalPhone(phone)
  const candidates = [phone, local].filter((value): value is string => Boolean(value))
  if (candidates.length === 0) return null

  const filter = candidates.map((candidate) => `phone.eq.${candidate}`).join(',')
  const { data } = await supabase
    .from('customers')
    .select('id, first_name, last_name, phone')
    .or(filter)
    .limit(1)
    .maybeSingle()

  return data as CustomerRow | null
}

function customerName(customer: CustomerRow | null): string | null {
  if (!customer) return null
  return [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || null
}

async function getOrCreateConversation(params: {
  instanceId: string
  remoteJid: string
  phone: string
  rawPhone?: string | null
  pushName?: string | null
}): Promise<ConversationRow> {
  const { data: existing } = await supabase
    .from('whatsapp_inbox_conversations')
    .select('id, instance_id, remote_jid, phone, customer_id, display_name, unread_count')
    .eq('instance_id', params.instanceId)
    .eq('remote_jid', params.remoteJid)
    .maybeSingle()

  if (existing) return existing as ConversationRow

  const customer = await findCustomerByPhone(params.phone)
  const displayName = params.pushName ?? customerName(customer) ?? params.phone

  const { data, error } = await supabase
    .from('whatsapp_inbox_conversations')
    .insert({
      instance_id: params.instanceId,
      remote_jid: params.remoteJid,
      phone: params.phone,
      raw_phone: params.rawPhone ?? params.phone,
      customer_id: customer?.id ?? null,
      display_name: displayName,
      status: 'open',
    })
    .select('id, instance_id, remote_jid, phone, customer_id, display_name, unread_count')
    .single()

  if (!error && data) return data as ConversationRow

  const { data: raced, error: racedError } = await supabase
    .from('whatsapp_inbox_conversations')
    .select('id, instance_id, remote_jid, phone, customer_id, display_name, unread_count')
    .eq('instance_id', params.instanceId)
    .eq('remote_jid', params.remoteJid)
    .single()

  if (racedError || !raced) throw error ?? racedError
  return raced as ConversationRow
}

async function updateConversationAfterMessage(params: {
  conversation: ConversationRow
  parsed: ParsedWebhookMessage
  isNewMessage: boolean
}) {
  const customer = params.conversation.customer_id ? null : await findCustomerByPhone(params.parsed.phone)
  const displayName =
    params.parsed.pushName ??
    params.conversation.display_name ??
    customerName(customer) ??
    params.parsed.phone

  await supabase
    .from('whatsapp_inbox_conversations')
    .update({
      phone: params.parsed.phone,
      raw_phone: params.parsed.phone,
      customer_id: params.conversation.customer_id ?? customer?.id ?? null,
      display_name: displayName,
      last_message_preview: previewForMessage(params.parsed.messageType, params.parsed.body),
      last_message_at: params.parsed.occurredAt,
      unread_count: params.parsed.direction === 'inbound' && params.isNewMessage
        ? (params.conversation.unread_count ?? 0) + 1
        : params.conversation.unread_count ?? 0,
    })
    .eq('id', params.conversation.id)
}

async function persistWebhookMessage(parsed: ParsedWebhookMessage) {
  let existingMessageId: string | null = null

  if (parsed.externalMessageId) {
    const { data: existing } = await supabase
      .from('whatsapp_inbox_messages')
      .select('id, conversation_id')
      .eq('instance_id', parsed.instanceId)
      .eq('external_message_id', parsed.externalMessageId)
      .maybeSingle()

    if (existing) existingMessageId = (existing as { id: string }).id
  }

  const conversation = await getOrCreateConversation({
    instanceId: parsed.instanceId,
    remoteJid: parsed.remoteJid,
    phone: parsed.phone,
    pushName: parsed.pushName,
  })

  if (existingMessageId) {
    await supabase
      .from('whatsapp_inbox_messages')
      .update({
        status: parsed.direction === 'outbound' ? 'sent' : 'received',
        raw_payload: parsed.raw,
        body: parsed.body,
        media_url: parsed.mediaUrl,
        media_mime_type: parsed.mediaMimeType,
      })
      .eq('id', existingMessageId)

    await updateConversationAfterMessage({ conversation, parsed, isNewMessage: false })
    return
  }

  const { error } = await supabase
    .from('whatsapp_inbox_messages')
    .insert({
      conversation_id: conversation.id,
      instance_id: parsed.instanceId,
      external_message_id: parsed.externalMessageId,
      direction: parsed.direction,
      from_me: parsed.fromMe,
      message_type: parsed.messageType,
      body: parsed.body,
      media_url: parsed.mediaUrl,
      media_mime_type: parsed.mediaMimeType,
      status: parsed.direction === 'outbound' ? 'sent' : 'received',
      raw_payload: parsed.raw,
      sent_at: parsed.direction === 'outbound' ? parsed.occurredAt : null,
      received_at: parsed.direction === 'inbound' ? parsed.occurredAt : null,
    })

  if (error && !parsed.externalMessageId) throw error
  if (error && !error.message.includes('duplicate')) throw error

  await updateConversationAfterMessage({ conversation, parsed, isNewMessage: !error })
}

async function updateConnectionFromWebhook(payload: Record<string, unknown>) {
  const data = asRecord(payload.data)
  const state = pickString(data.state, data.status, data.connection)
  const status = state === 'open' || state === 'connected' ? 'connected' : 'disconnected'

  await supabase
    .from('whatsapp_connection')
    .upsert(
      {
        instance_id: pickString(payload.instance, data.instance) ?? INSTANCE,
        status,
        last_connected_at: status === 'connected' ? new Date().toISOString() : null,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: 'instance_id' },
    )

  await supabase
    .from('whatsapp_config')
    .update({
      status,
      phone_number: pickString(asRecord(data.me).id)?.replace('@s.whatsapp.net', '') ?? undefined,
      last_connected: status === 'connected' ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', '00000000-0000-0000-0000-000000000001')
}

export async function whatsappRoutes(app: FastifyInstance) {
  // POST /whatsapp/send — legacy automated/admin send path.
  app.post('/whatsapp/send', async (req, reply) => {
    const user = await requirePermission(req, reply, 'whatsapp_inbox')
    if (!user) return

    const { to_phone, template_name, body, booking_id } = req.body as {
      to_phone: string
      template_name: string
      body: string
      booking_id?: string
    }

    const { waQueue } = await import('../queues/whatsapp')
    await waQueue.add('send-message', {
      to_phone,
      template_name,
      body,
      booking_id,
    })

    return reply.send({ queued: true })
  })

  // GET /whatsapp/status — connection status for the inbox badge.
  app.get('/whatsapp/status', async (req, reply) => {
    const user = await requirePermission(req, reply, 'whatsapp_inbox')
    if (!user) return

    const { data: configStatus } = await supabase
      .from('whatsapp_config')
      .select('status, phone_number, instance_id, last_connected, updated_at')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle()

    if (configStatus?.status === 'connected') {
      return reply.send({
        ...configStatus,
        last_connected_at: configStatus.last_connected,
      })
    }

    const { data: connectionStatus } = await supabase
      .from('whatsapp_connection')
      .select('*')
      .order('last_checked_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return reply.send(connectionStatus ?? configStatus ?? { status: 'unknown' })
  })

  app.get('/whatsapp/inbox/conversations', async (req, reply) => {
    const user = await requirePermission(req, reply, 'whatsapp_inbox')
    if (!user) return

    const { data, error } = await supabase
      .from('whatsapp_inbox_conversations')
      .select('*, customers(id, first_name, last_name, phone)')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200)

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data ?? [])
  })

  app.get('/whatsapp/inbox/conversations/:id/messages', async (req, reply) => {
    const user = await requirePermission(req, reply, 'whatsapp_inbox')
    if (!user) return

    const { id } = req.params as { id: string }

    const { data, error } = await supabase
      .from('whatsapp_inbox_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(500)

    if (error) return reply.status(500).send({ error: error.message })

    await supabase
      .from('whatsapp_inbox_conversations')
      .update({ unread_count: 0 })
      .eq('id', id)

    await supabase
      .from('whatsapp_inbox_messages')
      .update({ status: 'read' })
      .eq('conversation_id', id)
      .eq('direction', 'inbound')
      .eq('status', 'received')

    const sorted = [...(data ?? [])].sort((a, b) => {
      const aRecord = a as { received_at?: string | null; sent_at?: string | null; created_at: string }
      const bRecord = b as { received_at?: string | null; sent_at?: string | null; created_at: string }
      const aTime = new Date(aRecord.received_at ?? aRecord.sent_at ?? aRecord.created_at).getTime()
      const bTime = new Date(bRecord.received_at ?? bRecord.sent_at ?? bRecord.created_at).getTime()
      return aTime - bTime
    })

    return reply.send(sorted)
  })

  app.post('/whatsapp/inbox/conversations/:id/messages/text', async (req, reply) => {
    const user = await requirePermission(req, reply, 'whatsapp_inbox')
    if (!user) return

    const { id } = req.params as { id: string }
    const { body } = req.body as { body?: string }
    const text = body?.trim()

    if (!text) return reply.status(400).send({ error: 'Message body is required' })

    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_inbox_conversations')
      .select('id, instance_id, remote_jid, phone, customer_id, display_name, unread_count')
      .eq('id', id)
      .single()

    if (convError || !conversation) return reply.status(404).send({ error: 'Conversation not found' })

    const occurredAt = new Date().toISOString()
    const { data: pending, error: insertError } = await supabase
      .from('whatsapp_inbox_messages')
      .insert({
        conversation_id: id,
        instance_id: (conversation as ConversationRow).instance_id,
        direction: 'outbound',
        from_me: true,
        sender_user_id: user.id,
        message_type: 'text',
        body: text,
        status: 'pending',
        sent_at: occurredAt,
      })
      .select('*')
      .single()

    if (insertError || !pending) return reply.status(500).send({ error: insertError?.message ?? 'Failed to create message' })

    await supabase
      .from('whatsapp_inbox_conversations')
      .update({
        last_message_preview: previewForMessage('text', text),
        last_message_at: occurredAt,
      })
      .eq('id', id)

    try {
      const result = await sendEvolutionText(normalizePhone((conversation as ConversationRow).phone), text)
      const externalMessageId = extractExternalMessageId(result)

      const { data: updated } = await supabase
        .from('whatsapp_inbox_messages')
        .update({
          external_message_id: externalMessageId,
          status: 'sent',
          raw_payload: result as Record<string, unknown>,
        })
        .eq('id', (pending as { id: string }).id)
        .select('*')
        .single()

      return reply.send(updated ?? pending)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Send failed'
      const { data: failed } = await supabase
        .from('whatsapp_inbox_messages')
        .update({ status: 'failed', raw_payload: { error: message } })
        .eq('id', (pending as { id: string }).id)
        .select('*')
        .single()

      return reply.status(502).send({ error: message, message: failed ?? pending })
    }
  })

  app.post('/whatsapp/inbox/conversations/:id/messages/image', { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
    const user = await requirePermission(req, reply, 'whatsapp_inbox')
    if (!user) return

    const { id } = req.params as { id: string }
    const { mediaUrl, caption, mimeType, fileName } = req.body as {
      mediaUrl?: string
      caption?: string
      mimeType?: string
      fileName?: string
    }

    if (!mediaUrl) return reply.status(400).send({ error: 'Image mediaUrl is required' })

    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_inbox_conversations')
      .select('id, instance_id, remote_jid, phone, customer_id, display_name, unread_count')
      .eq('id', id)
      .single()

    if (convError || !conversation) return reply.status(404).send({ error: 'Conversation not found' })

    const occurredAt = new Date().toISOString()
    const body = caption?.trim() || null

    const { data: pending, error: insertError } = await supabase
      .from('whatsapp_inbox_messages')
      .insert({
        conversation_id: id,
        instance_id: (conversation as ConversationRow).instance_id,
        direction: 'outbound',
        from_me: true,
        sender_user_id: user.id,
        message_type: 'image',
        body,
        media_url: mediaUrl,
        media_mime_type: mimeType ?? 'image/jpeg',
        status: 'pending',
        sent_at: occurredAt,
      })
      .select('*')
      .single()

    if (insertError || !pending) return reply.status(500).send({ error: insertError?.message ?? 'Failed to create image message' })

    await supabase
      .from('whatsapp_inbox_conversations')
      .update({
        last_message_preview: previewForMessage('image', body),
        last_message_at: occurredAt,
      })
      .eq('id', id)

    try {
      const result = await sendEvolutionImage({
        phone: normalizePhone((conversation as ConversationRow).phone),
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
        .eq('id', (pending as { id: string }).id)
        .select('*')
        .single()

      return reply.send(updated ?? pending)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Send failed'
      const { data: failed } = await supabase
        .from('whatsapp_inbox_messages')
        .update({ status: 'failed', raw_payload: { error: message } })
        .eq('id', (pending as { id: string }).id)
        .select('*')
        .single()

      return reply.status(502).send({ error: message, message: failed ?? pending })
    }
  })

  // POST /whatsapp/webhook — Evolution API webhook, direct or via apps/whatsapp relay.
  app.post('/whatsapp/webhook', async (req, reply) => {
    const payload = asRecord(req.body)
    const event = pickString(payload.event, payload.type)
    const firstParsed = messageCandidates(payload)
      .map((message) => parseWebhookMessage(payload, message))
      .find(Boolean)

    if (!isWebhookAuthorized(req)) {
      await logWebhookEvent({
        endpoint: '/api/v1/whatsapp/webhook',
        event,
        instanceId: firstParsed?.instanceId,
        remoteJid: firstParsed?.remoteJid,
        externalMessageId: firstParsed?.externalMessageId,
        direction: firstParsed?.direction,
        phone: firstParsed?.phone,
        authOk: false,
        status: 'unauthorized',
        payload,
      })
      return reply.status(401).send({ error: 'Unauthorized webhook' })
    }

    await logWebhookEvent({
      endpoint: '/api/v1/whatsapp/webhook',
      event,
      instanceId: firstParsed?.instanceId,
      remoteJid: firstParsed?.remoteJid,
      externalMessageId: firstParsed?.externalMessageId,
      direction: firstParsed?.direction,
      phone: firstParsed?.phone,
      authOk: true,
      status: 'received',
      payload,
    })

    if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
      await updateConnectionFromWebhook(payload)
      await logWebhookEvent({
        endpoint: '/api/v1/whatsapp/webhook',
        event,
        authOk: true,
        status: 'processed',
        processedCount: 1,
      })
      return reply.send({ ok: true })
    }

    if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT' || event === 'messages.update') {
      const parsed = messageCandidates(payload)
        .map((message) => parseWebhookMessage(payload, message))
        .filter((message): message is ParsedWebhookMessage => Boolean(message))

      for (const message of parsed) {
        await persistWebhookMessage(message)
      }

      await logWebhookEvent({
        endpoint: '/api/v1/whatsapp/webhook',
        event,
        instanceId: firstParsed?.instanceId,
        remoteJid: firstParsed?.remoteJid,
        externalMessageId: firstParsed?.externalMessageId,
        direction: firstParsed?.direction,
        phone: firstParsed?.phone,
        authOk: true,
        status: parsed.length > 0 ? 'processed' : 'ignored',
        processedCount: parsed.length,
        ignoredReason: parsed.length > 0 ? null : 'no_supported_messages',
        response: { processed: parsed.length },
      })
      return reply.send({ ok: true, processed: parsed.length })
    }

    await logWebhookEvent({
      endpoint: '/api/v1/whatsapp/webhook',
      event,
      authOk: true,
      status: 'ignored',
      ignoredReason: 'unsupported_event',
    })
    return reply.send({ ok: true, ignored: true })
  })

  // GET /whatsapp/qr — get QR code for reconnection.
  app.get('/whatsapp/qr', async (req, reply) => {
    const user = await requirePermission(req, reply, 'admin')
    if (!user) return

    const evolutionUrl = process.env.EVOLUTION_API_URL
    const evolutionKey = process.env.EVOLUTION_API_KEY
    const instance = process.env.EVOLUTION_INSTANCE_NAME ?? 'sherlocked-main'

    if (!evolutionUrl || !evolutionKey) {
      return reply.status(503).send({ error: 'Evolution API not configured' })
    }

    const axios = (await import('axios')).default
    const { data } = await axios.get(
      `${evolutionUrl}/instance/connect/${instance}`,
      { headers: { apikey: evolutionKey } },
    )

    return reply.send(data)
  })
}
