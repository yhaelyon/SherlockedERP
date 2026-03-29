import { getAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { createInstance, getQRCode } from '@/lib/whatsapp-client'

export const dynamic = 'force-dynamic'

/**
 * POST /api/whatsapp/connect
 * Creates the Evolution API instance (if not exists) and returns a QR code.
 */
export async function POST() {
  const supabase = getAdminClient()

  try {
    // Try to create the instance — if it already exists, Evolution API returns it
    let qrData: { base64?: string; code?: string }
    try {
      qrData = await createInstance()
    } catch {
      // Instance may already exist, try to get fresh QR
      qrData = await getQRCode()
    }

    const base64 = qrData?.base64 ?? qrData?.code ?? null

    // Store QR and set status to 'qr' in DB
    await supabase.from('whatsapp_config').update({
      status: 'qr',
      qr_code: base64,
      updated_at: new Date().toISOString(),
    }).eq('id', '00000000-0000-0000-0000-000000000001')

    return NextResponse.json({ success: true, qrCode: base64 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Connection failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
