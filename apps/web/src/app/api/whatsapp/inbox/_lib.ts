import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { sendText } from '@/lib/whatsapp-client'

type Role = 'admin' | 'manager' | 'shift_lead' | 'staff'
type Permission = 'whatsapp_inbox'

const PERMISSIONS: Record<Role, Permission[]> = {
  admin: ['whatsapp_inbox'],
  manager: ['whatsapp_inbox'],
  shift_lead: ['whatsapp_inbox'],
  staff: ['whatsapp_inbox'],
}

export interface InboxUser {
  id: string
  email: string
  role: Role
}

export interface ConversationRow {
  id: string
  instance_id: string
  remote_jid: string
  phone: string
  customer_id: string | null
  display_name: string | null
  unread_count: number
}

function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false
}

function readBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

export async function requireInboxUser(req: NextRequest): Promise<{ user: InboxUser | null; response: NextResponse | null }> {
  const token = readBearerToken(req)
  if (!token) {
    return { user: null, response: NextResponse.json({ error: 'Missing bearer token' }, { status: 401 }) }
  }

  const supabase = getAdminClient()
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  const authUser = authData.user

  if (authError || !authUser) {
    return { user: null, response: NextResponse.json({ error: 'Invalid session' }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, role, active')
    .eq('id', authUser.id)
    .single()

  if (profileError || !profile || profile.active === false) {
    return { user: null, response: NextResponse.json({ error: 'Inactive or missing user profile' }, { status: 403 }) }
  }

  const role = profile.role as Role
  if (!can(role, 'whatsapp_inbox')) {
    return { user: null, response: NextResponse.json({ error: 'Missing permission' }, { status: 403 }) }
  }

  return {
    user: {
      id: authUser.id,
      email: authUser.email ?? '',
      role,
    },
    response: null,
  }
}

export function normalizePhone(input: string): string {
  const raw = String(input ?? '').trim()
  const withoutJid = raw.split('@')[0]?.split(':')[0] ?? raw
  let digits = withoutJid.replace(/\D/g, '')

  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('9720')) digits = `972${digits.slice(4)}`
  if (digits.startsWith('0')) digits = `972${digits.slice(1)}`

  return digits
}

export function previewForMessage(messageType: string, body: string | null): string {
  if (body?.trim()) return body.trim().slice(0, 180)
  if (messageType === 'image') return 'תמונה'
  return 'הודעה'
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }
  return null
}

export function extractExternalMessageId(result: unknown): string | null {
  const record = asRecord(result)
  const key = asRecord(record.key)
  const message = asRecord(record.message)
  const messageKey = asRecord(message.key)
  return pickString(key.id, messageKey.id, record.id, record.messageId)
}

async function sendTextViaFallback(phone: string, text: string) {
  const fallbackUrl = process.env.WHATSAPP_SEND_FALLBACK_URL
  if (!fallbackUrl) return null

  const res = await fetch(fallbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: phone, message: text, triggerType: 'manual' }),
    cache: 'no-store',
  })

  const payload = await res.json().catch(() => null)
  if (!res.ok) throw new Error(payload?.error ?? `Fallback send failed (${res.status})`)
  return { status: 'sent', message: { fallback: true, response: payload } }
}

export async function sendInboxText(phone: string, text: string) {
  try {
    return await sendText(phone, text)
  } catch (error) {
    const fallback = await sendTextViaFallback(phone, text)
    if (fallback) return fallback
    throw error
  }
}

export async function sendInboxImage(params: {
  phone: string
  mediaUrl: string
  caption?: string
  mimeType?: string
  fileName?: string
}) {
  const baseUrl = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE_NAME ?? 'sherlocked-main'

  if (!baseUrl || !apiKey) throw new Error('Evolution API not configured')

  const isDataUrl = params.mediaUrl.startsWith('data:')
  const media = isDataUrl ? params.mediaUrl.split(',')[1] : params.mediaUrl
  const res = await fetch(`${baseUrl}/message/sendMedia/${instance}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify({
      number: params.phone,
      mediatype: 'image',
      mimetype: params.mimeType ?? 'image/jpeg',
      caption: params.caption ?? '',
      media,
      fileName: params.fileName ?? 'image',
    }),
    cache: 'no-store',
  })

  const payload = await res.json().catch(() => null)
  if (!res.ok) throw new Error(payload?.error ?? `Image send failed (${res.status})`)
  return payload
}
