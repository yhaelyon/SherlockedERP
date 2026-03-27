import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getAdminClient()
    const { error } = await supabase.from('attendance_logs').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { clock_in, clock_out, note } = await req.json()
    const supabase = getAdminClient()

    const cIn = new Date(clock_in)
    const cOut = new Date(clock_out)
    const total_minutes = Math.floor((cOut.getTime() - cIn.getTime()) / 60000)

    const { error } = await supabase
      .from('attendance_logs')
      .update({
        clock_in: cIn.toISOString(),
        clock_out: cOut.toISOString(),
        total_minutes,
        note,
      })
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true, total_minutes })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
