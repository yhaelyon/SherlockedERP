export function normalizePhone(input: string): string {
  const raw = String(input ?? '').trim()
  const withoutJid = raw.split('@')[0]?.split(':')[0] ?? raw
  let digits = withoutJid.replace(/\D/g, '')

  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('9720')) digits = `972${digits.slice(4)}`
  if (digits.startsWith('0')) digits = `972${digits.slice(1)}`

  return digits
}

export function jidToPhone(remoteJid: string): string {
  return normalizePhone(remoteJid)
}

export function phoneToRemoteJid(phone: string): string {
  return `${normalizePhone(phone)}@s.whatsapp.net`
}

export function toIsraeliLocalPhone(phone: string): string | null {
  const normalized = normalizePhone(phone)
  if (!normalized.startsWith('972') || normalized.length < 11) return null
  return `0${normalized.slice(3)}`
}

export function isIgnoredRemoteJid(remoteJid: string): boolean {
  return (
    !remoteJid ||
    remoteJid.endsWith('@g.us') ||
    remoteJid === 'status@broadcast' ||
    remoteJid.includes('@broadcast')
  )
}
