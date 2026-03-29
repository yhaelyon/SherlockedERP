import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/whatsapp/messages
 * Returns message log with optional filters.
 * Query params: limit, status, triggerType
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit       = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
  const status      = searchParams.get('status')
  const triggerType = searchParams.get('triggerType')

  const supabase = getAdminClient()
  let query = supabase
    .from('whatsapp_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status)      query = query.eq('status', status)
  if (triggerType) query = query.eq('trigger_type', triggerType)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
