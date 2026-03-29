import { getAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getInstanceStatus } from '@/lib/whatsapp-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/whatsapp/status
 * Returns current WhatsApp connection state from Evolution API + cached DB record.
 */
export async function GET() {
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
    return NextResponse.json({
      status: config?.status ?? 'disconnected',
      phoneNumber: config?.phone_number ?? null,
      lastConnected: config?.last_connected ?? null,
      evolutionError: true,
    })
  }
}
