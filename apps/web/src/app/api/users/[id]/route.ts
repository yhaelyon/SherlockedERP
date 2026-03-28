import { getAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/users/[id] — fetch single user profile (admin client, bypasses RLS)
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, role, active')
      .eq('id', params.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Fetch failed' }, { status: 500 })
  }
}



// PUT /api/users/[id] — update profile + auth email/password
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const {
      name, email, password, role, active, phone, idNumber,
      hourlyRate, employmentType, globalMonthlySalary, travelPerShift,
      maxTravelMonthly, overtimeEligible, vacationPayEligible,
      monthlyHealthEligible, monthlyHealthAmount
    } = await req.json()

    const supabase = getAdminClient()

    // 1. Update Auth user if email or password changed
    const authUpdate: any = {}
    if (email) authUpdate.email = email
    if (password) authUpdate.password = password

    if (Object.keys(authUpdate).length > 0) {
      const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdate)
      if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. Update user_profiles
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        full_name: name,
        role,
        active,
        phone: phone || null,
        id_number: idNumber || null,
        hourly_rate: hourlyRate ?? 0,
        employment_type: employmentType ?? 'hourly',
        global_monthly_salary: globalMonthlySalary ?? null,
        travel_per_shift: travelPerShift ?? 0,
        max_travel_monthly: maxTravelMonthly ?? 0,
        overtime_eligible: overtimeEligible ?? true,
        vacation_pay_eligible: vacationPayEligible ?? true,
        monthly_health_eligible: monthlyHealthEligible ?? false,
        monthly_health_amount: monthlyHealthAmount ?? 0,
      })
      .eq('id', id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Update failed' }, { status: 500 })
  }
}

// DELETE /api/users/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = getAdminClient()

    // 1. Delete profile
    await supabase.from('user_profiles').delete().eq('id', id)

    // 2. Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(id)
    
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Delete failed' }, { status: 500 })
  }
}
