import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'

export async function shiftsRoutes(app: FastifyInstance) {
  // GET /shifts?branch_id=&week_start=YYYY-MM-DD
  app.get('/shifts', async (req, reply) => {
    const { branch_id, week_start } = req.query as {
      branch_id?: string
      week_start?: string
    }

    if (!week_start) return reply.status(400).send({ error: 'week_start required' })

    // Get 7 days from week_start
    const start = new Date(week_start)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)

    let query = supabase
      .from('shift_assignments')
      .select('*, user_profiles(id, full_name, role)')
      .gte('date', start.toISOString().split('T')[0])
      .lt('date', end.toISOString().split('T')[0])
      .order('date')
      .order('shift_type')
      .order('order_number')

    if (branch_id) query = query.eq('branch_id', branch_id)

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // POST /shifts — assign shift
  app.post('/shifts', async (req, reply) => {
    const body = req.body as {
      user_id: string
      branch_id: string
      date: string
      shift_type: 'morning' | 'evening'
      order_number: number
      note?: string
    }

    const { data, error } = await supabase
      .from('shift_assignments')
      .insert(body)
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  // DELETE /shifts/:id
  app.delete('/shifts/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { error } = await supabase.from('shift_assignments').delete().eq('id', id)
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send({ ok: true })
  })

  // GET /shifts/constraints?user_id=&week_start=
  app.get('/shifts/constraints', async (req, reply) => {
    const { user_id, week_start } = req.query as { user_id: string; week_start: string }

    const { data, error } = await supabase
      .from('shift_constraints')
      .select('*')
      .eq('user_id', user_id)
      .eq('week_start', week_start)
      .single()

    if (error) return reply.status(404).send({ error: 'Not found' })
    return reply.send(data)
  })

  // POST /shifts/constraints — submit availability
  app.post('/shifts/constraints', async (req, reply) => {
    const { user_id, week_start, constraints_json } = req.body as {
      user_id: string
      week_start: string
      constraints_json: Record<string, unknown>
    }

    const { data, error } = await supabase
      .from('shift_constraints')
      .upsert({ user_id, week_start, constraints_json }, { onConflict: 'user_id,week_start' })
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })
}
