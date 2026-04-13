import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { room_id, day_of_week, time_slots } = body

    if (!room_id || day_of_week === undefined || !Array.isArray(time_slots)) {
      return NextResponse.json({ error: 'Missing req fields' }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { error } = await supabase
      .from('room_weekly_templates')
      .upsert(
        { room_id, day_of_week, time_slots },
        { onConflict: 'room_id, day_of_week' }
      )

    if (error) {
      console.error('[TemplateSave] SQL Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[TemplateSave] Fatal Error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
