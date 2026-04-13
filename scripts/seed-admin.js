const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://rqjxemirswoxxsmjvfrc.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxanhlbWlyc3dveHhzbWp2ZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyMTIwOCwiZXhwIjoyMDg5MDk3MjA4fQ.lQrfVibfq3gMwcTNMhypPVpozHyTHU_Kb8po5ooFPds'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function createAdmin() {
  const email = 'admin@sherlocked.co.il'
  const password = 'Admin1234'
  const name = 'Admin User'

  console.log('--- Registering admin user ---')

  // 1. Create Auth User
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('Auth user already exists.')
    } else {
      console.error('Auth Error:', authError)
      return
    }
  } else {
    console.log('Auth user created:', authUser.user.id)
  }

  // 2. Get User ID (either from created or existing)
  const { data: users } = await supabase.auth.admin.listUsers()
  const targetUser = users.users.find(u => u.email === email)
  
  if (!targetUser) {
    console.error('Could not find user after creation.')
    return
  }

  // 3. Create/Update Profile
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert({
      id: targetUser.id,
      full_name: name,
      role: 'admin',
      active: true,
      branch_id: '11111111-1111-1111-1111-111111111111' // Placeholder or first branch
    })

  if (profileError) {
    console.error('Profile Error:', profileError)
  } else {
    console.log('Profile created/updated for admin.')
  }

  console.log('--- Done ---')
}

createAdmin()
