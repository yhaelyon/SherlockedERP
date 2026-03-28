import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/attendance/logs?user_id=xxx&month=YYYY-MM
// Returns attendance history for a user
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')
  const month = searchParams.get('month') // YYYY-MM

  if (!user_id) {
    return NextResponse.json({ error: 'user_id נדרש' }, { status: 400 })
  }

  const supabase = getAdminClient()

  let query = supabase
    .from('attendance_logs')
    .select('id, user_id, branch_id, clock_in, clock_out, total_minutes, manual_entry, note, branches(name)')
    .eq('user_id', user_id)
    .order('clock_in', { ascending: false })

  if (month) {
    const [year, m] = month.split('-')
    const paddedMonth = String(m).padStart(2, '0')
    const start = `${year}-${paddedMonth}-01T00:00:00Z`
    
    // Calculate next month for range
    const nextMonthDate = new Date(parseInt(year), parseInt(m), 1)
    const end = nextMonthDate.toISOString()
    
    query = query.gte('clock_in', start).lt('clock_in', end)
  } else {
    // Default: current month
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
    query = query.gte('clock_in', start).lt('clock_in', end)
  }

  const { data, error } = await query.limit(500)

  if (error) {
    console.error('[AttendanceLogs] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
