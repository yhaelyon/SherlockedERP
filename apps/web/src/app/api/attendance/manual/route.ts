import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = 'https://rqjxemirswoxxsmjvfrc.supabase.co'
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxanhlbWlyc3dveHhzbWp2ZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyMTIwOCwiZXhwIjoyMDg5MDk3MjA4fQ.lQrfVibfq3gMwcTNMhypPVpozHyTHU_Kb8po5ooFPds'

// POST /api/attendance/manual
// Manager manually adds a shift for any employee
// Body: { user_id, branch_id, clock_in, clock_out?, note?, manager_id }
export async function POST(req: NextRequest) {
  const { user_id, branch_id, clock_in, clock_out, note, manager_id } = await req.json()

  if (!user_id || !branch_id || !clock_in || !manager_id) {
    return NextResponse.json({ error: 'user_id, branch_id, clock_in, manager_id נדרשים' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Verify manager role
  const { data: manager } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', manager_id)
    .single()

  if (!manager || !['admin', 'shift_lead', 'manager'].includes(manager.role)) {
    return NextResponse.json({ error: 'אין הרשאה לרישום ידני' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('attendance_logs')
    .insert({
      user_id,
      branch_id,
      clock_in,
      clock_out: clock_out ?? null,
      wifi_token_verified: false,
      manual_entry: true,
      manual_by: manager_id,
      note: note ?? null,
    })
    .select('id, user_id, branch_id, clock_in, clock_out, total_minutes, manual_entry, note, branches(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
