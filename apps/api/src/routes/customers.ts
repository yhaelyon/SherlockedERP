import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'

export async function customersRoutes(app: FastifyInstance) {
  // GET /customers?phone=&search=&limit=
  app.get('/customers', async (req, reply) => {
    const { phone, search, limit = '50' } = req.query as {
      phone?: string
      search?: string
      limit?: string
    }

    let query = supabase
      .from('customers')
      .select('*, escape_club_members(*)')
      .limit(parseInt(limit))

    if (phone) query = query.eq('phone', phone)
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
      )
    }

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // GET /customers/:id
  app.get('/customers/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const { data, error } = await supabase
      .from('customers')
      .select('*, escape_club_members(*), bookings(*, rooms(*), slots(*))')
      .eq('id', id)
      .single()

    if (error) return reply.status(404).send({ error: 'Customer not found' })
    return reply.send(data)
  })

  // POST /customers/club/join — join Escape Club
  app.post('/customers/club/join', async (req, reply) => {
    const body = req.body as {
      customer_id: string
      id_number: string
      dob: string
      area?: string
    }

    const { data, error } = await supabase
      .from('escape_club_members')
      .insert({
        customer_id: body.customer_id,
        id_number: body.id_number,
        dob: body.dob,
        area: body.area,
        member_since: new Date().toISOString().split('T')[0],
        status: 'active',
      })
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  // POST /customers/club/validate — validate membership by phone or ID
  app.post('/customers/club/validate', async (req, reply) => {
    const { phone, id_number } = req.body as { phone?: string; id_number?: string }

    if (!phone && !id_number) {
      return reply.status(400).send({ error: 'phone or id_number required' })
    }

    let query = supabase
      .from('escape_club_members')
      .select('*, customers(*)')

    if (phone) {
      query = query.eq('customers.phone', phone)
    }
    if (id_number) {
      query = query.eq('id_number', id_number)
    }

    const { data, error } = await query.single()

    if (error || !data) return reply.status(404).send({ valid: false })
    if (data.status !== 'active') return reply.send({ valid: false, reason: 'inactive' })

    return reply.send({ valid: true, member: data })
  })
}
