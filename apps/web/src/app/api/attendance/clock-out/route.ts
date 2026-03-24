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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  let verification_method: 'gps' | 'ip' | 'bypass' = 'bypass'
  const checks: { step: string; result: string; ok: boolean }[] = []

  if (!bypass_location) {
    const { data: branch, error: branchErr } = await supabase
      .from('branches')
      .select('venue_lat, venue_lng, venue_radius_meters, venue_static_ip')
      .eq('id', branch_id)
      .single()

    if (branchErr) {
      return NextResponse.json(
        { error: `שגיאת DB בטעינת סניף: ${branchErr.message}`, checks },
        { status: 500 }
      )
    }
    if (!branch) {
      return NextResponse.json({ error: 'סניף לא נמצא', checks }, { status: 404 })
    }

    const forwarded = req.headers.get('x-forwarded-for')
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : ''
    const radius = branch.venue_radius_meters ?? 150

    // ── Step 1: GPS check ──────────────────────────────────────
    if (lat !== undefined && lng !== undefined && branch.venue_lat != null) {
      const dist = Math.round(haversineDistance(lat, lng, branch.venue_lat, branch.venue_lng))
      const gpsOk = dist <= radius
      checks.push({
        step: 'GPS',
        result: gpsOk
          ? `✅ מרחק ${dist}מ' — בתוך תחום (${radius}מ')`
          : `❌ מרחק ${dist}מ' — מחוץ לתחום (${radius}מ')`,
        ok: gpsOk,
      })
      if (gpsOk) verification_method = 'gps'
    } else if (branch.venue_lat == null) {
      checks.push({ step: 'GPS', result: '⚠️ לא הוגדרו קואורדינטות לסניף', ok: false })
    } else {
      checks.push({ step: 'GPS', result: '⚠️ לא התקבל מיקום מהדפדפן', ok: false })
    }

    // ── Step 2: IP check (fallback) ────────────────────────────
    if (verification_method !== 'gps') {
      if (branch.venue_static_ip) {
        const ipOk = clientIp === branch.venue_static_ip
        checks.push({
          step: 'IP',
          result: ipOk
            ? `✅ IP תואם (${clientIp})`
            : `❌ IP לא תואם — שלך: ${clientIp || 'לא זוהה'} | נדרש: ${branch.venue_static_ip}`,
          ok: ipOk,
        })
        if (ipOk) verification_method = 'ip'
      } else {
        checks.push({ step: 'IP', result: '⚠️ לא הוגדרה כתובת IP קבועה לסניף', ok: false })
      }
    }

    if (verification_method === 'bypass') {
      return NextResponse.json(
        { error: 'לא ניתן לאמת מיקום — GPS ו-IP נכשלו', checks },
        { status: 403 }
      )
    }
  } else {
    checks.push({ step: 'bypass', result: '⚡ מצב בדיקה — בדיקת מיקום עקופה', ok: true })
  }

  const { data: log, error: findErr } = await supabase
    .from('attendance_logs')
    .select('id')
    .eq('user_id', user_id)
    .is('clock_out', null)
    .maybeSingle()

  if (findErr || !log) {
    return NextResponse.json({ error: 'לא נמצא רישום כניסה פתוח', checks }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('attendance_logs')
    .update({ clock_out: new Date().toISOString(), wifi_token_verified: true })
    .eq('id', log.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message, checks }, { status: 500 })
  return NextResponse.json({ ...data, verification_method, checks })
}
