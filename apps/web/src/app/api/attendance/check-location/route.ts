import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { user_id, branch_id } = await req.json()
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get('lat') || '0')
    const lng = parseFloat(searchParams.get('lng') || '0')

    const supabase = getAdminClient()

    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('venue_lat, venue_lng, venue_radius_meters')
      .eq('id', branch_id)
      .single()

    if (branchError || !branch) {
      return NextResponse.json({ error: 'סניף לא נמצא' }, { status: 404 })
    }

    const R = 6371e3
    const φ1 = (lat * Math.PI) / 180
    const φ2 = (branch.venue_lat * Math.PI) / 180
    const Δφ = ((branch.venue_lat - lat) * Math.PI) / 180
    const Δλ = ((branch.venue_lng - lng) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const d = R * c

    const radius = branch.venue_radius_meters || 150
    const isInside = d <= radius

    return NextResponse.json({
      inside: isInside,
      distance: Math.round(d),
      radius,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Check location error' }, { status: 500 })
  }
}
