'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase'

// ─── Role definitions ──────────────────────────────────────────────────────

export type Role = 'admin' | 'manager' | 'shift_lead' | 'staff'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'מנהל מערכת',
  manager: 'מנהל',
  shift_lead: 'מנהל משמרת',
  staff: 'עובד',
}

export const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  admin: { bg: 'rgba(239,68,68,0.15)', text: '#F87171' },
  manager: { bg: 'rgba(16,185,129,0.15)', text: '#10B981' },
  shift_lead: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  staff: { bg: 'rgba(139,143,168,0.15)', text: '#8B8FA8' },
}

// ─── Permissions ──────────────────────────────────────────────────────────

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

const PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'dashboard', 'shifts', 'bookings', 'payments', 'tasks', 'vouchers',
    'operator_info', 'employees', 'attendance', 'payroll', 'payroll_manual',
    'admin', 'user_management',
  ],
  manager: [
    'dashboard', 'shifts', 'bookings', 'payments', 'tasks', 'vouchers',
    'operator_info', 'employees', 'attendance', 'payroll', 'payroll_manual',
    'admin', 'user_management',
  ],
  shift_lead: [
    'dashboard', 'shifts', 'bookings', 'payments', 'tasks', 'vouchers',
    'operator_info', 'employees', 'attendance', 'payroll', 'payroll_manual',
  ],
  staff: [
    'dashboard', 'shifts', 'operator_info', 'attendance',
  ],
}

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false
}

// ─── User types ─────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
  active: boolean
}

export interface StoredUser extends AuthUser {
  password: string
  phone?: string
  idNumber?: string
  startDate?: string
}

// ─── Context ────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null
  users: StoredUser[]
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  can: (permission: Permission) => boolean
  createUser: (data: Omit<StoredUser, 'id'>) => void
  updateUser: (id: string, data: Partial<StoredUser>) => void
  deleteUser: (id: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loadProfile(userId: string, email: string): Promise<AuthUser | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_profiles')
    .select('id, full_name, role, active')
    .eq('id', userId)
    .single()
  if (!data) return null
  return {
    id: data.id,
    email,
    name: data.full_name,
    role: data.role as Role,
    active: data.active,
  }
}

async function fetchAllUsers(): Promise<StoredUser[]> {
  try {
    const res = await fetch('/api/users')
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [users, setUsers] = useState<StoredUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Load session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id, session.user.email ?? '')
        setUser(profile)
      }
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id, session.user.email ?? '')
        setUser(profile)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('אימייל או סיסמה שגויים')
      return false
    }
    // Refresh users list after login (for admin pages)
    fetchAllUsers().then(setUsers)
    return true
  }, [])

  const logout = useCallback(() => {
    const supabase = createClient()
    supabase.auth.signOut()
    setUser(null)
  }, [])

  const canDo = useCallback(
    (permission: Permission) => {
      if (!user) return false
      return can(user.role, permission)
    },
    [user]
  )

  const createUser = useCallback((data: Omit<StoredUser, 'id'>) => {
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (res.ok) {
        const newUser = await res.json() as StoredUser
        setUsers((prev) => [...prev, newUser])
      }
    })
  }, [])

  const updateUser = useCallback((id: string, data: Partial<StoredUser>) => {
    fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (res.ok) {
        const updated = await res.json() as Partial<StoredUser>
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)))
        if (user?.id === id) setUser((prev) => (prev ? { ...prev, ...updated } : null))
      }
    })
  }, [user])

  const deleteUser = useCallback((id: string) => {
    fetch(`/api/users/${id}`, { method: 'DELETE' }).then((res) => {
      if (res.ok) setUsers((prev) => prev.filter((u) => u.id !== id))
    })
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, users, loading, error, login, logout, can: canDo, createUser, updateUser, deleteUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
