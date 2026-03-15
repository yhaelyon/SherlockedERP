import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'

export async function slotsRoutes(app: FastifyInstance) {
  // GET /slots?room_id=&date=YYYY-MM-DD
  app.get('/slots', async (req, reply) => {
    const { room_id, date } = req.query as { room_id?: string; date?: string }

    if (!room_id || !date) {
      return reply.status(400).send({ error: 'room_id and date required' })
    }

    const startOfDay = `${date}T00:00:00+02:00`
    const endOfDay = `${date}T23:59:59+02:00`

    const { data, error } = await supabase
      .from('slots')
      .select('id, start_at, end_at, status')
      .eq('room_id', room_id)
      .gte('start_at', startOfDay)
      .lte('start_at', endOfDay)
      .order('start_at')

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // POST /slots/hold — put slot in pending state for 5 minutes
  app.post('/slots/hold', async (req, reply) => {
    const { slot_id, session_id } = req.body as { slot_id: string; session_id: string }

    if (!slot_id || !session_id) {
      return reply.status(400).send({ error: 'slot_id and session_id required' })
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('slots')
      .update({
        status: 'pending',
        block_expires_at: expiresAt,
        blocked_by_session: session_id,
      })
      .eq('id', slot_id)
      .eq('status', 'available') // Only hold if currently available
      .select()
      .single()

    if (error || !data) {
      return reply.status(409).send({ error: 'Slot not available' })
    }

    return reply.send({ slot: data, expires_at: expiresAt })
  })

  // POST /slots/release
  app.post('/slots/release', async (req, reply) => {
    const { slot_id, session_id } = req.body as { slot_id: string; session_id: string }

    await supabase
      .from('slots')
      .update({ status: 'available', block_expires_at: null, blocked_by_session: null })
      .eq('id', slot_id)
      .eq('blocked_by_session', session_id)

    return reply.send({ ok: true })
  })
}
