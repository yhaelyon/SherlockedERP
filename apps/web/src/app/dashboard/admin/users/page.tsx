'use client'

import { useState } from 'react'
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
}

export default function AdminUsersPage() {
  const { user: me, users, createUser, updateUser, deleteUser, can } = useAuth()
  const router = useRouter()

  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<Omit<StoredUser, 'id'>>({ ...BLANK_FORM })
  const [addError, setAddError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<StoredUser>>({})
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})

  // Guard: admin only
  if (!can('user_management')) {
    return (
      <div className="p-6">
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}
        >
          <div className="text-3xl mb-3">🔒</div>
          <div className="text-[#E8EAFF] font-semibold">אין לך הרשאה לצפות בדף זה</div>
          <div className="text-[#8B8FA8] text-sm mt-1">דף זה זמין למנהלים בלבד</div>
          <button
            onClick={() => router.replace('/dashboard')}
            className="mt-4 px-4 py-2 rounded-lg text-sm"
            style={{ background: '#2A2D3E', color: '#8B8FA8' }}
          >
            חזרה ללוח הבקרה
          </button>
        </div>
      </div>
    )
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    if (users.some((u) => u.email.toLowerCase() === addForm.email.toLowerCase())) {
      setAddError('אימייל זה כבר קיים במערכת')
      return
    }
    if (addForm.password.length < 6) {
      setAddError('סיסמה חייבת להכיל לפחות 6 תווים')
      return
    }
    createUser(addForm)
    setShowAdd(false)
    setAddForm({ ...BLANK_FORM })
  }

  function startEdit(u: StoredUser) {
    setEditingId(u.id)
    setEditForm({ ...u })
  }

  function saveEdit() {
    if (!editingId) return
    if (editForm.password && editForm.password.length < 6) return
    updateUser(editingId, editForm)
    setEditingId(null)
    setEditForm({})
  }

  function toggleActive(u: StoredUser) {
    if (u.id === me?.id) return // can't deactivate self
    updateUser(u.id, { active: !u.active })
  }

  function handleDelete(u: StoredUser) {
    if (u.id === me?.id) return // can't delete self
    if (!confirm(`האם למחוק את המשתמש "${u.name}"?`)) return
    deleteUser(u.id)
  }

  const roleColor = (role: Role) => ROLE_COLORS[role] || { bg: 'rgba(139,143,168,0.15)', text: '#8B8FA8' }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EAFF]">ניהול משתמשים</h1>
          <p className="text-[#8B8FA8] text-sm mt-1">{users.length} משתמשים במערכת</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-lg text-sm font-bold"
          style={{ background: '#00C4AA', color: '#0F1117' }}
        >
          + הוסף משתמש
        </button>
      </div>

      {/* Roles legend */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {ROLES.map((r) => (
          <div
            key={r}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: ROLE_COLORS[r].bg, color: ROLE_COLORS[r].text }}
          >
            {ROLE_LABELS[r]}
          </div>
        ))}
      </div>

      {/* Users list */}
      <div className="grid gap-3">
        {users.map((u) => {
          const isMe = u.id === me?.id
          const isEditing = editingId === u.id
          const rc = roleColor(isEditing ? (editForm.role ?? u.role) : u.role)

          return (
            <div
              key={u.id}
              className="rounded-2xl p-5"
              style={{
                background: '#1A1D27',
                border: `1px solid ${!u.active ? 'rgba(239,68,68,0.2)' : '#2A2D3E'}`,
                opacity: u.active ? 1 : 0.6,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Avatar + info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
                    style={{ background: '#22253A', color: '#00C4AA' }}
                  >
                    {u.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.name ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="text-sm font-semibold rounded px-2 py-1 outline-none w-full mb-1"
                        style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[#E8EAFF] font-semibold">{u.name}</span>
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
                    )}
                    {isEditing ? (
                      <input
                        type="email"
                        value={editForm.email ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="text-xs rounded px-2 py-1 outline-none w-full"
                        style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#8B8FA8', direction: 'ltr' }}
                      />
                    ) : (
                      <div className="text-xs text-[#8B8FA8] font-numbers" dir="ltr">{u.email}</div>
                    )}
                  </div>
                </div>

                {/* Role + actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isEditing ? (
                    <select
                      value={editForm.role ?? u.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                      className="rounded-lg px-2 py-1.5 text-xs outline-none"
                      style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
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

                  {isEditing ? (
                    <>
                      <button
                        onClick={saveEdit}
                        className="text-xs px-3 py-1.5 rounded-lg font-bold"
                        style={{ background: '#00C4AA', color: '#0F1117' }}
                      >
                        שמור
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditForm({}) }}
                        className="text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: '#2A2D3E', color: '#8B8FA8' }}
                      >
                        ביטול
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(u)}
                        className="text-xs px-2 py-1.5 rounded-lg"
                        style={{ background: '#2A2D3E', color: '#8B8FA8' }}
                      >
                        ✏ עריכה
                      </button>
                      {!isMe && (
                        <>
                          <button
                            onClick={() => toggleActive(u)}
                            className="text-xs px-2 py-1.5 rounded-lg"
                            style={{
                              background: u.active ? 'rgba(245,158,11,0.1)' : 'rgba(0,196,170,0.1)',
                              color: u.active ? '#F59E0B' : '#00C4AA',
                            }}
                          >
                            {u.active ? 'השבת' : 'הפעל'}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="text-xs px-2 py-1.5 rounded-lg"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}
                          >
                            מחק
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Password reset (edit mode) */}
              {isEditing && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid #2A2D3E' }}>
                  <label className="block text-xs text-[#8B8FA8] mb-1">
                    סיסמה חדשה (השאר ריק לאי-שינוי)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword[u.id] ? 'text' : 'password'}
                      value={editForm.password ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      placeholder="לפחות 6 תווים"
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF', direction: 'ltr' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => ({ ...p, [u.id]: !p[u.id] }))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
                      style={{ color: '#555870' }}
                    >
                      {showPassword[u.id] ? 'הסתר' : 'הצג'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add user modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowAdd(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[#E8EAFF] mb-4">הוספת משתמש חדש</h2>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">שם מלא</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  required
                  placeholder="ישראל ישראלי"
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                />
              </div>
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">אימייל</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  required
                  placeholder="user@sherlocked.co.il"
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF', direction: 'ltr' }}
                />
              </div>
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">סיסמה</label>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  required
                  minLength={6}
                  placeholder="לפחות 6 תווים"
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF', direction: 'ltr' }}
                />
              </div>
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">תפקיד</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value as Role })}
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <div className="mt-1 text-xs" style={{ color: ROLE_COLORS[addForm.role].text }}>
                  {addForm.role === 'admin' && 'גישה מלאה לכל המערכת'}
                  {addForm.role === 'manager' && 'גישה מלאה לכל המערכת'}
                  {addForm.role === 'shift_lead' && 'גישה לכל הפיצ׳רים כולל עריכת שעות עובדים — ללא הגדרות מנהל'}
                  {addForm.role === 'staff' && 'גישה לדיווח נוכחות ומשמרות בלבד'}
                </div>
              </div>

              {addError && (
                <div
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}
                >
                  {addError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: '#00C4AA', color: '#0F1117' }}
                >
                  צור משתמש
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setAddError('') }}
                  className="flex-1 py-2.5 rounded-xl text-sm"
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
