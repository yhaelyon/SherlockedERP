import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/attendance/clock-in
export async function POST(req: NextRequest) {
  try {
    const { user_id, branch_id, lat, lng } = await req.json()

    if (!user_id || !branch_id) {
      return NextResponse.json({ error: 'חסרים פרטים לדיווח' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Verify existence of branch
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id, name, venue_lat, venue_lng, venue_radius_meters')
      .eq('id', branch_id)
      .single()

    if (branchError || !branch) {
      return NextResponse.json({ error: 'סניף לא נמצא' }, { status: 404 })
    }

    // 2. Simple radius check if coordinates provided
    if (lat !== undefined && lng !== undefined) {
      const R = 6371e3 // metres
      const φ1 = (lat * Math.PI) / 180
      const φ2 = (branch.venue_lat * Math.PI) / 180
      const Δφ = ((branch.venue_lat - lat) * Math.PI) / 180
      const Δλ = ((branch.venue_lng - lng) * Math.PI) / 180

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const distance = R * c

      if (distance > (branch.venue_radius_meters || 150)) {
        return NextResponse.json(
          { error: `מקום הדיווח רחוק מדי מהסניף (${Math.round(distance)} מטרים)` },
          { status: 403 }
        )
      }
    }

    // 3. Check for existing open shift
    const { data: existing } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('user_id', user_id)
      .is('clock_out', null)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'כבר רשום כנכנס — יש לסיים משמרת קודם' },
        { status: 409 }
      )
    }

    // 4. Insert record
    const { error: insertError } = await supabase.from('attendance_logs').insert({
      user_id,
      branch_id,
      clock_in: new Date().toISOString(),
      wifi_token_verified: true, // simplified from previous dual-verification
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[ClockIn] Fatal Error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
