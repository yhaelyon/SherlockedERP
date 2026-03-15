import Redis from 'ioredis'

if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required')

export const redis = new Redis(process.env.REDIS_URL)

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message)
})

redis.on('connect', () => {
  console.log('[Redis] Connected')
})
