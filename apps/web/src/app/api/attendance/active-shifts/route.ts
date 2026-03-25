import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/attendance/active-shifts
// Returns list of users currently in shift (clock_out IS NULL)
export async function GET() {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id, user_id, branch_id, clock_in, user_profiles(full_name, role), branches(name)')
    .is('clock_out', null)
    .order('clock_in', { ascending: true })

  if (error) {
    console.error('[ActiveShifts] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
