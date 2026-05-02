import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireInboxUser } from '../_lib'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { response } = await requireInboxUser(req)
  if (response) return response

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('whatsapp_inbox_conversations')
    .select('*, customers(id, first_name, last_name, phone)')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
