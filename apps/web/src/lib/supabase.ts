import { createBrowserClient } from '@supabase/ssr'

let client: any = null

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (typeof window !== 'undefined') {
    if (client) return client

    // Client-side initialization debug
    if (!url || !key || url === 'undefined' || key === 'undefined') {
      console.error(
        '[Supabase] MISSING OR INVALID ENVIRONMENT VARIABLES IN BUNDLE!',
        { url, key: key ? 'PRESENT (SHORTER VERSION: ' + key.substring(0, 10) + '...)' : 'MISSING' }
      )
    } else {
      console.log('[Supabase] Initializing with URL:', url)
    }

    client = createBrowserClient(url || '', key || '')
    return client
  }

  // SSR initialization
  return createBrowserClient(url || '', key || '')
}

