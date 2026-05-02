import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { requireInboxUser } from '../../../_lib'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = await requireInboxUser(req)
  if (response) return response

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('whatsapp_inbox_messages')
    .select('*')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from('whatsapp_inbox_conversations')
    .update({ unread_count: 0 })
    .eq('id', params.id)

  await supabase
    .from('whatsapp_inbox_messages')
    .update({ status: 'read' })
    .eq('conversation_id', params.id)
    .eq('direction', 'inbound')
    .eq('status', 'received')

  const sorted = [...(data ?? [])].sort((a, b) => {
    const aTime = new Date(a.received_at ?? a.sent_at ?? a.created_at).getTime()
    const bTime = new Date(b.received_at ?? b.sent_at ?? b.created_at).getTime()
    return aTime - bTime
  })

  return NextResponse.json(sorted)
}
