import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { user_id, lat, lng } = await req.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Get latest open shift
    const { data: log, error: logError } = await supabase
      .from('attendance_logs')
      .select('id, clock_in')
      .eq('user_id', user_id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .maybeSingle()

    if (logError || !log) {
      return NextResponse.json({ error: 'אין משמרת פתוחה לסיום' }, { status: 404 })
    }

    const clockOutAt = new Date().toISOString()
    const diffMs = new Date(clockOutAt).getTime() - new Date(log.clock_in).getTime()
    const totalMinutes = Math.floor(diffMs / 60000)

    // 2. Update shift
    const { error: updateError } = await supabase
      .from('attendance_logs')
      .update({
        clock_out: clockOutAt,
        total_minutes: Math.max(0, totalMinutes),
      })
      .eq('id', log.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, totalMinutes })
  } catch (e) {
    console.error('[ClockOut] Error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
