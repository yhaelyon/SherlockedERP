import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error(
      '[Supabase] Missing environment variables. ' +
      'Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
    // Return a dummy client or handle as needed - better to return null and let callers handle it
    // But since the project expects a client, we'll return a proxy or just let it fail silently later
  }

  return createBrowserClient(url || '', key || '')
}
