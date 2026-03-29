import { getAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getQRCode } from '@/lib/whatsapp-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/whatsapp/qr
 * Returns the latest QR code image from Evolution API.
 * Called every 10 seconds while the user is on the pairing screen.
 */
export async function GET() {
  try {
    const qrData = await getQRCode()
    const base64 = qrData?.base64 ?? qrData?.code ?? null

    if (!base64) {
      return NextResponse.json({ qrCode: null, message: 'Already connected or QR expired' })
    }

    // Update DB with latest QR
    const supabase = getAdminClient()
    await supabase.from('whatsapp_config').update({
      qr_code: base64,
      status: 'qr',
      updated_at: new Date().toISOString(),
    }).eq('id', '00000000-0000-0000-0000-000000000001')

    return NextResponse.json({ qrCode: base64 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'QR fetch failed'
    return NextResponse.json({ qrCode: null, error: msg }, { status: 500 })
  }
}
