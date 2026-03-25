import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = 'https://rqjxemirswoxxsmjvfrc.supabase.co'
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxanhlbWlyc3dveHhzbWp2ZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyMTIwOCwiZXhwIjoyMDg5MDk3MjA4fQ.lQrfVibfq3gMwcTNMhypPVpozHyTHU_Kb8po5ooFPds'

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// GET /api/users — list all users (profiles + emails from auth.users)
export async function GET() {
  const supabase = adminClient()

  const [profilesRes, authRes] = await Promise.all([
    supabase.from('user_profiles').select('id, full_name, role, active, phone, id_number, hourly_rate, employment_type, global_monthly_salary, travel_per_shift, max_travel_monthly, overtime_eligible, vacation_pay_eligible, monthly_health_eligible, monthly_health_amount').order('full_name'),
    supabase.auth.admin.listUsers(),
  ])

  const profiles = profilesRes.data ?? []
  const emailMap = new Map((authRes.data?.users ?? []).map((u) => [u.id, u.email ?? '']))

  const users = profiles.map((p) => ({
    id: p.id,
    name: p.full_name,
    email: emailMap.get(p.id) ?? '',
    role: p.role,
    active: p.active,
    phone: p.phone ?? '',
    idNumber: p.id_number ?? '',
    password: '',
    // Salary fields
    hourlyRate: p.hourly_rate ?? 0,
    employmentType: p.employment_type ?? 'hourly',
    globalMonthlySalary: p.global_monthly_salary ?? null,
    travelPerShift: p.travel_per_shift ?? 0,
    maxTravelMonthly: p.max_travel_monthly ?? 0,
    overtimeEligible: p.overtime_eligible ?? true,
    vacationPayEligible: p.vacation_pay_eligible ?? true,
    monthlyHealthEligible: p.monthly_health_eligible ?? false,
    monthlyHealthAmount: p.monthly_health_amount ?? 0,
  }))

  return NextResponse.json(users)
}

// POST /api/users — create a new user (auth + profile)
export async function POST(req: NextRequest) {
  const { name, email, password, role, active, phone, idNumber } = await req.json()

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: 'name, email, password, role נדרשים' }, { status: 400 })
  }

  const supabase = adminClient()

  // Create Supabase Auth user
  const { data: { user }, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !user) {
    return NextResponse.json({ error: authError?.message ?? 'שגיאה ביצירת משתמש' }, { status: 400 })
  }

  // Create user_profiles row
  const { error: profileError } = await supabase.from('user_profiles').insert({
    id: user.id,
    full_name: name,
    role,
    active: active ?? true,
    phone: phone || null,
    id_number: idNumber || null,
  })

  if (profileError) {
    // Rollback auth user
    await supabase.auth.admin.deleteUser(user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json(
    { id: user.id, name, email, role, active: active ?? true, phone: phone ?? '', idNumber: idNumber ?? '', password: '' },
    { status: 201 }
  )
}
