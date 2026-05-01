import axios from 'axios'

const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? 'sherlocked-main'

export interface EvolutionSendResult {
  key?: {
    id?: string
    remoteJid?: string
    fromMe?: boolean
  }
  status?: string
  message?: unknown
}

function config() {
  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY

  if (!url || !key) {
    throw new Error('Evolution API not configured')
  }

  return { url, key, instance: process.env.EVOLUTION_INSTANCE_NAME ?? INSTANCE }
}

async function sendTextViaFallback(phone: string, text: string): Promise<EvolutionSendResult | null> {
  const fallbackUrl = process.env.WHATSAPP_SEND_FALLBACK_URL
  if (!fallbackUrl) return null

  const { data } = await axios.post(
    fallbackUrl,
    {
      to: phone,
      message: text,
      triggerType: 'manual',
    },
    { headers: { 'Content-Type': 'application/json' } },
  )

  return {
    status: 'sent',
    message: {
      fallback: true,
      response: data,
    },
  }
}

export async function sendEvolutionText(phone: string, text: string): Promise<EvolutionSendResult> {
  try {
    const { url, key, instance } = config()
    const { data } = await axios.post(
      `${url}/message/sendText/${instance}`,
      { number: phone, text },
      { headers: { apikey: key } },
    )

    return data as EvolutionSendResult
  } catch (error) {
    // Local development may not have a local Evolution container running while the
    // deployed WhatsApp instance is connected. Keep the inbox send path aligned
    // with the admin settings test sender by using the configured fallback.
    const fallbackResult = await sendTextViaFallback(phone, text)
    if (fallbackResult) return fallbackResult
    throw error
  }
}

export async function sendEvolutionImage(params: {
  phone: string
  mediaUrl: string
  caption?: string
  mimeType?: string
  fileName?: string
}): Promise<EvolutionSendResult> {
  const { url, key, instance } = config()
  const isDataUrl = params.mediaUrl.startsWith('data:')
  const media = isDataUrl ? params.mediaUrl.split(',')[1] : params.mediaUrl

  const { data } = await axios.post(
    `${url}/message/sendMedia/${instance}`,
    {
      number: params.phone,
      mediatype: 'image',
      mimetype: params.mimeType ?? 'image/jpeg',
      caption: params.caption ?? '',
      media,
      fileName: params.fileName ?? 'image',
    },
    { headers: { apikey: key } },
  )

  return data as EvolutionSendResult
}
