'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'

// ─── Role definitions ──────────────────────────────────────────────────────

export type Role = 'admin' | 'shift_lead' | 'staff'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'מנהל',
  shift_lead: 'מנהל משמרת',
  staff: 'עובד',
}

export const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  admin: { bg: 'rgba(239,68,68,0.15)', text: '#F87171' },
  shift_lead: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  staff: { bg: 'rgba(139,143,168,0.15)', text: '#8B8FA8' },
}

// ─── Permissions ──────────────────────────────────────────────────────────

export type Permission =
  | 'dashboard'
  | 'shifts'         // shifts board + constraints (staff read-only)
  | 'bookings'
  | 'payments'
  | 'tasks'
  | 'vouchers'
  | 'operator_info'
  | 'employees'
  | 'attendance'     // own clock-in/out
  | 'payroll'        // view hours reports, salary, etc.
  | 'payroll_manual' // manually add/edit shifts (shift_lead+)
  | 'admin'          // admin settings (admin only)
  | 'user_management'// manage users (admin only)

const PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
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
  return PERMISSIONS[role].includes(permission)
}

// ─── User type ─────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
  active: boolean
}

// ─── Mock user store (localStorage) ───────────────────────────────────────
// In production this is replaced by Supabase auth.users + user_profiles

const USERS_KEY = 'sherlocked_users'
const SESSION_KEY = 'sherlocked_session'

export interface StoredUser extends AuthUser {
  password: string // plain for local dev only — swap for Supabase in prod
  // Personal details
  phone?: string
  idNumber?: string
  startDate?: string
}

const DEFAULT_USERS: StoredUser[] = [
  {
    id: 'usr_admin_1',
    email: 'admin@sherlocked.co.il',
    name: 'מנהל ראשי',
    role: 'admin',
    active: true,
    password: 'Admin1234',
  },
  {
    id: 'usr_lead_1',
    email: 'lead@sherlocked.co.il',
    name: 'מנהל משמרת',
    role: 'shift_lead',
    active: true,
    password: 'Lead1234',
  },
  {
    id: 'usr_staff_1',
    email: 'staff@sherlocked.co.il',
    name: 'עובד לדוגמה',
    role: 'staff',
    active: true,
    password: 'Staff1234',
  },
]

function loadUsers(): StoredUser[] {
  if (typeof window === 'undefined') return DEFAULT_USERS
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (raw) return JSON.parse(raw) as StoredUser[]
  } catch {}
  saveUsers(DEFAULT_USERS)
  return DEFAULT_USERS
}

function saveUsers(users: StoredUser[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function loadSession(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw) as AuthUser
  } catch {}
  return null
}

function saveSession(user: AuthUser | null) {
  if (typeof window === 'undefined') return
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(SESSION_KEY)
  }
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
  // User management (admin only)
  createUser: (data: Omit<StoredUser, 'id'>) => void
  updateUser: (id: string, data: Partial<StoredUser>) => void
  deleteUser: (id: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [users, setUsers] = useState<StoredUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const session = loadSession()
    const allUsers = loadUsers()
    setUser(session)
    setUsers(allUsers)
    setLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null)
    const allUsers = loadUsers()
    const match = allUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )
    if (!match) {
      setError('אימייל או סיסמה שגויים')
      return false
    }
    if (!match.active) {
      setError('חשבון זה אינו פעיל. פנה למנהל.')
      return false
    }
    const authUser: AuthUser = {
      id: match.id,
      email: match.email,
      name: match.name,
      role: match.role,
      active: match.active,
    }
    setUser(authUser)
    saveSession(authUser)
    return true
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    saveSession(null)
  }, [])

  const canDo = useCallback(
    (permission: Permission) => {
      if (!user) return false
      return can(user.role, permission)
    },
    [user]
  )

  const createUser = useCallback((data: Omit<StoredUser, 'id'>) => {
    const newUser: StoredUser = { ...data, id: `usr_${Date.now()}` }
    setUsers((prev) => {
      const updated = [...prev, newUser]
      saveUsers(updated)
      return updated
    })
  }, [])

  const updateUser = useCallback((id: string, data: Partial<StoredUser>) => {
    setUsers((prev) => {
      const updated = prev.map((u) => (u.id === id ? { ...u, ...data } : u))
      saveUsers(updated)
      // Refresh session if editing self
      const session = loadSession()
      if (session?.id === id) {
        const fresh = updated.find((u) => u.id === id)
        if (fresh) {
          const authUser: AuthUser = { id: fresh.id, email: fresh.email, name: fresh.name, role: fresh.role, active: fresh.active }
          setUser(authUser)
          saveSession(authUser)
        }
      }
      return updated
    })
  }, [])

  const deleteUser = useCallback((id: string) => {
    setUsers((prev) => {
      const updated = prev.filter((u) => u.id !== id)
      saveUsers(updated)
      return updated
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
