import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/whatsapp/templates
export async function GET() {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// PATCH /api/whatsapp/templates — update a template
export async function PATCH(req: NextRequest) {
  const { id, body, enabled } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = getAdminClient()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body    !== undefined) updates.body    = body
  if (enabled !== undefined) updates.enabled = enabled

  const { error } = await supabase.from('whatsapp_templates').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
