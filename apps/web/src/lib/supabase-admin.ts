import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Admin Client
 * This client uses the SERVICE_ROLE_KEY to bypass Row Level Security (RLS).
 * MUST ONLY BE USED ON THE SERVER SIDE.
 */
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('[Supabase Admin] Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
