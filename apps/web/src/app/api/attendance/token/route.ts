import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/attendance/token?branch_id=...
// Used by branch tablets to display the rotating code
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const branch_id = searchParams.get('branch_id')

    if (!branch_id) {
      return NextResponse.json({ error: 'Missing branch_id' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // 1. Check for existing valid token
    const { data: existing } = await supabase
      .from('branch_attendance_tokens')
      .select('token, expires_at')
      .eq('branch_id', branch_id)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ token: existing.token, expires_at: existing.expires_at })
    }

    // 2. Generate new 6-digit token
    const newToken = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase
      .from('branch_attendance_tokens')
      .insert({
        branch_id,
        token: newToken,
        expires_at: expiresAt
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ token: newToken, expires_at: expiresAt })
  } catch (e) {
    console.error('[AttendanceToken] Error:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
