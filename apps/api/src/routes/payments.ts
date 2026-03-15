import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'
import axios from 'axios'
import crypto from 'crypto'

const PAYPLUS_BASE = 'https://restapi.payplus.co.il/api/v1.0'

function verifyPayPlusHmac(payload: Record<string, unknown>, secret: string): boolean {
  // PayPlus HMAC verification — to be implemented with actual PayPlus docs
  return true
}

export async function paymentsRoutes(app: FastifyInstance) {
  // POST /payments/create-link — generate PayPlus payment link
  app.post('/payments/create-link', async (req, reply) => {
    const { booking_id, amount, customer_name, customer_phone, customer_email, room_name } =
      req.body as {
        booking_id: string
        amount: number
        customer_name: string
        customer_phone: string
        customer_email?: string
        room_name: string
      }

    if (!process.env.PAYPLUS_API_KEY || !process.env.PAYPLUS_SECRET_KEY) {
      return reply.status(503).send({ error: 'PayPlus not configured' })
    }

    const baseUrl = process.env.APP_BASE_URL ?? 'https://app.sherlocked.co.il'

    const { data } = await axios.post(
      `${PAYPLUS_BASE}/PaymentPages/generateLink`,
      {
        payment_page_uid: process.env.PAYPLUS_TERMINAL_NUMBER,
        amount,
        currency_code: 'ILS',
        charge_method: 1,
        customer: {
          customer_name,
          phone: customer_phone,
          email: customer_email,
        },
        items: [{ name: room_name, quantity: 1, price: amount, vat_type: 1 }],
        success_url: `${baseUrl}/booking/success?booking_id=${booking_id}`,
        failure_url: `${baseUrl}/booking/${booking_id}?error=payment_failed`,
        webhook_url: `${process.env.API_BASE_URL}/payments/webhook`,
        more_info_1: booking_id,
      },
      {
        headers: {
          Authorization: JSON.stringify({
            api_key: process.env.PAYPLUS_API_KEY,
            secret_key: process.env.PAYPLUS_SECRET_KEY,
          }),
          'Content-Type': 'application/json',
        },
      }
    )

    // Record pending payment
    await supabase.from('payments').insert({
      booking_id,
      amount,
      method: 'card',
      status: 'pending',
    })

    return reply.send({ payment_url: data.data?.payment_page_link })
  })

  // POST /payments/webhook — PayPlus webhook handler
  app.post('/payments/webhook', async (req, reply) => {
    const body = req.body as Record<string, unknown>

    // TODO: Verify HMAC signature
    // const hmacValid = verifyPayPlusHmac(body, process.env.PAYPLUS_WEBHOOK_SECRET!)
    // if (!hmacValid) return reply.status(401).send({ error: 'Invalid signature' })

    const bookingId = body.more_info_1 as string
    const status = body.status as string // e.g. 'COMPLETED', 'FAILED'
    const transactionId = body.transaction_uid as string
    const amount = body.amount as number

    if (status === 'COMPLETED') {
      await supabase
        .from('payments')
        .update({
          payplus_transaction_id: transactionId,
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('booking_id', bookingId)

      await supabase
        .from('bookings')
        .update({ status: 'confirmed', amount_paid: amount })
        .eq('id', bookingId)

      // TODO: Send WhatsApp confirmation
    } else if (status === 'FAILED') {
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('booking_id', bookingId)
    }

    return reply.send({ ok: true })
  })

  // GET /payments?booking_id=
  app.get('/payments', async (req, reply) => {
    const { booking_id } = req.query as { booking_id?: string }

    let query = supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })

    if (booking_id) query = query.eq('booking_id', booking_id)

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })
}
