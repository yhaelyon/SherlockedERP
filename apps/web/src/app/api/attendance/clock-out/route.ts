import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = 'https://rqjxemirswoxxsmjvfrc.supabase.co'
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxanhlbWlyc3dveHhzbWp2ZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyMTIwOCwiZXhwIjoyMDg5MDk3MjA4fQ.lQrfVibfq3gMwcTNMhypPVpozHyTHU_Kb8po5ooFPds'

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(req: NextRequest) {
  const { user_id, branch_id, lat, lng, bypass_location } = await req.json()

  if (!user_id || !branch_id) {
    return NextResponse.json({ error: 'user_id ו-branch_id נדרשים' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_SERVICE_KEY
  )

  // Location check (skipped when bypass_location=true for test mode)
  if (!bypass_location) {
    const { data: branch } = await supabase
      .from('branches')
      .select('venue_lat, venue_lng, venue_radius_meters, venue_static_ip')
      .eq('id', branch_id)
      .single()

    if (!branch) {
      return NextResponse.json({ error: 'סניף לא נמצא' }, { status: 404 })
    }

    const forwarded = req.headers.get('x-forwarded-for')
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : ''
    const ipAllowed = branch.venue_static_ip && clientIp === branch.venue_static_ip

    if (!ipAllowed) {
      if (lat !== undefined && lng !== undefined && branch.venue_lat != null) {
        const dist = haversineDistance(lat, lng, branch.venue_lat, branch.venue_lng)
        if (dist > (branch.venue_radius_meters ?? 150)) {
          return NextResponse.json(
            { error: 'לא ניתן לרשום נוכחות — ודא שאתה במתחם' },
            { status: 403 }
          )
        }
      } else {
        return NextResponse.json(
          { error: 'לא ניתן לאמת מיקום — אפשר גישה למיקום ונסה שוב' },
          { status: 403 }
        )
      }
    }
  }

  const clockOut = new Date()

  const { data: log, error: findErr } = await supabase
    .from('attendance_logs')
    .select('id, clock_in')
    .eq('user_id', user_id)
    .is('clock_out', null)
    .maybeSingle()

  if (findErr || !log) {
    return NextResponse.json({ error: 'לא נמצא רישום כניסה פתוח' }, { status: 404 })
  }

  const totalMinutes = Math.round(
    (clockOut.getTime() - new Date(log.clock_in).getTime()) / 60000
  )

  const { data, error } = await supabase
    .from('attendance_logs')
    .update({
      clock_out: clockOut.toISOString(),
      total_minutes: totalMinutes,
      wifi_token_verified: true,
    })
    .eq('id', log.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
