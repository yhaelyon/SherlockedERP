import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { user_id, branch_id, clock_in, clock_out, note } = await req.json()

    if (!user_id || !branch_id || !clock_in || !clock_out) {
      return NextResponse.json({ error: 'Missing logic' }, { status: 400 })
    }

    const cIn = new Date(clock_in)
    const cOut = new Date(clock_out)
    const total_minutes = Math.floor((cOut.getTime() - cIn.getTime()) / 60000)

    const supabase = getAdminClient()

    const { error } = await supabase.from('attendance_logs').insert({
      user_id,
      branch_id,
      clock_in: cIn.toISOString(),
      clock_out: cOut.toISOString(),
      total_minutes,
      manual_entry: true,
      note,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, total_minutes })
  } catch (e) {
    return NextResponse.json({ error: 'Manual clock error' }, { status: 500 })
  }
}
