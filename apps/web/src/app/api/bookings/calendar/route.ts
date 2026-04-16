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

    // Israel operational day: 06:00 local → 06:00 local next day
    // In UTC (Israel = UTC+3): 03:00 UTC → 03:00 UTC next day
    //
    // Start window: startDate at 03:00 UTC = 06:00 Israel (beginning of operational day)
    // End window:   day AFTER endDate at 03:00 UTC = 06:00 Israel next day
    //               This captures all after-midnight slots (00:30, 02:00, etc.)
    //               which are stored as UTC on the next calendar day
    const startAt = new Date(`${startDate}T03:00:00Z`)

    // End = next day after endDate at 03:00 UTC
    const endDayAfter = new Date(`${endDate}T03:00:00Z`)
    endDayAfter.setUTCDate(endDayAfter.getUTCDate() + 1)
    const endAt = endDayAfter

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
