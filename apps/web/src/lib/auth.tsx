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
  try {
    // Use our own API route (admin client / service role key) — bypasses RLS
    // This avoids the browser-side race condition where auth.uid() isn't set yet
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(`/api/users/${userId}`, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) return null
    const data = await res.json()
    if (!data?.id) return null

    return {
      id: data.id,
      email,
      name: data.full_name,
      role: data.role as Role,
      active: data.active,
    }
  } catch (e) {
    console.error('[Auth] loadProfile failed:', e)
    return null
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
    // Clear any stale cookies left by old @supabase/ssr package
    // (it used cookie storage which broke token refresh on the production domain)
    if (typeof window !== 'undefined') {
      try {
        const oldKeys = Object.keys(localStorage).filter(k =>
          k.startsWith('sb-') && !k.includes('sherlocked-auth-v2')
        )
        oldKeys.forEach(k => localStorage.removeItem(k))
        if (oldKeys.length) console.log('[Auth] Cleared', oldKeys.length, 'stale old auth keys')
      } catch { /* ignore */ }
    }

    let supabase: ReturnType<typeof createClient>
    try {
      supabase = createClient()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Supabase configuration error'
      setConfigError(msg)
      setLoading(false)
      return
    }

    let settled = false
    const settle = () => {
      if (!settled) {
        settled = true
        clearTimeout(loadingTimer)
      }
    }

    // onAuthStateChange fires ONCE on mount with the current session (INITIAL_SESSION event)
    // This is the single source of truth — avoids the getSession() race condition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      console.log('[Auth] onAuthStateChange event:', event)

      if (!session?.user) {
        setUser(null)
        setLoading(false)
        settle()
        return
      }

      try {
        const profile = await loadProfile(session.user.id, session.user.email ?? '')
        setUser(profile)
      } catch (e) {
        console.error('[Auth] Profile load failed:', e)
        setUser(null)
      }
      setLoading(false)
      settle()
    })

    // Safety net: if onAuthStateChange never fires (browser issue / network hang)
    // force loading=false after 8 seconds so the login page is guaranteed to appear
    const loadingTimer = setTimeout(() => {
      if (!settled) {
        settled = true
        console.warn('[Auth] Loading timed out after 8s – forcing resolution')
        setLoading(false)
      }
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(loadingTimer)
    }
  }, []) // empty deps is fine as we use a singleton

  // ── All hooks must be defined before any early return ──────────────────────

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null)
    try {
      const supabase = createClient()
      console.log('[Auth] Attempting login for:', email)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error }: any = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        console.error('[Auth] Login error:', error.message, error.status)
        if (error.message?.includes('Invalid login credentials')) {
          setError('אימייל או סיסמה שגויים')
        } else if (error.message?.includes('fetch') || error.status === 0) {
          setError('שגיאת חיבור — בדוק חיבור האינטרנט')
        } else {
          setError('שגיאת חיבור — בדוק הגדרות סביבה')
        }
        return false
      }
      if (!data?.session) {
        setError('לא התקבלה סשן — נסה שוב')
        return false
      }
      console.log('[Auth] Login successful, session received')
      fetchAllUsers().then(setUsers)
      return true
    } catch (e) {
      console.error('[Auth] Unexpected login error:', e)
      setError('שגיאת חיבור — בדוק חיבור האינטרנט')
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
