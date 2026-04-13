import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { branch_id, start_date, end_date } = body

    if (!branch_id || !start_date || !end_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`[SlotsGenerate] Applying templates to branch ${branch_id} for ${start_date} to ${end_date}...`)
    
    const supabase = getAdminClient()

    const { data: result, error } = await supabase.rpc('apply_branch_templates', {
      p_branch_id: branch_id,
      p_start_date: start_date,
      p_end_date: end_date
    })

    if (error) {
      console.error('[SlotsGenerate] SQL Error:', error)
      return NextResponse.json({ error: 'שגיאה ביצירת סלוטים במשאבי המידע', details: error.message }, { status: 500 })
    }

    const { deleted = 0, conflicts = [] } = (result as any) || {}

    console.log(`[SlotsGenerate] Sync complete. Deleted orphaned slots: ${deleted}. Conflicts: ${conflicts.length}`)
    
    return NextResponse.json({ 
      success: true, 
      message: `היומן סונכרן לתאריכים: ${start_date} - ${end_date}`,
      deleted,
      conflicts
    })
  } catch (e) {
    console.error('[SlotsGenerate] Fatal Error:', e)
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 })
  }
}
