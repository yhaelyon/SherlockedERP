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

    // Feed the user's JWT into the Realtime websocket so RLS policies
    // (which gate postgres_changes delivery) see auth.uid() and not anon.
    // Without this, RLS-protected tables silently drop every realtime event.
    const c = client
    c.auth.getSession().then(({ data }) => {
      c.realtime.setAuth(data.session?.access_token ?? key)
    })
    c.auth.onAuthStateChange((_event, session) => {
      c.realtime.setAuth(session?.access_token ?? key)
    })
  }

  return client
}
