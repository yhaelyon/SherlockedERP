'use client'

import { useState } from 'react'
import {
  useAuth,
  ROLE_LABELS,
  ROLE_COLORS,
  type Role,
  type StoredUser,
} from '@/lib/auth'

const ROLES: Role[] = ['admin', 'shift_lead', 'staff']

const BLANK_FORM: Omit<StoredUser, 'id'> = {
  name: '',
  email: '',
  password: '',
  role: 'staff',
  active: true,
  phone: '',
  idNumber: '',
  startDate: '',
}

type DrawerMode = 'create' | 'edit'

export default function EmployeesPage() {
  const { user: me, users, createUser, updateUser, deleteUser, can } = useAuth()

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<StoredUser, 'id'>>({ ...BLANK_FORM })
  const [formError, setFormError] = useState('')
  const [showPw, setShowPw] = useState(false)

  // Search
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<Role | 'all'>('all')

  const isAdmin = can('user_management')

  function openCreate() {
    setDrawerMode('create')
    setEditingId(null)
    setForm({ ...BLANK_FORM })
    setFormError('')
    setShowPw(false)
    setDrawerOpen(true)
  }

  function openEdit(u: StoredUser) {
    setDrawerMode('edit')
    setEditingId(u.id)
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      active: u.active,
      phone: u.phone ?? '',
      idNumber: u.idNumber ?? '',
      startDate: u.startDate ?? '',
    })
    setFormError('')
    setShowPw(false)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setFormError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (drawerMode === 'create') {
      if (users.some((u) => u.email.toLowerCase() === form.email.toLowerCase())) {
        setFormError('אימייל זה כבר קיים במערכת')
        return
      }
      if (form.password.length < 6) {
        setFormError('סיסמה חייבת להכיל לפחות 6 תווים')
        return
      }
      createUser(form)
      closeDrawer()
    } else {
      if (!editingId) return
      if (form.password && form.password.length < 6) {
        setFormError('סיסמה חייבת להכיל לפחות 6 תווים')
        return
      }
      const updates: Partial<StoredUser> = {
        name: form.name,
        email: form.email,
        role: form.role,
        active: form.active,
        phone: form.phone,
        idNumber: form.idNumber,
        startDate: form.startDate,
      }
      if (form.password) updates.password = form.password
      updateUser(editingId, updates)
      closeDrawer()
    }
  }

  function handleDelete(u: StoredUser) {
    if (u.id === me?.id) return
    if (!confirm(`האם למחוק את העובד "${u.name}"?`)) return
    deleteUser(u.id)
  }

  function quickRoleChange(u: StoredUser, role: Role) {
    updateUser(u.id, { role })
  }

  function toggleActive(u: StoredUser) {
    if (u.id === me?.id) return
    updateUser(u.id, { active: !u.active })
  }

  const filtered = users.filter((u) => {
    const matchRole = filterRole === 'all' || u.role === filterRole
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone ?? '').includes(q)
    return matchRole && matchSearch
  })

  const stats = {
    total: users.length,
    active: users.filter((u) => u.active).length,
    admin: users.filter((u) => u.role === 'admin').length,
    shift_lead: users.filter((u) => u.role === 'shift_lead').length,
    staff: users.filter((u) => u.role === 'staff').length,
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EAFF]">עובדים</h1>
          <p className="text-[#8B8FA8] text-sm mt-1">
            {stats.active} פעילים מתוך {stats.total} עובדים
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0"
            style={{ background: '#00C4AA', color: '#0F1117' }}
          >
            + עובד חדש
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {ROLES.map((r) => (
          <div
            key={r}
            className="rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-opacity"
            style={{
              background: '#1A1D27',
              border: `1px solid ${filterRole === r ? ROLE_COLORS[r].text : '#2A2D3E'}`,
              opacity: filterRole !== 'all' && filterRole !== r ? 0.5 : 1,
            }}
            onClick={() => setFilterRole(filterRole === r ? 'all' : r)}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: ROLE_COLORS[r].bg, color: ROLE_COLORS[r].text }}
            >
              {stats[r]}
            </div>
            <div className="text-sm font-medium text-[#E8EAFF]">{ROLE_LABELS[r]}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם, אימייל או טלפון..."
          className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
          style={{ background: '#1A1D27', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
        />
      </div>

      {/* Employee list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#8B8FA8]">אין עובדים להצגה</div>
        )}
        {filtered.map((u) => {
          const isMe = u.id === me?.id
          const rc = ROLE_COLORS[u.role]

          return (
            <div
              key={u.id}
              className="rounded-2xl p-4"
              style={{
                background: '#1A1D27',
                border: `1px solid ${!u.active ? 'rgba(239,68,68,0.25)' : '#2A2D3E'}`,
                opacity: u.active ? 1 : 0.65,
              }}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: '#22253A', color: '#00C4AA' }}
                >
                  {u.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#E8EAFF]">{u.name}</span>
                    {isMe && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(0,196,170,0.15)', color: '#00C4AA' }}
                      >
                        אתה
                      </span>
                    )}
                    {!u.active && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}
                      >
                        לא פעיל
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#8B8FA8] font-numbers mt-0.5 flex items-center gap-3 flex-wrap" dir="ltr">
                    <span>{u.email}</span>
                    {u.phone && <span>{u.phone}</span>}
                    {u.startDate && (
                      <span dir="rtl" style={{ direction: 'rtl' }}>
                        מ־{u.startDate}
                      </span>
                    )}
                  </div>
                </div>

                {/* Role + quick change */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isAdmin ? (
                    <select
                      value={u.role}
                      onChange={(e) => quickRoleChange(u, e.target.value as Role)}
                      className="rounded-lg px-2 py-1.5 text-xs outline-none font-medium cursor-pointer"
                      style={{ background: rc.bg, color: rc.text, border: 'none' }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r} style={{ background: '#1A1D27', color: '#E8EAFF' }}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ background: rc.bg, color: rc.text }}
                    >
                      {ROLE_LABELS[u.role]}
                    </span>
                  )}

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-xs px-2.5 py-1.5 rounded-lg"
                        style={{ background: '#2A2D3E', color: '#8B8FA8' }}
                        title="עריכה"
                      >
                        ✏
                      </button>
                      {!isMe && (
                        <>
                          <button
                            onClick={() => toggleActive(u)}
                            className="text-xs px-2.5 py-1.5 rounded-lg"
                            style={{
                              background: u.active ? 'rgba(245,158,11,0.1)' : 'rgba(0,196,170,0.1)',
                              color: u.active ? '#F59E0B' : '#00C4AA',
                            }}
                            title={u.active ? 'השבת' : 'הפעל'}
                          >
                            {u.active ? '⏸' : '▶'}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="text-xs px-2.5 py-1.5 rounded-lg"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}
                            title="מחיקה"
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={closeDrawer}
        >
          <div
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#E8EAFF]">
                {drawerMode === 'create' ? 'עובד חדש' : 'עריכת עובד'}
              </h2>
              <button
                onClick={closeDrawer}
                className="text-lg leading-none"
                style={{ color: '#555870' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Section: Personal */}
              <div
                className="text-xs font-semibold uppercase tracking-widest mb-1"
                style={{ color: '#555870' }}
              >
                פרטים אישיים
              </div>

              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">שם מלא *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="ישראל ישראלי"
                  className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#8B8FA8] mb-1">טלפון</label>
                  <input
                    type="tel"
                    value={form.phone ?? ''}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="050-0000000"
                    className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
                    style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF', direction: 'ltr' }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#8B8FA8] mb-1">תעודת זהות</label>
                  <input
                    type="text"
                    value={form.idNumber ?? ''}
                    onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
                    placeholder="000000000"
                    className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
                    style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF', direction: 'ltr' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">תאריך תחילת עבודה</label>
                <input
                  type="date"
                  value={form.startDate ?? ''}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF', direction: 'ltr' }}
                />
              </div>

              {/* Section: Account */}
              <div
                className="text-xs font-semibold uppercase tracking-widest pt-2"
                style={{ color: '#555870', borderTop: '1px solid #2A2D3E', paddingTop: '1rem' }}
              >
                פרטי חשבון
              </div>

              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">אימייל (שם משתמש) *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="user@sherlocked.co.il"
                  className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF', direction: 'ltr' }}
                />
              </div>

              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">
                  {drawerMode === 'edit' ? 'סיסמה חדשה (השאר ריק לאי-שינוי)' : 'סיסמה *'}
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required={drawerMode === 'create'}
                    minLength={drawerMode === 'create' ? 6 : undefined}
                    placeholder="לפחות 6 תווים"
                    className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
                    style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF', direction: 'ltr' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
                    style={{ color: '#555870' }}
                  >
                    {showPw ? 'הסתר' : 'הצג'}
                  </button>
                </div>
              </div>

              {/* Section: Role */}
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">תפקיד</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm({ ...form, role: r })}
                      className="py-2 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: form.role === r ? ROLE_COLORS[r].bg : '#0F1117',
                        color: form.role === r ? ROLE_COLORS[r].text : '#555870',
                        border: `1px solid ${form.role === r ? ROLE_COLORS[r].text : '#2A2D3E'}`,
                      }}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 text-xs" style={{ color: '#555870' }}>
                  {form.role === 'admin' && 'גישה מלאה לכל המערכת כולל הגדרות'}
                  {form.role === 'shift_lead' && 'גישה לכל הפיצ׳רים כולל עריכת שעות עובדים'}
                  {form.role === 'staff' && 'גישה לדיווח נוכחות ומשמרות בלבד'}
                </div>
              </div>

              {/* Active toggle (edit only) */}
              {drawerMode === 'edit' && editingId !== me?.id && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-[#E8EAFF]">חשבון פעיל</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, active: !form.active })}
                    className="w-11 h-6 rounded-full transition-all relative"
                    style={{
                      background: form.active ? '#00C4AA' : '#2A2D3E',
                    }}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all"
                      style={{ left: form.active ? '1.5rem' : '0.25rem' }}
                    />
                  </button>
                </div>
              )}

              {formError && (
                <div
                  className="px-3 py-2 rounded-xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}
                >
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl font-bold text-sm"
                  style={{ background: '#00C4AA', color: '#0F1117' }}
                >
                  {drawerMode === 'create' ? 'צור עובד' : 'שמור שינויים'}
                </button>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex-1 py-3 rounded-xl text-sm"
                  style={{ background: '#2A2D3E', color: '#8B8FA8' }}
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
