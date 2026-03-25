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

// PATCH /api/users/[id] — update profile and/or auth credentials
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const {
    name, role, active, phone, idNumber, email, password,
    // Salary fields
    hourlyRate, employmentType, globalMonthlySalary,
    travelPerShift, maxTravelMonthly,
    overtimeEligible, vacationPayEligible,
    monthlyHealthEligible, monthlyHealthAmount,
  } = await req.json()
  const supabase = adminClient()

  // Build user_profiles update
  const profileUpdates: Record<string, unknown> = {}
  if (name !== undefined) profileUpdates.full_name = name
  if (role !== undefined) profileUpdates.role = role
  if (active !== undefined) profileUpdates.active = active
  if (phone !== undefined) profileUpdates.phone = phone || null
  if (idNumber !== undefined) profileUpdates.id_number = idNumber || null
  // Salary fields
  if (hourlyRate !== undefined) profileUpdates.hourly_rate = hourlyRate
  if (employmentType !== undefined) profileUpdates.employment_type = employmentType
  if (globalMonthlySalary !== undefined) profileUpdates.global_monthly_salary = globalMonthlySalary
  if (travelPerShift !== undefined) profileUpdates.travel_per_shift = travelPerShift
  if (maxTravelMonthly !== undefined) profileUpdates.max_travel_monthly = maxTravelMonthly
  if (overtimeEligible !== undefined) profileUpdates.overtime_eligible = overtimeEligible
  if (vacationPayEligible !== undefined) profileUpdates.vacation_pay_eligible = vacationPayEligible
  if (monthlyHealthEligible !== undefined) profileUpdates.monthly_health_eligible = monthlyHealthEligible
  if (monthlyHealthAmount !== undefined) profileUpdates.monthly_health_amount = monthlyHealthAmount

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabase.from('user_profiles').update(profileUpdates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update auth.users email/password if provided
  if (email || password) {
    const authUpdates: Record<string, string> = {}
    if (email) authUpdates.email = email
    if (password) authUpdates.password = password
    const { error } = await supabase.auth.admin.updateUserById(id, authUpdates)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    id,
    ...(name !== undefined ? { name } : {}),
    ...(role !== undefined ? { role } : {}),
    ...(active !== undefined ? { active } : {}),
    ...(phone !== undefined ? { phone: phone ?? '' } : {}),
    ...(idNumber !== undefined ? { idNumber: idNumber ?? '' } : {}),
    ...(email ? { email } : {}),
  })
}

// DELETE /api/users/[id] — delete auth user (cascades to user_profiles via FK)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = adminClient()
  const { error } = await supabase.auth.admin.deleteUser(params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
