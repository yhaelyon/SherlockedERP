import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { getInstanceStatus, setWebhook } from '@/lib/whatsapp-client'
import { logWhatsAppEvent, queryParams, safeHeaders } from '../_logging'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const WEBHOOK_SYNC_INTERVAL_MS = 10 * 60 * 1000
let lastWebhookSyncAt = 0

function productionOrigin(req: NextRequest): string | null {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? 'https'
  const forwardedHost = req.headers.get('x-forwarded-host')
  const host = req.headers.get('host')
  const candidates = [
    forwardedHost ? `${forwardedProto}://${forwardedHost}` : null,
    host ? `${forwardedProto}://${host}` : null,
    configuredOrigin?.startsWith('http') ? configuredOrigin : null,
    req.nextUrl.origin,
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    const origin = candidate.replace(/\/$/, '')
    const hostname = new URL(origin).hostname
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '0.0.0.0') return origin
  }

  return null
}

async function syncWebhookIfNeeded(req: NextRequest, supabase: ReturnType<typeof getAdminClient>) {
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) return

  const now = Date.now()
  if (now - lastWebhookSyncAt < WEBHOOK_SYNC_INTERVAL_MS) return

  const origin = productionOrigin(req)
  if (!origin) return

  const secret = process.env.WHATSAPP_WEBHOOK_SECRET ?? process.env.EVOLUTION_API_KEY
  const webhookUrl = `${origin}/api/whatsapp/webhook?secret=${encodeURIComponent(secret)}`

  try {
    const response = await setWebhook(webhookUrl)
    lastWebhookSyncAt = now
    await logWhatsAppEvent(supabase, {
      endpoint: '/api/whatsapp/status',
      method: 'GET',
      source: 'erp',
      event: 'webhook.set',
      auth_ok: true,
      status: 'processed',
      request_headers: safeHeaders(req),
      query: queryParams(req),
      payload: {
        origin,
        webhookUrl: `${origin}/api/whatsapp/webhook?secret=[present]`,
      },
      response,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync webhook'
    await logWhatsAppEvent(supabase, {
      endpoint: '/api/whatsapp/status',
      method: 'GET',
      source: 'erp',
      event: 'webhook.set',
      auth_ok: true,
      status: 'failed',
      request_headers: safeHeaders(req),
      query: queryParams(req),
      payload: {
        origin,
        webhookUrl: `${origin}/api/whatsapp/webhook?secret=[present]`,
      },
      error_message: errorMessage,
    })
    throw error
  }
}

/**
 * GET /api/whatsapp/status
 * Returns current WhatsApp connection state from Evolution API + cached DB record.
 */
export async function GET(req: NextRequest) {
  const supabase = getAdminClient()

  // Fetch our stored config row
  const { data: config } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()

  // If Evolution API URL is not configured yet, return early
  if (!process.env.EVOLUTION_API_URL) {
    return NextResponse.json({
      status: 'unconfigured',
      phoneNumber: null,
      lastConnected: null,
      config,
    })
  }

  try {
    const instance = await getInstanceStatus()

    const liveStatus =
      !instance         ? 'disconnected' :
      instance.state === 'open'       ? 'connected' :
      instance.state === 'connecting' ? 'connecting' :
      'disconnected'

    if (liveStatus === 'connected') {
      await syncWebhookIfNeeded(req, supabase).catch(error => {
        console.warn('Failed to sync WhatsApp webhook', error)
      })
    }

    // Sync DB if status changed
    if (config && config.status !== liveStatus) {
      await supabase.from('whatsapp_config').update({
        status: liveStatus,
        phone_number: instance?.number ?? config.phone_number,
        last_connected: liveStatus === 'connected' ? new Date().toISOString() : config.last_connected,
        updated_at: new Date().toISOString(),
      }).eq('id', '00000000-0000-0000-0000-000000000001')
    }

    return NextResponse.json({
      status: liveStatus,
      phoneNumber: instance?.number ?? config?.phone_number ?? null,
      profileName: instance?.profileName ?? null,
      lastConnected: config?.last_connected ?? null,
    })
  } catch {
    if (config?.status === 'connected') {
      return NextResponse.json({
        status: 'connected',
        phoneNumber: config.phone_number ?? null,
        lastConnected: config.last_connected ?? null,
      })
    }

    return NextResponse.json({
      status: config?.status ?? 'disconnected',
      phoneNumber: config?.phone_number ?? null,
      lastConnected: config?.last_connected ?? null,
      evolutionError: true,
    })
  }
}
