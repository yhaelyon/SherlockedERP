/**
 * Evolution API Client
 * Wraps all communication with the Evolution API WhatsApp service.
 * Config is read from env vars: EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

function loadRootEnvForServerRoutes() {
  if (typeof window !== 'undefined') return

  const candidates = [
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
  ]

  for (const file of candidates) {
    if (!existsSync(file)) continue

    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue

      const index = trimmed.indexOf('=')
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '')
      if (key && process.env[key] === undefined) process.env[key] = value
    }

    return
  }
}

loadRootEnvForServerRoutes()

const BASE_URL = process.env.EVOLUTION_API_URL ?? ''
const API_KEY  = process.env.EVOLUTION_API_KEY ?? ''
export const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? 'sherlocked'

export class EvolutionAPIError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'EvolutionAPIError'
  }
}

async function request<T = unknown>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  if (!BASE_URL) throw new EvolutionAPIError(500, 'EVOLUTION_API_URL not configured')
  if (!API_KEY)  throw new EvolutionAPIError(500, 'EVOLUTION_API_KEY not configured')

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
    // Never cache — always get fresh state
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new EvolutionAPIError(res.status, text)
  }

  return res.json() as Promise<T>
}

// ─── Instance Management ─────────────────────────────────────────────────────

export interface InstanceState {
  instanceName: string
  state: 'open' | 'connecting' | 'close'
  profileName?: string
  profilePictureUrl?: string
  number?: string
}

export async function getInstanceStatus(): Promise<InstanceState | null> {
  try {
    const data = await request<any[]>('GET', `/instance/fetchInstances?instanceName=${INSTANCE}`)
    const instance = data?.[0]
    if (!instance) return null
    
    // Extract number from ownerJid (e.g. "972501234567@s.whatsapp.net" -> "972501234567")
    const num = instance.ownerJid?.split('@')[0] || instance.number

    return {
      instanceName: instance.name || INSTANCE,
      state: instance.connectionStatus as 'open' | 'connecting' | 'close',
      profileName: instance.profileName,
      profilePictureUrl: instance.profilePicUrl,
      number: num,
    }
  } catch (e) {
    if (e instanceof EvolutionAPIError && e.status === 404) return null
    throw e
  }
}

export async function createInstance(): Promise<{ base64?: string; code?: string }> {
  return request('POST', '/instance/create', {
    instanceName: INSTANCE,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
  })
}

export async function getQRCode(): Promise<{ base64?: string; code?: string }> {
  return request('GET', `/instance/connect/${INSTANCE}`)
}

export async function setWebhook(webhookUrl: string): Promise<unknown> {
  return request('POST', `/webhook/set/${INSTANCE}`, {
    enabled: true,
    url: webhookUrl,
    events: [
      'CONNECTION_UPDATE',
      'QRCODE_UPDATED',
      'MESSAGES_UPSERT',
      'MESSAGES_UPDATE',
      'SEND_MESSAGE',
    ],
    webhook_by_events: false,
    webhook_base64: false,
  })
}

export async function logoutInstance(): Promise<void> {
  await request('DELETE', `/instance/logout/${INSTANCE}`)
}

export async function deleteInstance(): Promise<void> {
  await request('DELETE', `/instance/delete/${INSTANCE}`)
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export interface SendTextResult {
  key: { id: string; remoteJid: string }
  status: string
}

/** phone: international format without +, e.g. "972501234567" */
export async function sendText(phone: string, text: string): Promise<SendTextResult> {
  // Evolution API expects full JID: <number>@s.whatsapp.net
  const number = phone.replace(/\D/g, '')
  return request('POST', `/message/sendText/${INSTANCE}`, {
    number,
    text,
  })
}

// ─── Template rendering ──────────────────────────────────────────────────────

export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  )
}
