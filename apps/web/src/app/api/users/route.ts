import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/users — list all users (profiles + emails from auth.users)
export async function GET() {
  const supabase = getAdminClient()

  const [profilesRes, authRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, full_name, role, active, phone, id_number, hourly_rate, employment_type, global_monthly_salary, travel_per_shift, max_travel_monthly, overtime_eligible, vacation_pay_eligible, monthly_health_eligible, monthly_health_amount')
      .order('full_name'),
    supabase.auth.admin.listUsers(),
  ])

  const profiles = profilesRes.data ?? []
  const authUsers = authRes.data?.users ?? []
  const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))

  const users = profiles.map((p) => ({
    id: p.id,
    name: p.full_name,
    email: emailMap.get(p.id) ?? '',
    role: p.role,
    active: p.active,
    phone: p.phone ?? '',
    idNumber: p.id_number ?? '',
    password: '', // masked for security
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
  const body = await req.json()
  const { name, email, password, role, active, phone, idNumber } = body

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: 'name, email, password, role נדרשים' }, { status: 400 })
  }

  const supabase = getAdminClient()

  // 1. Create Supabase Auth user
  const { data: { user }, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !user) {
    return NextResponse.json({ error: authError?.message ?? 'שגיאה ביצירת משתמש' }, { status: 400 })
  }

  // 2. Create user_profiles row with all fields
  const { error: profileError } = await supabase.from('user_profiles').insert({
    id: user.id,
    full_name: name,
    role,
    active: active ?? true,
    phone: phone || null,
    id_number: idNumber || null,
    hourly_rate: body.hourlyRate ?? 0,
    employment_type: body.employmentType ?? 'hourly',
    global_monthly_salary: body.globalMonthlySalary ?? null,
    travel_per_shift: body.travelPerShift ?? 0,
    max_travel_monthly: body.maxTravelMonthly ?? 0,
    overtime_eligible: body.overtimeEligible ?? true,
    vacation_pay_eligible: body.vacationPayEligible ?? true,
    monthly_health_eligible: body.monthlyHealthEligible ?? false,
    monthly_health_amount: body.monthlyHealthAmount ?? 0,
  })

  if (profileError) {
    // Rollback auth user
    await supabase.auth.admin.deleteUser(user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ...body, id: user.id, password: '' }, { status: 201 })
}

// PUT /api/users — update an existing user
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, name, email, password, role, active, phone, idNumber } = body

  if (!id) {
    return NextResponse.json({ error: 'id נדרש' }, { status: 400 })
  }

  const supabase = getAdminClient()

  // 1. Update Supabase Auth if email or password changed
  const authUpdates: any = {}
  if (email) authUpdates.email = email
  if (password) authUpdates.password = password

  if (Object.keys(authUpdates).length > 0) {
    const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdates)
    if (authError) {
      return NextResponse.json({ error: `שגיאה בעדכון Auth: ${authError.message}` }, { status: 400 })
    }
  }

  // 2. Update user_profiles row
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({
      full_name: name,
      role,
      active: active ?? true,
      phone: phone || null,
      id_number: idNumber || null,
      hourly_rate: body.hourlyRate,
      employment_type: body.employmentType,
      global_monthly_salary: body.globalMonthlySalary,
      travel_per_shift: body.travelPerShift,
      max_travel_monthly: body.maxTravelMonthly,
      overtime_eligible: body.overtimeEligible,
      vacation_pay_eligible: body.vacationPayEligible,
      monthly_health_eligible: body.monthlyHealthEligible,
      monthly_health_amount: body.monthlyHealthAmount,
    })
    .eq('id', id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ...body, password: '' })
}

// DELETE /api/users — remove a user
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id נדרש' }, { status: 400 })
  }

  const supabase = getAdminClient()

  // 1. Delete user_profiles row (cascade might handle it, but let's be explicit)
  await supabase.from('user_profiles').delete().eq('id', id)

  // 2. Delete Supabase Auth user
  const { error: authError } = await supabase.auth.admin.deleteUser(id)

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
