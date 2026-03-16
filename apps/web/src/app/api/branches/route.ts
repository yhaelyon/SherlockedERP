import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = 'https://rqjxemirswoxxsmjvfrc.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxanhlbWlyc3dveHhzbWp2ZnJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MjEyMDgsImV4cCI6MjA4OTA5NzIwOH0.NU3ZIOdxDRcZSYAax3t88fiaUBzpcaNSilC9tULqfug'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? SUPABASE_ANON_KEY
  )

  const { data, error } = await supabase
    .from('branches')
    .select('id, name')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
