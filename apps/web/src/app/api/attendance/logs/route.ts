import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = 'https://rqjxemirswoxxsmjvfrc.supabase.co'
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxanhlbWlyc3dveHhzbWp2ZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyMTIwOCwiZXhwIjoyMDg5MDk3MjA4fQ.lQrfVibfq3gMwcTNMhypPVpozHyTHU_Kb8po5ooFPds'

// GET /api/attendance/logs?user_id=xxx&month=YYYY-MM
// Returns attendance history for a user
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')
  const month = searchParams.get('month') // YYYY-MM

  if (!user_id) {
    return NextResponse.json({ error: 'user_id נדרש' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  let query = supabase
    .from('attendance_logs')
    .select('id, user_id, branch_id, clock_in, clock_out, total_minutes, manual_entry, note, branches(name)')
    .eq('user_id', user_id)
    .order('clock_in', { ascending: false })

  if (month) {
    const [year, m] = month.split('-')
    const paddedMonth = String(m).padStart(2, '0')
    const start = `${year}-${paddedMonth}-01T00:00:00Z`
    const nextMonth = new Date(parseInt(year), parseInt(m), 1)
    const end = nextMonth.toISOString()
    query = query.gte('clock_in', start).lt('clock_in', end)
  } else {
    // Default: current month
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
    query = query.gte('clock_in', start).lt('clock_in', end)
  }

  const { data, error } = await query.limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
