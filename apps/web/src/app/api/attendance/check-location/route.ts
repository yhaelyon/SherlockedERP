import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = 'https://rqjxemirswoxxsmjvfrc.supabase.co'
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxanhlbWlyc3dveHhzbWp2ZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyMTIwOCwiZXhwIjoyMDg5MDk3MjA4fQ.lQrfVibfq3gMwcTNMhypPVpozHyTHU_Kb8po5ooFPds'

// Test location coordinates: 32°00'37.7"N 34°46'04.2"E
const TEST_LOCATION = { lat: 32.010472, lng: 34.767833, radius: 150 }

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'לא זוהה'
}

// POST /api/attendance/check-location
// Body: {
//   mode: 'gps' | 'ip' | 'test_location' | 'my_ip'
//   branch_id?: string
//   lat?: number
//   lng?: number
//   test_ip?: string   // test arbitrary IP against branch (admin testing)
// }
export async function POST(req: NextRequest) {
  const { mode, branch_id, lat, lng, test_ip } = await req.json()
  const clientIp = getClientIp(req)

  // mode: my_ip — just return the detected IP
  if (mode === 'my_ip') {
    return NextResponse.json({ client_ip: clientIp })
  }

  // mode: test_location — check GPS against hardcoded test coordinates
  if (mode === 'test_location') {
    if (lat === undefined || lng === undefined) {
      return NextResponse.json({
        allowed: false,
        method: 'gps',
        client_ip: clientIp,
        target_coords: TEST_LOCATION,
        error: 'לא התקבלו קואורדינטות GPS',
      })
    }
    const dist = haversineDistance(lat, lng, TEST_LOCATION.lat, TEST_LOCATION.lng)
    return NextResponse.json({
      allowed: dist <= TEST_LOCATION.radius,
      method: 'gps',
      distance_meters: Math.round(dist),
      radius_meters: TEST_LOCATION.radius,
      your_coords: { lat, lng },
      target_coords: { lat: TEST_LOCATION.lat, lng: TEST_LOCATION.lng },
      client_ip: clientIp,
    })
  }

  // For all other modes, we need a branch_id
  if (!branch_id) {
    return NextResponse.json({ allowed: false, client_ip: clientIp, error: 'נדרש branch_id' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data: branch, error: branchErr } = await supabase
    .from('branches')
    .select('name, venue_lat, venue_lng, venue_radius_meters, venue_static_ip')
    .eq('id', branch_id)
    .single()

  if (branchErr || !branch) {
    return NextResponse.json({
      allowed: false,
      client_ip: clientIp,
      error: branchErr?.message ?? 'סניף לא נמצא',
    }, { status: 404 })
  }

  // mode: ip — test IP (real client IP or provided test_ip) against branch
  if (mode === 'ip') {
    const ipToCheck = test_ip ?? clientIp
    const branchIp = branch.venue_static_ip ?? null
    const match = !!branchIp && ipToCheck === branchIp
    return NextResponse.json({
      allowed: match,
      method: 'ip',
      client_ip: clientIp,
      tested_ip: ipToCheck,
      branch_ip: branchIp,
      branch_name: branch.name,
      match,
    })
  }

  // mode: gps — test GPS against branch venue coordinates
  if (branch.venue_lat == null) {
    return NextResponse.json({
      allowed: false,
      method: 'gps',
      client_ip: clientIp,
      branch_name: branch.name,
      branch_ip: branch.venue_static_ip ?? null,
      error: 'לא הוגדרו קואורדינטות GPS לסניף זה',
    })
  }

  if (lat === undefined || lng === undefined) {
    return NextResponse.json({
      allowed: false,
      method: 'gps',
      client_ip: clientIp,
      branch_name: branch.name,
      target_coords: { lat: branch.venue_lat, lng: branch.venue_lng },
      error: 'לא התקבלו קואורדינטות GPS',
    })
  }

  const dist = haversineDistance(lat, lng, branch.venue_lat, branch.venue_lng)
  const radius = branch.venue_radius_meters ?? 150
  return NextResponse.json({
    allowed: dist <= radius,
    method: 'gps',
    distance_meters: Math.round(dist),
    radius_meters: radius,
    your_coords: { lat, lng },
    target_coords: { lat: branch.venue_lat, lng: branch.venue_lng },
    client_ip: clientIp,
    branch_name: branch.name,
    branch_ip: branch.venue_static_ip ?? null,
  })
}
