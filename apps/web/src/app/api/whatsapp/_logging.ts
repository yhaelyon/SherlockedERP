import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

type JsonRecord = Record<string, unknown>

export interface WhatsAppLogInput {
  endpoint: string
  method?: string
  source?: string
  event?: string | null
  instance_id?: string | null
  remote_jid?: string | null
  external_message_id?: string | null
  direction?: string | null
  phone?: string | null
  auth_ok?: boolean | null
  status: 'received' | 'processed' | 'ignored' | 'unauthorized' | 'failed'
  processed_count?: number
  ignored_reason?: string | null
  error_message?: string | null
  request_headers?: JsonRecord | null
  query?: JsonRecord | null
  payload?: unknown
  response?: unknown
}

export function safeHeaders(req: NextRequest): JsonRecord {
  return {
    apikey: req.headers.has('apikey') ? '[present]' : null,
    authorization: req.headers.has('authorization') ? '[present]' : null,
    content_type: req.headers.get('content-type'),
    host: req.headers.get('host'),
    user_agent: req.headers.get('user-agent'),
    x_api_key: req.headers.has('x-api-key') ? '[present]' : null,
    x_forwarded_for: req.headers.get('x-forwarded-for'),
    x_railway_request_id: req.headers.get('x-railway-request-id'),
  }
}

export function queryParams(req: NextRequest): JsonRecord {
  const query: JsonRecord = {}
  req.nextUrl.searchParams.forEach((value, key) => {
    query[key] = key === 'secret' || key === 'token' ? '[present]' : value
  })
  return query
}

export async function logWhatsAppEvent(supabase: SupabaseClient, input: WhatsAppLogInput) {
  const { error } = await supabase.from('whatsapp_webhook_logs').insert({
    endpoint: input.endpoint,
    method: input.method ?? 'POST',
    source: input.source ?? 'evolution',
    event: input.event ?? null,
    instance_id: input.instance_id ?? null,
    remote_jid: input.remote_jid ?? null,
    external_message_id: input.external_message_id ?? null,
    direction: input.direction ?? null,
    phone: input.phone ?? null,
    auth_ok: input.auth_ok ?? null,
    status: input.status,
    processed_count: input.processed_count ?? 0,
    ignored_reason: input.ignored_reason ?? null,
    error_message: input.error_message ?? null,
    request_headers: input.request_headers ?? null,
    query: input.query ?? null,
    payload: input.payload ?? null,
    response: input.response ?? null,
  })

  if (error) {
    console.warn('[WhatsAppLog] Failed to persist log', error.message)
  }
}
