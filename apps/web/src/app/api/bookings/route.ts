import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendText } from '@/lib/whatsapp-client'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bookings
 * 1. Creates/Updates Customer record
 * 2. Creates Booking record
 * 3. Sends WhatsApp Confirmation (if enabled)
 */
export async function POST(req: NextRequest) {
  const supabase = getAdminClient()
  const body = await req.json()

  const {
    branch_id,
    room_id,
    slot_id,
    customer, // { first_name, last_name, phone, email }
    participants_count,
    is_club_member,
    price_total,
    voucher_code,
    voucher_amount,
    terms_accepted,
  } = body

  if (!branch_id || !room_id || !slot_id || !customer?.phone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    // 1. Upsert Customer
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .upsert({
        phone: customer.phone,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'phone' })
      .select()
      .single()

    if (customerError) throw customerError

    // 2. Create Booking
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        branch_id,
        room_id,
        slot_id,
        customer_id: customerData.id,
        participants_count,
        is_club_member,
        price_total,
        voucher_code,
        voucher_amount,
        terms_accepted,
        terms_accepted_at: new Date().toISOString(),
        status: 'pending', // Waiting for payment or manual confirmation
      })
      .select()
      .single()

    if (bookingError) throw bookingError

    // 3. Mark Slot as Pending (optional, for locking)
    await supabase.from('slots').update({ status: 'pending' }).eq('id', slot_id)

    // 4. Send WhatsApp Confirmation
    try {
      const msg = `🎉 *שלום ${customer.first_name}!* \n\nתודה שהזמנת משחק ב-Sherlocked. \nההזמנה שלך התקבלה בהצלחה! \n\n*פרטים:* \n📅 תאריך: ${body.date_str || ''} \n🕗 שעה: ${body.time_str || ''} \n\nנשמח לראותכם! 🕵️‍♂️`
      await sendText(customer.phone, msg)
    } catch (waError) {
      console.error('[WhatsAppConfirmation] Failed:', waError)
      // Don't fail the whole booking if WhatsApp sends fails
    }

    return NextResponse.json({ success: true, booking: bookingData })
  } catch (err: any) {
    console.error('[BookingAPI] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
