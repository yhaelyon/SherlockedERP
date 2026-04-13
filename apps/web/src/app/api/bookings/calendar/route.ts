import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const roomId = searchParams.get('room_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!roomId || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Fetch slots with joined booking and customer data
    const { data, error } = await supabase
      .from('slots')
      .select(`
        *,
        bookings (
          *,
          customers (*)
        )
      `)
      .eq('room_id', roomId)
      .gte('start_at', startDate)
      .lte('start_at', endDate)
      .order('start_at', { ascending: true })

    if (error) {
      console.error('[BookingsCalendarAPI] Fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[BookingsCalendarAPI] Fatal error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
