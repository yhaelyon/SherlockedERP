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
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>
    try {
      supabase = createClient()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Supabase configuration error'
      setConfigError(msg)
      setLoading(false)
      return
    }

    // Load session on mount
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.auth.getSession().then(async (result: any) => {
      const session = result?.data?.session ?? null
      if (!session?.user) {
        // No session — resolve loading immediately so login page shows fast
        setLoading(false)
        if (loadingTimer) clearTimeout(loadingTimer)
        return
      }
      // Has session — load profile then resolve loading (timer is the safety net)
      try {
        const profile = await loadProfile(session.user.id, session.user.email ?? '')
        setUser(profile)
      } catch (e) {
        console.error('[Auth] Profile load failed:', e)
        setUser(null)
      }
      setLoading(false)
      if (loadingTimer) clearTimeout(loadingTimer)
    }).catch((e: unknown) => {
      console.error('[Auth] Session failed:', e)
      setLoading(false)
      if (loadingTimer) clearTimeout(loadingTimer)
    })

    // Safety timeout: stop loading after 4 seconds no matter what
    const loadingTimer = setTimeout(() => {
      setLoading(p => {
        if (p) console.warn('[Auth] Loading timed out after 4s - forcing resolution')
        return false
      })
    }, 4000)

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setUser(null)
        setLoading(false)
        return
      }
      try {
        const profile = await loadProfile(session.user.id, session.user.email ?? '')
        setUser(profile)
      } catch (e) {
        console.error('[Auth] State change profile load failed:', e)
        setUser(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
      if (loadingTimer) clearTimeout(loadingTimer)
    }
  }, []) // empty deps is fine as we use a singleton

  // ── All hooks must be defined before any early return ──────────────────────

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError('אימייל או סיסמה שגויים')
        return false
      }
      // Refresh users list after login (for admin pages)
      fetchAllUsers().then(setUsers)
      return true
    } catch {
      setError('שגיאת הגדרות מערכת')
      return false
    }
  }, [])

  const logout = useCallback(() => {
    try {
      const supabase = createClient()
      supabase.auth.signOut()
    } catch { /* no-op */ }
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

  // ── Early return AFTER all hooks ───────────────────────────────────────────

  if (configError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1117', flexDirection: 'column', gap: '12px', padding: '24px' }}>
        <div style={{ color: '#F87171', fontSize: '20px' }}>⚠️ שגיאת הגדרות</div>
        <div style={{ color: '#8B8FA8', fontSize: '14px', textAlign: 'center', maxWidth: '480px', direction: 'ltr', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{configError}</div>
      </div>
    )
  }

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
