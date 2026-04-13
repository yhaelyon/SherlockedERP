import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/attendance/clock-in
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, branch_id, lat, lng, wifi_token, bypass_location } = body

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

    // 2. Token-based verification (Primary)
    let verifiedMethod = null

    if (wifi_token) {
      const { data: tokenRecord } = await supabase
        .from('branch_attendance_tokens')
        .select('id')
        .eq('branch_id', branch_id)
        .eq('token', wifi_token)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (tokenRecord) {
        verifiedMethod = 'wifi_token'
      } else {
        return NextResponse.json({ error: 'קוד נוכחות שגוי או פג תוקף' }, { status: 403 })
      }
    }

    // 3. Fallback: Radius check if GPS provided and not yet verified by token
    if (!verifiedMethod && lat !== undefined && lng !== undefined) {
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

      if (distance <= (branch.venue_radius_meters || 150)) {
        verifiedMethod = 'gps'
      } else {
        return NextResponse.json(
          { error: `מקום הדיווח רחוק מדי מהסניף (${Math.round(distance)} מטרים)` },
          { status: 403 }
        )
      }
    }

    // 4. Final check: either token, gps, or bypass
    if (!verifiedMethod && !bypass_location) {
      return NextResponse.json({ error: 'יש להזין קוד נוכחות או לאפשר מיקום GPS' }, { status: 403 })
    }
    if (bypass_location && !verifiedMethod) verifiedMethod = 'bypass'

    // 5. Check for existing open shift
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

    // 6. Insert record
    const { error: insertError } = await supabase.from('attendance_logs').insert({
      user_id,
      branch_id,
      clock_in: new Date().toISOString(),
      wifi_token_verified: verifiedMethod === 'wifi_token',
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, verification_method: verifiedMethod })
  } catch (e) {
    console.error('[ClockIn] Fatal Error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
