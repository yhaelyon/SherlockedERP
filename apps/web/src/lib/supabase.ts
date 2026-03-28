import { createClient as _createClient } from '@supabase/supabase-js'

// Singleton for browser context
let client: ReturnType<typeof _createClient> | null = null

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // SSR: always create a fresh instance (no localStorage on server)
  if (typeof window === 'undefined') {
    return _createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }

  // Browser: singleton with localStorage persistence
  if (!client) {
    if (!url || !key) {
      console.error('[Supabase] MISSING environment variables – check NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
    } else {
      console.log('[Supabase] Initializing client with URL:', url)
    }

    client = _createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        // Explicitly store in localStorage, NOT cookies
        storage: window.localStorage,
        storageKey: 'sherlocked-auth-v2',
      },
    })
  }

  return client
}
