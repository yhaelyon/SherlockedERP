'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  useAuth,
  ROLE_LABELS,
  ROLE_COLORS,
  type Role,
  type StoredUser,
} from '@/lib/auth'

const ROLES: Role[] = ['admin', 'manager', 'shift_lead', 'staff']

const BLANK_FORM: Omit<StoredUser, 'id'> = {
  name: '',
  email: '',
  password: '',
  role: 'staff',
  active: true,
  phone: '',
  idNumber: '',
  hourlyRate: 35,
  employmentType: 'hourly',
  globalMonthlySalary: null,
  travelPerShift: 0,
  maxTravelMonthly: 0,
  overtimeEligible: true,
  vacationPayEligible: true,
  monthlyHealthEligible: false,
  monthlyHealthAmount: 0,
}

export default function AdminUsersPage() {
  const { user: me, users, createUser, updateUser, deleteUser, can } = useAuth()
  const router = useRouter()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<StoredUser, 'id'>>({ ...BLANK_FORM })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  // Filter and search
  const [search, setSearch] = useState('')
  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(search.toLowerCase()) || 
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.idNumber?.includes(search)
    )
  }, [users, search])

  // Guard: admin only
  if (!can('user_management')) {
    return (
      <div className="p-6">
        <div className="rounded-2xl p-8 text-center" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-[#E8EAFF] text-xl font-bold mb-2">אין לך הרשאה לצפות בדף זה</h2>
          <p className="text-[#8B8FA8]">דף זה זמין למנהלים בלבד</p>
          <button
            onClick={() => router.replace('/dashboard')}
            className="mt-6 px-6 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
            style={{ background: '#2A2D3E', color: '#8B8FA8' }}
          >
            חזרה ללוח הבקרה
          </button>
        </div>
      </div>
    )
  }

  function openAdd() {
    setEditingId(null)
    setForm({ ...BLANK_FORM })
    setError('')
    setShowPassword(true)
    setDrawerOpen(true)
  }

  function openEdit(u: StoredUser) {
    setEditingId(u.id)
    setForm({
      ...u,
      password: '', // don't show password
    })
    setError('')
    setShowPassword(false)
    setDrawerOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!editingId && form.password.length < 6) {
      setError('סיסמה חייבת להכיל לפחות 6 תווים')
      return
    }

    try {
      if (editingId) {
        // Update
        const updates = { ...form }
        if (!updates.password) delete updates.password
        updateUser(editingId, updates)
      } else {
        // Create
        createUser(form)
      }
      setDrawerOpen(false)
    } catch (e: any) {
      setError(e.message || 'שגיאה בשמירת משתמש')
    }
  }

  function toggleActive(u: StoredUser) {
    if (u.id === me?.id) return
    updateUser(u.id, { active: !u.active })
  }

  function handleDelete(u: StoredUser) {
    if (u.id === me?.id) return
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את "${u.name}"? הפעולה לא ניתנת לביטול.`)) {
      deleteUser(u.id)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#E8EAFF]">ניהול עובדים ומשתמשים</h1>
          <p className="text-[#8B8FA8] mt-1">נהל הרשאות, הגדרות שכר ופרטים אישיים של כל צוות העובדים</p>
        </div>
        <button
          onClick={openAdd}
          className="px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#00C4AA]/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #00C4AA 0%, #00A892 100%)', color: '#0F1117' }}
        >
          <span className="text-xl">+</span>
          הוסף משתמש/עובד
        </button>
      </div>

      {/* Stats Quick View (Mockup inspired) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-[#2A2D3E] bg-[#1A1D27]/50">
          <div className="text-[#8B8FA8] text-sm">סה"כ עובדים</div>
          <div className="text-2xl font-bold text-[#E8EAFF] mt-1">{users.length}</div>
        </div>
        <div className="p-4 rounded-2xl border border-[#2A2D3E] bg-[#1A1D27]/50">
          <div className="text-[#8B8FA8] text-sm">עובדים פעילים</div>
          <div className="text-2xl font-bold text-[#00C4AA] mt-1">{users.filter(u => u.active).length}</div>
        </div>
        <div className="p-4 rounded-2xl border border-[#2A2D3E] bg-[#1A1D27]/50">
          <div className="text-[#8B8FA8] text-sm">מנהלים</div>
          <div className="text-2xl font-bold text-[#F87171] mt-1">{users.filter(u => ['admin', 'manager'].includes(u.role)).length}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4 p-4 rounded-2xl bg-[#1A1D27] border border-[#2A2D3E]">
        <div className="relative flex-1">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
          <input
            type="text"
            placeholder="חיפוש לפי שם, אימייל או ת.ז..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-xl py-3 pr-12 pl-4 text-[#E8EAFF] focus:border-[#00C4AA] outline-none transition-colors"
          />
        </div>
      </div>

      {/* Users List */}
      <div className="grid gap-4">
        {filteredUsers.map((u) => {
          const isMe = u.id === me?.id
          const isActive = u.active
          const roleCfg = ROLE_COLORS[u.role] || { bg: 'rgba(139,143,168,0.1)', text: '#8B8FA8' }

          return (
            <div
              key={u.id}
              className={`group rounded-2xl border transition-all hover:bg-[#1f2231] ${
                expandedId === u.id ? 'border-[#00C4AA] bg-[#1f2231]' : 'border-[#2A2D3E] bg-[#1A1D27]'
              }`}
            >
              <div 
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${isActive ? 'bg-[#22253A] text-[#00C4AA]' : 'bg-[#2A2D1A] text-[#F87171]'}`}>
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-[#E8EAFF]">{u.name}</span>
                      {isMe && (
                        <span className="text-[10px] bg-[#00C4AA]/10 text-[#00C4AA] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          אני
                        </span>
                      )}
                      {!isActive && (
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          לא פעיל
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[#8B8FA8] font-numbers" dir="ltr">{u.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="hidden sm:block text-right">
                    <span className="text-xs text-[#8B8FA8] block mb-1">תפקיד</span>
                    <span className="text-xs px-3 py-1 rounded-full font-bold" style={{ background: roleCfg.bg, color: roleCfg.text }}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </div>
                  <div className="hidden md:block text-right">
                    <span className="text-xs text-[#8B8FA8] block mb-1">סוג שכר</span>
                    <span className="text-[#E8EAFF] font-medium">{u.employmentType === 'global' ? 'גלובלי' : 'שעתי'}</span>
                  </div>
                  <div className="text-2xl transition-transform duration-300" style={{ transform: expandedId === u.id ? 'rotate(180deg)' : 'rotate(0)' }}>
                    ⌄
                  </div>
                </div>
              </div>

              {expandedId === u.id && (
                <div className="px-4 pb-4 border-t border-[#2A2D3E] pt-4 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div>
                      <span className="text-xs text-[#8B8FA8] block mb-1">טלפון</span>
                      <span className="text-[#E8EAFF] font-numbers">{u.phone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-[#8B8FA8] block mb-1">מספר זהות</span>
                      <span className="text-[#E8EAFF] font-numbers">{u.idNumber || '—'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-[#8B8FA8] block mb-1">שכר בסיס</span>
                      <span className="text-[#E8EAFF] font-numbers">
                        {u.employmentType === 'global' 
                          ? `₪${u.globalMonthlySalary?.toLocaleString() ?? 0} (חודשי)` 
                          : `₪${u.hourlyRate} (לשעה)`}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-[#8B8FA8] block mb-1">נסיעות (למשמרת)</span>
                      <span className="text-[#E8EAFF] font-numbers">₪{u.travelPerShift}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-4 border-t border-[#2A2D3E] pt-4">
                    <button
                      onClick={() => openEdit(u)}
                      className="px-4 py-2 rounded-xl bg-[#00C4AA] text-[#0F1117] font-bold text-sm"
                    >
                      ✏ עריכת פרטים והגדרות שכר
                    </button>
                    {!isMe && (
                      <>
                        <button
                          onClick={() => toggleActive(u)}
                          className={`px-4 py-2 rounded-xl font-bold text-sm border ${
                            isActive ? 'border-amber-500/50 text-amber-500' : 'border-emerald-500/50 text-emerald-500'
                          }`}
                        >
                          {isActive ? 'השבתת משתמש' : 'הפעלת משתמש'}
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-bold text-sm"
                        >
                          מחיקה לצמיתות
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Edit/Add Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[#1A1D27] border-r border-[#2A2D3E] h-full shadow-2xl flex flex-col animate-in slide-in-from-left">
            <div className="p-6 border-b border-[#2A2D3E] flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#E8EAFF]">
                {editingId ? 'עריכת משתמש' : 'הוספת משתמש חדש'}
              </h2>
              <button 
                onClick={() => setDrawerOpen(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-[#2A2D3E] text-[#8B8FA8] hover:text-[#E8EAFF]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Section 1: Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[#00C4AA] font-bold border-b border-[#2A2D3E] pb-2 mb-4">
                  <span>👤</span>
                  פרטים אישיים והרשאות
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-[#8B8FA8] mr-1">שם מלא</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-xl px-4 py-2.5 text-[#E8EAFF] outline-none focus:border-[#00C4AA]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#8B8FA8] mr-1">מספר ת.ז</label>
                    <input
                      type="text"
                      value={form.idNumber}
                      onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
                      className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-xl px-4 py-2.5 text-[#E8EAFF] outline-none focus:border-[#00C4AA]"
                    />
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-xs text-[#8B8FA8] mr-1">אימייל (לחיבור למערכת)</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      dir="ltr"
                      className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-xl px-4 py-2.5 text-[#8B8FA8] outline-none focus:border-[#00C4AA] text-left"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#8B8FA8] mr-1">טלפון</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      dir="ltr"
                      className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-xl px-4 py-2.5 text-[#8B8FA8] outline-none focus:border-[#00C4AA] text-left"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#8B8FA8] mr-1">תפקיד הרשאה</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                      className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-xl px-4 py-2.5 text-[#E8EAFF] outline-none focus:border-[#00C4AA]"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#8B8FA8] mr-1">סטטוס פעיל</label>
                    <select
                      value={form.active ? 'yes' : 'no'}
                      onChange={(e) => setForm({ ...form, active: e.target.value === 'yes' })}
                      className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-xl px-4 py-2.5 text-[#E8EAFF] outline-none focus:border-[#00C4AA]"
                    >
                      <option value="yes">פעיל</option>
                      <option value="no">מושבת</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#8B8FA8] mr-1">
                    {editingId ? 'שינוי סיסמה (השאר ריק לאי-שינוי)' : 'סיסמה ראשונית'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      minLength={6}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      dir="ltr"
                      className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-xl px-4 py-2.5 text-[#E8EAFF] outline-none focus:border-[#00C4AA] text-left pr-12"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#555870]"
                    >
                      {showPassword ? 'הסתר' : 'הצג'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: Salary Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[#00C4AA] font-bold border-b border-[#2A2D3E] pb-2 mb-4">
                  <span>💰</span>
                  הגדרות שכר ופנסיה
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-[#8B8FA8] mr-1">סוג העסקה</label>
                    <select
                      value={form.employmentType}
                      onChange={(e) => setForm({ ...form, employmentType: e.target.value as any })}
                      className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-xl px-4 py-2.5 text-[#E8EAFF] outline-none focus:border-[#00C4AA]"
                    >
                      <option value="hourly">לפי שעה (טיפוסי)</option>
                      <option value="global">חודשי גלובלי</option>
                    </select>
                  </div>
                  {form.employmentType === 'hourly' ? (
                    <div className="space-y-1">
                      <label className="text-xs text-[#8B8FA8] mr-1">שכר שעה ברוטו</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={form.hourlyRate}
                          onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })}
                          className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-xl px-4 py-2.5 text-[#E8EAFF] outline-none focus:border-[#00C4AA]"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555870]">₪</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs text-[#8B8FA8] mr-1">שכר חודשי ברוטו</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={form.globalMonthlySalary || 0}
                          onChange={(e) => setForm({ ...form, globalMonthlySalary: Number(e.target.value) })}
                          className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-xl px-4 py-2.5 text-[#E8EAFF] outline-none focus:border-[#00C4AA]"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555870]">₪</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Extra Benefits */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[#00C4AA] font-bold border-b border-[#2A2D3E] pb-2 mb-4">
                  <span>🚌</span>
                  נסיעות ותוספות
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-[#8B8FA8] mr-1">נסיעות למשמרת (יומי)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.travelPerShift}
                      onChange={(e) => setForm({ ...form, travelPerShift: Number(e.target.value) })}
                      className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-xl px-4 py-2.5 text-[#E8EAFF] outline-none focus:border-[#00C4AA]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#8B8FA8] mr-1">תקרת נסיעות חודשית</label>
                    <input
                      type="number"
                      value={form.maxTravelMonthly}
                      onChange={(e) => setForm({ ...form, maxTravelMonthly: Number(e.target.value) })}
                      className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-xl px-4 py-2.5 text-[#E8EAFF] outline-none focus:border-[#00C4AA]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-[#2A2D3E] bg-[#0F1117]/50 cursor-pointer hover:bg-[#0F1117] transition-colors">
                    <input
                      type="checkbox"
                      checked={form.overtimeEligible}
                      onChange={(e) => setForm({ ...form, overtimeEligible: e.target.checked })}
                      className="w-5 h-5 rounded border-[#2A2D3E] text-[#00C4AA]"
                    />
                    <span className="text-sm text-[#E8EAFF]">זכאי לתשלום שעות נוספות</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-[#2A2D3E] bg-[#0F1117]/50 cursor-pointer hover:bg-[#0F1117] transition-colors">
                    <input
                      type="checkbox"
                      checked={form.vacationPayEligible}
                      onChange={(e) => setForm({ ...form, vacationPayEligible: e.target.checked })}
                      className="w-5 h-5 rounded border-[#2A2D3E] text-[#00C4AA]"
                    />
                    <span className="text-sm text-[#E8EAFF]">צבירת ימי חופשה והבראה</span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                   שגיאה: {error}
                </div>
              )}

              <div className="pt-8 flex gap-4">
                <button
                  type="submit"
                  className="flex-1 py-4 rounded-2xl font-bold bg-[#00C4AA] text-[#0F1117] shadow-lg shadow-[#00C4AA]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {editingId ? 'עדכן משתמש' : 'צור משתמש חדש'}
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="px-8 py-4 rounded-2xl font-bold bg-[#2A2D3E] text-[#8B8FA8] hover:bg-[#2F3244] transition-all"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
