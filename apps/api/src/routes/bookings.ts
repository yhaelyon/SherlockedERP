import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'

export async function bookingsRoutes(app: FastifyInstance) {
  // GET /bookings?branch_id=&date=YYYY-MM-DD
  app.get('/bookings', async (req, reply) => {
    const { branch_id, date, room_id } = req.query as {
      branch_id?: string
      date?: string
      room_id?: string
    }

    let query = supabase
      .from('bookings')
      .select(`
        id, status, participants_count, price_total, amount_paid,
        is_club_member, notes, created_at,
        customers(id, first_name, last_name, phone),
        rooms(id, name, color_hex),
        slots(id, start_at, end_at)
      `)
      .order('created_at', { ascending: false })

    if (branch_id) query = query.eq('branch_id', branch_id)
    if (room_id) query = query.eq('room_id', room_id)
    if (date) {
      query = query
        .gte('slots.start_at', `${date}T00:00:00+02:00`)
        .lte('slots.start_at', `${date}T23:59:59+02:00`)
    }

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // GET /bookings/:id
  app.get('/bookings/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *, customers(*), rooms(*), slots(*), payments(*)
      `)
      .eq('id', id)
      .single()

    if (error) return reply.status(404).send({ error: 'Booking not found' })
    return reply.send(data)
  })

  // POST /bookings — create booking + lock slot
  app.post('/bookings', async (req, reply) => {
    const body = req.body as {
      slot_id: string
      room_id: string
      branch_id: string
      session_id: string
      customer: {
        phone: string
        first_name: string
        last_name: string
        email?: string
        referral_source?: string
        escape_experience?: string
      }
      participants_count: number
      is_club_member: boolean
      price_total: number
      amount_paid: number
      discount_breakdown_json?: object
      voucher_code?: string
      notes?: string
      terms_accepted: boolean
    }

    // 1. Upsert customer
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .upsert(
        {
          phone: body.customer.phone,
          first_name: body.customer.first_name,
          last_name: body.customer.last_name,
          email: body.customer.email,
          referral_source: body.customer.referral_source,
          escape_experience: body.customer.escape_experience,
        },
        { onConflict: 'phone' }
      )
      .select()
      .single()

    if (custErr) return reply.status(500).send({ error: custErr.message })

    // 2. Create booking
    const { data: booking, error: bookErr } = await supabase
      .from('bookings')
      .insert({
        branch_id: body.branch_id,
        room_id: body.room_id,
        slot_id: body.slot_id,
        customer_id: customer.id,
        participants_count: body.participants_count,
        is_club_member: body.is_club_member,
        price_total: body.price_total,
        amount_paid: body.amount_paid,
        discount_breakdown_json: body.discount_breakdown_json ?? {},
        voucher_code: body.voucher_code,
        notes: body.notes,
        terms_accepted: body.terms_accepted,
        status: 'pending',
      })
      .select()
      .single()

    if (bookErr) return reply.status(500).send({ error: bookErr.message })

    // 3. Mark slot as booked
    await supabase
      .from('slots')
      .update({ status: 'booked', block_expires_at: null, blocked_by_session: null })
      .eq('id', body.slot_id)
      .eq('blocked_by_session', body.session_id)

    return reply.status(201).send(booking)
  })

  // PATCH /bookings/:id — update booking (admin)
  app.patch('/bookings/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const updates = req.body as Record<string, unknown>

    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // POST /bookings/:id/cancel
  app.post('/bookings/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { reason } = req.body as { reason?: string }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', notes: reason })
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })

    // Release slot
    if (data.slot_id) {
      await supabase
        .from('slots')
        .update({ status: 'available', block_expires_at: null })
        .eq('id', data.slot_id)
    }

    return reply.send(data)
  })
}
