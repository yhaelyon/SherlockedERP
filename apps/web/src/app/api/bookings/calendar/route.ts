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

    // Adjust dates for Israel timezone (UTC+3)
    // Start: 21:00 UTC of the day before
    // End: 03:00 UTC of the day after
    const startAt = new Date(`${startDate}T00:00:00Z`)
    startAt.setUTCHours(startAt.getUTCHours() - 3)
    
    const endAt = new Date(`${endDate}T23:59:59Z`)
    endAt.setUTCHours(endAt.getUTCHours() - 3)

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
      .gte('start_at', startAt.toISOString())
      .lte('start_at', endAt.toISOString())
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
