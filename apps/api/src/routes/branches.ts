import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'

export async function branchesRoutes(app: FastifyInstance) {
  // GET /branches — list all branches (for frontend selectors)
  app.get('/branches', async (_req, reply) => {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, venue_lat, venue_lng, venue_radius_meters')
      .order('name')

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // PATCH /branches/:id/venue — update venue GPS coords (admin only)
  app.patch('/branches/:id/venue', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { venue_lat, venue_lng, venue_radius_meters, venue_static_ip } = req.body as {
      venue_lat?: number
      venue_lng?: number
      venue_radius_meters?: number
      venue_static_ip?: string
    }

    const { data, error } = await supabase
      .from('branches')
      .update({ venue_lat, venue_lng, venue_radius_meters, venue_static_ip })
      .eq('id', id)
      .select('id, name, venue_lat, venue_lng, venue_radius_meters')
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })
}
