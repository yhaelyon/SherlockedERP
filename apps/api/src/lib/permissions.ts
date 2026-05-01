import type { FastifyReply, FastifyRequest } from 'fastify'
import { supabase } from './supabase'

export type Role = 'admin' | 'manager' | 'shift_lead' | 'staff'

export type Permission =
  | 'dashboard'
  | 'shifts'
  | 'bookings'
  | 'payments'
  | 'tasks'
  | 'vouchers'
  | 'operator_info'
  | 'employees'
  | 'attendance'
  | 'payroll'
  | 'payroll_manual'
  | 'admin'
  | 'user_management'
  | 'whatsapp_inbox'

export interface ApiUser {
  id: string
  email: string
  name: string
  role: Role
  active: boolean
}

const PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'dashboard', 'shifts', 'bookings', 'payments', 'tasks', 'vouchers',
    'operator_info', 'employees', 'attendance', 'payroll', 'payroll_manual',
    'admin', 'user_management', 'whatsapp_inbox',
  ],
  manager: [
    'dashboard', 'shifts', 'bookings', 'payments', 'tasks', 'vouchers',
    'operator_info', 'employees', 'attendance', 'payroll', 'payroll_manual',
    'admin', 'user_management', 'whatsapp_inbox',
  ],
  shift_lead: [
    'dashboard', 'shifts', 'bookings', 'payments', 'tasks', 'vouchers',
    'operator_info', 'employees', 'attendance', 'payroll', 'payroll_manual',
    'whatsapp_inbox',
  ],
  staff: [
    'dashboard', 'shifts', 'operator_info', 'attendance', 'whatsapp_inbox',
  ],
}

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false
}

function readBearerToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

export async function requirePermission(
  req: FastifyRequest,
  reply: FastifyReply,
  permission: Permission,
): Promise<ApiUser | null> {
  const token = readBearerToken(req)
  if (!token) {
    reply.status(401).send({ error: 'Missing bearer token' })
    return null
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  const authUser = authData.user

  if (authError || !authUser) {
    reply.status(401).send({ error: 'Invalid session' })
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, full_name, role, active')
    .eq('id', authUser.id)
    .single()

  if (profileError || !profile || profile.active === false) {
    reply.status(403).send({ error: 'Inactive or missing user profile' })
    return null
  }

  const role = profile.role as Role
  if (!can(role, permission)) {
    reply.status(403).send({ error: 'Missing permission' })
    return null
  }

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    name: profile.full_name ?? authUser.email ?? '',
    role,
    active: profile.active !== false,
  }
}
