import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'

export async function vouchersRoutes(app: FastifyInstance) {
  // GET /vouchers?code=&status=
  app.get('/vouchers', async (req, reply) => {
    const { code, status } = req.query as { code?: string; status?: string }

    let query = supabase
      .from('gift_vouchers')
      .select('*, gift_voucher_types(*)')
      .order('created_at', { ascending: false })

    if (code) query = query.ilike('code', `%${code}%`)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // GET /vouchers/validate/:code
  app.get('/vouchers/validate/:code', async (req, reply) => {
    const { code } = req.params as { code: string }

    const { data, error } = await supabase
      .from('gift_vouchers')
      .select('*, gift_voucher_types(*)')
      .eq('code', code.toUpperCase())
      .single()

    if (error || !data) return reply.status(404).send({ valid: false, error: 'קוד לא נמצא' })
    if (data.status === 'used') return reply.send({ valid: false, error: 'שובר כבר נוצל' })
    if (data.status === 'expired') return reply.send({ valid: false, error: 'שובר פג תוקף' })
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return reply.send({ valid: false, error: 'שובר פג תוקף' })
    }

    return reply.send({ valid: true, voucher: data })
  })

  // POST /vouchers — create new voucher (admin)
  app.post('/vouchers', async (req, reply) => {
    const { type_id, purchaser_name, recipient_name, expires_at } = req.body as {
      type_id: string
      purchaser_name: string
      recipient_name: string
      expires_at?: string
    }

    // Get voucher type for price
    const { data: voucherType } = await supabase
      .from('gift_voucher_types')
      .select('*')
      .eq('id', type_id)
      .single()

    if (!voucherType) return reply.status(404).send({ error: 'Voucher type not found' })

    // Generate unique code
    const code = Math.random().toString(36).toUpperCase().slice(2, 10)

    const { data, error } = await supabase
      .from('gift_vouchers')
      .insert({
        code,
        type_id,
        price: voucherType.price,
        purchaser_name,
        recipient_name,
        status: 'active',
        expires_at,
      })
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  // POST /vouchers/:id/use — mark voucher as used on booking
  app.post('/vouchers/:id/use', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { booking_id } = req.body as { booking_id: string }

    const { data, error } = await supabase
      .from('gift_vouchers')
      .update({ status: 'used', used_in_booking_id: booking_id })
      .eq('id', id)
      .eq('status', 'active')
      .select()
      .single()

    if (error || !data) return reply.status(409).send({ error: 'Cannot mark voucher as used' })
    return reply.send(data)
  })

  // GET /vouchers/types
  app.get('/vouchers/types', async (req, reply) => {
    const { data, error } = await supabase
      .from('gift_voucher_types')
      .select('*')
      .order('price')

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })
}
