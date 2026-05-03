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

  // Only run the "mark read" side-effects when there is actually something to update.
  // Otherwise every page load fires N realtime UPDATE events that ricochet back into
  // the browser's postgres_changes handler.
  const hasUnreadInbound = (data ?? []).some(
    (m) => m.direction === 'inbound' && m.status === 'received',
  )

  if (hasUnreadInbound) {
    await supabase
      .from('whatsapp_inbox_messages')
      .update({ status: 'read' })
      .eq('conversation_id', params.id)
      .eq('direction', 'inbound')
      .eq('status', 'received')
  }

  const { data: convRow } = await supabase
    .from('whatsapp_inbox_conversations')
    .select('unread_count')
    .eq('id', params.id)
    .maybeSingle()

  if ((convRow?.unread_count ?? 0) > 0) {
    await supabase
      .from('whatsapp_inbox_conversations')
      .update({ unread_count: 0 })
      .eq('id', params.id)
  }

  const sorted = [...(data ?? [])].sort((a, b) => {
    const aTime = new Date(a.received_at ?? a.sent_at ?? a.created_at).getTime()
    const bTime = new Date(b.received_at ?? b.sent_at ?? b.created_at).getTime()
    return aTime - bTime
  })

  return NextResponse.json(sorted)
}
