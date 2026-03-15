/**
 * Sherlocked WhatsApp Service
 *
 * Thin proxy service for Evolution API.
 * The main API handles queueing via BullMQ.
 * This service handles:
 *   - Evolution API lifecycle (instance management)
 *   - Webhook relay from Evolution → main API
 *   - Health/status checks
 */

import 'dotenv/config'
import express from 'express'
import axios from 'axios'

const app = express()
app.use(express.json())

const PORT = parseInt(process.env.PORT ?? '3003')
const EVOLUTION_URL = process.env.EVOLUTION_API_URL
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? 'sherlocked-main'
const MAIN_API_URL = process.env.API_BASE_URL ?? 'http://localhost:3001'

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

// GET /status — Evolution API instance status
app.get('/status', async (req, res) => {
  if (!EVOLUTION_URL || !EVOLUTION_KEY) {
    return res.status(503).json({ error: 'Evolution API not configured' })
  }

  try {
    const { data } = await axios.get(
      `${EVOLUTION_URL}/instance/connectionState/${INSTANCE}`,
      { headers: { apikey: EVOLUTION_KEY } }
    )
    return res.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(502).json({ error: msg })
  }
})

// GET /qr — get QR code for reconnection
app.get('/qr', async (req, res) => {
  if (!EVOLUTION_URL || !EVOLUTION_KEY) {
    return res.status(503).json({ error: 'Evolution API not configured' })
  }

  try {
    const { data } = await axios.get(
      `${EVOLUTION_URL}/instance/connect/${INSTANCE}`,
      { headers: { apikey: EVOLUTION_KEY } }
    )
    return res.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(502).json({ error: msg })
  }
})

// POST /webhook — receive Evolution API webhooks and relay to main API
app.post('/webhook', async (req, res) => {
  const payload = req.body

  try {
    await axios.post(`${MAIN_API_URL}/api/v1/whatsapp/webhook`, payload, {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[WhatsApp Webhook] Failed to relay to main API:', msg)
  }

  return res.json({ ok: true })
})

// Initialize Evolution API instance (call on startup)
async function ensureInstance() {
  if (!EVOLUTION_URL || !EVOLUTION_KEY) {
    console.warn('[WhatsApp] Evolution API not configured — skipping instance check')
    return
  }

  try {
    // Check if instance exists
    const { data: instances } = await axios.get(`${EVOLUTION_URL}/instance/fetchInstances`, {
      headers: { apikey: EVOLUTION_KEY },
    })

    const exists = Array.isArray(instances) && instances.some(
      (i: { instance?: { instanceName?: string } }) => i?.instance?.instanceName === INSTANCE
    )

    if (!exists) {
      console.log(`[WhatsApp] Creating instance "${INSTANCE}"...`)
      await axios.post(
        `${EVOLUTION_URL}/instance/create`,
        {
          instanceName: INSTANCE,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
          webhook: {
            url: `${process.env.WHATSAPP_SERVICE_URL ?? 'http://localhost:3003'}/webhook`,
            events: ['connection.update', 'messages.upsert'],
          },
        },
        { headers: { apikey: EVOLUTION_KEY } }
      )
      console.log(`[WhatsApp] Instance "${INSTANCE}" created`)
    } else {
      console.log(`[WhatsApp] Instance "${INSTANCE}" already exists`)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[WhatsApp] Failed to initialize instance:', msg)
  }
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[WhatsApp Service] Listening on port ${PORT}`)
  await ensureInstance()
})
