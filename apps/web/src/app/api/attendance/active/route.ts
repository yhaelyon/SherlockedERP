import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/attendance/active?user_id=xxx
// Returns the currently open shift for a user (clock_out IS NULL)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')

  if (!user_id) {
    return NextResponse.json({ error: 'user_id נדרש' }, { status: 400 })
  }

  const supabase = getAdminClient()

  const { data: rows, error } = await supabase
    .from('attendance_logs')
    .select('id, user_id, branch_id, clock_in, branches(id, name)')
    .eq('user_id', user_id)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)

  if (error) {
    console.error('[AttendanceActive] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ active: rows?.[0] ?? null })
}
