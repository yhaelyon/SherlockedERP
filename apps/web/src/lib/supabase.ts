import { createBrowserClient } from '@supabase/ssr'

let client: any = null

export function createClient() {
  if (typeof window === 'undefined') {
    // In SSR, always create a new one or handle as needed
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    return createBrowserClient(url, key)
  }

  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error(
      '[Supabase] Missing environment variables. ' +
      'Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  client = createBrowserClient(url || '', key || '')
  return client
}
