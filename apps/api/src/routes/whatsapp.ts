import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'
import { waQueue } from '../queues/whatsapp'

export async function whatsappRoutes(app: FastifyInstance) {
  // POST /whatsapp/send — queue a WhatsApp message
  app.post('/whatsapp/send', async (req, reply) => {
    const { to_phone, template_name, body, booking_id } = req.body as {
      to_phone: string
      template_name: string
      body: string
      booking_id?: string
    }

    await waQueue.add('send-message', {
      to_phone,
      template_name,
      body,
      booking_id,
    })

    return reply.send({ queued: true })
  })

  // GET /whatsapp/status — connection status
  app.get('/whatsapp/status', async (req, reply) => {
    const { data } = await supabase
      .from('whatsapp_connection')
      .select('*')
      .order('last_connected_at', { ascending: false })
      .limit(1)
      .single()

    return reply.send(data ?? { status: 'unknown' })
  })

  // POST /whatsapp/webhook — Evolution API webhook
  app.post('/whatsapp/webhook', async (req, reply) => {
    const payload = req.body as Record<string, unknown>
    const event = payload.event as string

    if (event === 'connection.update') {
      const state = (payload.data as Record<string, unknown>)?.state as string
      await supabase
        .from('whatsapp_connection')
        .upsert(
          {
            instance_id: process.env.EVOLUTION_INSTANCE_NAME ?? 'sherlocked-main',
            status: state === 'open' ? 'connected' : 'disconnected',
            last_connected_at: new Date().toISOString(),
          },
          { onConflict: 'instance_id' }
        )

      // Alert admin if disconnected
      if (state !== 'open') {
        console.warn('[WhatsApp] Disconnected — admin should rescan QR')
        // TODO: send alert email/push to admin
      }
    }

    return reply.send({ ok: true })
  })

  // GET /whatsapp/qr — get QR code for reconnection
  app.get('/whatsapp/qr', async (req, reply) => {
    const evolutionUrl = process.env.EVOLUTION_API_URL
    const evolutionKey = process.env.EVOLUTION_API_KEY
    const instance = process.env.EVOLUTION_INSTANCE_NAME ?? 'sherlocked-main'

    if (!evolutionUrl || !evolutionKey) {
      return reply.status(503).send({ error: 'Evolution API not configured' })
    }

    const axios = (await import('axios')).default
    const { data } = await axios.get(
      `${evolutionUrl}/instance/connect/${instance}`,
      { headers: { apikey: evolutionKey } }
    )

    return reply.send(data)
  })
}
