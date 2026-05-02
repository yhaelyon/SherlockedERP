import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { getInstanceStatus, setWebhook } from '@/lib/whatsapp-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const WEBHOOK_SYNC_INTERVAL_MS = 10 * 60 * 1000
let lastWebhookSyncAt = 0

function productionOrigin(req: NextRequest): string | null {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
  const candidates = [
    configuredOrigin?.startsWith('http') ? configuredOrigin : null,
    req.nextUrl.origin,
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    const origin = candidate.replace(/\/$/, '')
    const hostname = new URL(origin).hostname
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return origin
  }

  return null
}

async function syncWebhookIfNeeded(req: NextRequest) {
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) return

  const now = Date.now()
  if (now - lastWebhookSyncAt < WEBHOOK_SYNC_INTERVAL_MS) return

  const origin = productionOrigin(req)
  if (!origin) return

  lastWebhookSyncAt = now
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET ?? process.env.EVOLUTION_API_KEY
  const webhookUrl = `${origin}/api/whatsapp/webhook?secret=${encodeURIComponent(secret)}`

  await setWebhook(webhookUrl)
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
      await syncWebhookIfNeeded(req).catch(error => {
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
