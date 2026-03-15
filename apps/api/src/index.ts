import './env' // must be first — loads root .env before any other module
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'

import { slotsRoutes } from './routes/slots'
import { bookingsRoutes } from './routes/bookings'
import { customersRoutes } from './routes/customers'
import { paymentsRoutes } from './routes/payments'
import { attendanceRoutes } from './routes/attendance'
import { shiftsRoutes } from './routes/shifts'
import { vouchersRoutes } from './routes/vouchers'
import { tasksRoutes } from './routes/tasks'
import { whatsappRoutes } from './routes/whatsapp'
import { branchesRoutes } from './routes/branches'

const app = Fastify({ logger: true })

async function main() {
  // Security & CORS
  await app.register(helmet)
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  })
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  })

  // Health check
  app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }))

  // Routes (versioned under /api/v1)
  await app.register(
    async (api) => {
      await api.register(slotsRoutes)
      await api.register(bookingsRoutes)
      await api.register(customersRoutes)
      await api.register(paymentsRoutes)
      await api.register(attendanceRoutes)
      await api.register(shiftsRoutes)
      await api.register(vouchersRoutes)
      await api.register(tasksRoutes)
      await api.register(whatsappRoutes)
      await api.register(branchesRoutes)
    },
    { prefix: '/api/v1' }
  )

  const port = parseInt(process.env.PORT ?? '3001')
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`[API] Listening on port ${port}`)
}

main().catch((err) => {
  console.error('[API] Fatal:', err)
  process.exit(1)
})
