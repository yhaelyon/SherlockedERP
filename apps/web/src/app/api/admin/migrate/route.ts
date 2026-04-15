import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

// Secure one-time migration runner
// Protected by a secret token to prevent unauthorized access
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Security: require secret token
  const auth = req.headers.get('x-migration-secret')
  if (auth !== 'sherlocked-migrate-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()
  const results: Record<string, unknown> = {}

  // ─── STEP 1: Diagnose current state ───────────────────────
  const { data: branchData, error: branchErr } = await supabase
    .from('branches')
    .select('id, name, timezone')

  results.branches = branchErr ? { error: branchErr.message } : branchData

  // ─── STEP 2: Sample slots - show UTC vs local mismatch ────
  const { data: sampleSlots, error: slotErr } = await supabase
    .from('slots')
    .select(`
      id,
      start_at,
      status,
      rooms ( name, branches ( name, timezone ) )
    `)
    .gte('start_at', new Date().toISOString())
    .lte('start_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('start_at')
    .limit(40)

  // Show what browser would display vs what's stored
  results.slot_sample = slotErr
    ? { error: slotErr.message }
    : sampleSlots?.map((s: any) => ({
        room: s.rooms?.name,
        branch: s.rooms?.branches?.name,
        tz: s.rooms?.branches?.timezone,
        stored_utc: s.start_at,
        // Calculate what Israel local time this UTC becomes
        israel_local: new Date(s.start_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }),
        status: s.status
      }))

  // ─── STEP 3: Check room_weekly_templates sample ───────────
  const { data: tplData, error: tplErr } = await supabase
    .from('room_weekly_templates')
    .select(`room_id, day_of_week, time_slots, rooms ( name, branches ( name ) )`)
    .limit(10)

  results.templates_sample = tplErr ? { error: tplErr.message } : tplData

  // ─── STEP 4: Count slots per status ───────────────────────
  const { data: countData, error: countErr } = await supabase
    .from('slots')
    .select('status')
    .gte('start_at', new Date().toISOString())
    .lte('start_at', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString())

  if (!countErr && countData) {
    const counts: Record<string, number> = {}
    countData.forEach((s: any) => { counts[s.status] = (counts[s.status] || 0) + 1 })
    results.slot_counts_next_14_days = counts
  }

  return NextResponse.json(results, { status: 200 })
}
