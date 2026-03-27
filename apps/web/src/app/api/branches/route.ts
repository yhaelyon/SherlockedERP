import { getAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Try with public client (if RLS allows reading branches anonymously)
    const publicSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )
    
    let { data, error } = await publicSupabase
      .from('branches')
      .select('id, name, venue_lat, venue_lng, venue_radius_meters')
      .order('name')

    // 2. If blocked by RLS or empty, use admin client
    if (error || !data || data.length === 0) {
      const admin = getAdminClient()
      const { data: d2, error: e2 } = await admin.from('branches').select('id, name, venue_lat, venue_lng, venue_radius_meters').order('name')
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      return NextResponse.json(d2 ?? [])
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error('[Branches API] Error:', e)
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 })
  }
}
