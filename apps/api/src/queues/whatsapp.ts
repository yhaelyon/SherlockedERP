import { Queue, Worker } from 'bullmq'
import { redis } from '../lib/redis'
import { supabase } from '../lib/supabase'
import axios from 'axios'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? 'sherlocked-main'

export const waQueue = new Queue('whatsapp', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
})

// Rate limit: max 20 messages/min, random delay 2-8s
const worker = new Worker(
  'whatsapp',
  async (job) => {
    const { to_phone, template_name, body, booking_id } = job.data

    if (!EVOLUTION_URL || !EVOLUTION_KEY) {
      throw new Error('Evolution API not configured')
    }

    // Random delay 2-8 seconds between messages
    const delay = 2000 + Math.random() * 6000
    await new Promise((r) => setTimeout(r, delay))

    // Format phone: strip +, ensure 972 prefix
    const formatted = to_phone.startsWith('0')
      ? '972' + to_phone.slice(1)
      : to_phone.replace(/^\+/, '')

    let msgId: string | null = null

    try {
      const { data } = await axios.post(
        `${EVOLUTION_URL}/message/sendText/${INSTANCE}`,
        { number: formatted, text: body },
        { headers: { apikey: EVOLUTION_KEY } }
      )
      msgId = data?.key?.id ?? null
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      await supabase.from('whatsapp_messages').insert({
        to_phone,
        instance_id: INSTANCE,
        template_name,
        body,
        status: 'failed',
        booking_id,
        error_msg: errMsg,
      })
      throw err
    }

    await supabase.from('whatsapp_messages').insert({
      to_phone,
      instance_id: INSTANCE,
      template_name,
      body,
      status: 'sent',
      booking_id,
      sent_at: new Date().toISOString(),
    })
  },
  {
    connection: redis,
    limiter: { max: 20, duration: 60000 }, // 20 per minute
    concurrency: 1,
  }
)

worker.on('failed', (job, err) => {
  console.error(`[WhatsApp Queue] Job ${job?.id} failed:`, err.message)
})

worker.on('completed', (job) => {
  console.log(`[WhatsApp Queue] Job ${job.id} sent to ${job.data.to_phone}`)
})

export function buildConfirmationMessage(params: {
  firstName: string
  roomName: string
  date: string
  time: string
  participants: number
  amount: number
  clubDiscount?: number
}): string {
  const { firstName, roomName, date, time, participants, amount, clubDiscount } = params
  const clubLine = clubDiscount ? `\nהנחת מועדון: ₪${clubDiscount}` : ''

  return `שלום ${firstName}! ✅
ההזמנה שלך לחדר ${roomName} ב-${date} בשעה ${time}
עבור ${participants} משתתפים אושרה!
סכום ששולם: ₪${amount}${clubLine}

מדיניות ביטולים:
• ביטול עד 24 שעות לפני — ללא חיוב
• ביטול בין 24 שעות ל-2 שעות — חיוב 50%
• ביטול פחות מ-2 שעות / אי הגעה — חיוב מלא

לביטול: 072-3970707`
}

export function buildReminderMessage(params: {
  time: string
  roomName: string
}): string {
  const { time, roomName } = params
  return `תזכורת: מחר ב-${time} מחכה לך חדר הבריחה ${roomName}!
⚠️ ביטול עכשיו ועד 2 שעות לפני — חיוב 50%
בהצלחה! 🔐`
}

export function buildBirthdayMessage(params: {
  firstName: string
  link: string
}): string {
  const { firstName, link } = params
  return `יום הולדת שמח ${firstName}! 🎂
מתנה: ₪50 הנחה על המשחק הקרוב שלך (תוקף: 30 יום)
להזמנה: ${link}`
}

export function buildDebtMessage(params: {
  firstName: string
  balance: number
  bookingId: string
  paymentLink: string
}): string {
  const { firstName, balance, bookingId, paymentLink } = params
  return `שלום ${firstName}, יתרת תשלום של ₪${balance} להזמנה #${bookingId}.
לסגירת יתרה: ${paymentLink}`
}
