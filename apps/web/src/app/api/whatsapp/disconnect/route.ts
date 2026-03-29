import { getAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { logoutInstance } from '@/lib/whatsapp-client'

export const dynamic = 'force-dynamic'

/**
 * POST /api/whatsapp/disconnect
 * Logs out and disconnects the WhatsApp instance.
 */
export async function POST() {
  const supabase = getAdminClient()
  try {
    await logoutInstance()
  } catch { /* ignore — might already be disconnected */ }

  await supabase.from('whatsapp_config').update({
    status: 'disconnected',
    phone_number: null,
    qr_code: null,
    updated_at: new Date().toISOString(),
  }).eq('id', '00000000-0000-0000-0000-000000000001')

  return NextResponse.json({ success: true })
}
