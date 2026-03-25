import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = 'https://rqjxemirswoxxsmjvfrc.supabase.co'
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxanhlbWlyc3dveHhzbWp2ZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyMTIwOCwiZXhwIjoyMDg5MDk3MjA4fQ.lQrfVibfq3gMwcTNMhypPVpozHyTHU_Kb8po5ooFPds'

// PATCH /api/attendance/logs/[id]
// Allows managers/shift_lead to edit clock_in, clock_out, note
// Body: { clock_in?, clock_out?, note?, manager_id }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const body = await req.json()
  const { clock_in, clock_out, note, manager_id } = body

  if (!manager_id) {
    return NextResponse.json({ error: 'manager_id נדרש לעריכה' }, { status: 403 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Verify the manager has a valid role
  const { data: manager } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', manager_id)
    .single()

  if (!manager || !['admin', 'shift_lead', 'manager'].includes(manager.role)) {
    return NextResponse.json({ error: 'אין הרשאה לעריכת שעות' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {
    manual_entry: true,
    manual_by: manager_id,
  }
  if (clock_in !== undefined) updates.clock_in = clock_in
  if (clock_out !== undefined) updates.clock_out = clock_out
  if (note !== undefined) updates.note = note

  const { data, error } = await supabase
    .from('attendance_logs')
    .update(updates)
    .eq('id', id)
    .select('id, user_id, branch_id, clock_in, clock_out, total_minutes, manual_entry, note, branches(name)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
