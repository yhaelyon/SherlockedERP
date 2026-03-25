'use client'

import { useState, useEffect } from 'react'

interface EmployeeSalary {
  id: string
  name: string
  role: string
  hourlyRate: number
  employmentType: string
  globalMonthlySalary: number | null
  travelPerShift: number
  maxTravelMonthly: number
  overtimeEligible: boolean
  vacationPayEligible: boolean
  monthlyHealthEligible: boolean
  monthlyHealthAmount: number
}

export default function PayrollSalaryPage() {
  const [employees, setEmployees] = useState<EmployeeSalary[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<EmployeeSalary>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmployees(data.map((u: EmployeeSalary) => ({
            id: u.id,
            name: u.name,
            role: u.role,
            hourlyRate: u.hourlyRate ?? 0,
            employmentType: u.employmentType ?? 'hourly',
            globalMonthlySalary: u.globalMonthlySalary ?? null,
            travelPerShift: u.travelPerShift ?? 0,
            maxTravelMonthly: u.maxTravelMonthly ?? 0,
            overtimeEligible: u.overtimeEligible ?? true,
            vacationPayEligible: u.vacationPayEligible ?? true,
            monthlyHealthEligible: u.monthlyHealthEligible ?? false,
            monthlyHealthAmount: u.monthlyHealthAmount ?? 0,
          })))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function startEdit(emp: EmployeeSalary) {
    setEditing(emp.id)
    setDraft({ ...emp })
    setSaveError('')
  }

  function cancelEdit() {
    setEditing(null)
    setDraft({})
    setSaveError('')
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch(`/api/users/${editing}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hourlyRate: draft.hourlyRate,
          employmentType: draft.employmentType,
          globalMonthlySalary: draft.globalMonthlySalary,
          travelPerShift: draft.travelPerShift,
          maxTravelMonthly: draft.maxTravelMonthly,
          overtimeEligible: draft.overtimeEligible,
          vacationPayEligible: draft.vacationPayEligible,
          monthlyHealthEligible: draft.monthlyHealthEligible,
          monthlyHealthAmount: draft.monthlyHealthAmount,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setSaveError(d.error ?? 'שגיאה בשמירה')
        setSaving(false)
        return
      }
      setEmployees(prev =>
        prev.map(e => e.id === editing ? { ...e, ...draft } as EmployeeSalary : e)
      )
      setSaved(editing)
      setTimeout(() => setSaved(null), 2000)
      setEditing(null)
      setDraft({})
    } catch {
      setSaveError('שגיאת חיבור')
    }
    setSaving(false)
  }

  function update<K extends keyof EmployeeSalary>(field: K, value: EmployeeSalary[K]) {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-[#E8EAFF] mb-6">ניהול שכר</h1>
        <div className="text-center py-12 text-[#4A4D5E]">טוען עובדים...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#E8EAFF] mb-2">ניהול שכר</h1>
      <p className="text-[#8B8FA8] text-sm mb-6">הגדרת פרמטרי שכר לכל עובד — נשמר בבסיס נתונים</p>

      {employees.length === 0 && (
        <div className="text-center py-12 text-[#4A4D5E]">לא נמצאו עובדים במערכת</div>
      )}

      <div className="grid gap-4">
        {employees.map(emp => {
          const isEditing = editing === emp.id
          const data = isEditing ? (draft as EmployeeSalary) : emp

          return (
            <div key={emp.id} className="rounded-2xl p-5"
              style={{ background: '#1A1D27', border: `1px solid ${saved === emp.id ? '#00C4AA' : '#2A2D3E'}` }}>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(0,196,170,0.15)', color: '#00C4AA' }}>
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <span className="text-[#E8EAFF] font-semibold">{emp.name}</span>
                    <span className="mr-2 text-xs px-2 py-0.5 rounded-full" style={{ background: '#2A2D3E', color: '#8B8FA8' }}>{emp.role}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <button onClick={saveEdit} disabled={saving}
                        className="px-3 py-1.5 rounded-lg text-sm font-bold"
                        style={{ background: saving ? '#2A2D3E' : '#00C4AA', color: '#0F1117' }}>
                        {saving ? 'שומר...' : 'שמור'}
                      </button>
                      <button onClick={cancelEdit}
                        className="px-3 py-1.5 rounded-lg text-sm"
                        style={{ background: '#2A2D3E', color: '#8B8FA8' }}>
                        ביטול
                      </button>
                    </>
                  ) : (
                    <button onClick={() => startEdit(emp)}
                      className="px-3 py-1.5 rounded-lg text-sm"
                      style={{ background: '#2A2D3E', color: '#8B8FA8' }}>
                      ✏ עריכה
                    </button>
                  )}
                </div>
              </div>

              {/* Employment type toggle */}
              {isEditing && (
                <div className="mb-4 flex gap-2">
                  {['hourly', 'global'].map(t => (
                    <button key={t} onClick={() => update('employmentType', t)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{
                        background: data.employmentType === t ? 'rgba(0,196,170,0.15)' : '#0F1117',
                        border: `1px solid ${data.employmentType === t ? '#00C4AA' : '#2A2D3E'}`,
                        color: data.employmentType === t ? '#00C4AA' : '#8B8FA8',
                      }}>
                      {t === 'hourly' ? 'שעתי' : 'גלובלי'}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {data.employmentType === 'global' ? (
                  <NumField label="שכר גלובלי חודשי (₪)" value={data.globalMonthlySalary ?? 0} isEditing={isEditing}
                    onChange={v => update('globalMonthlySalary', Number(v))} />
                ) : (
                  <NumField label="שכר שעתי (₪)" value={data.hourlyRate} isEditing={isEditing}
                    onChange={v => update('hourlyRate', Number(v))} />
                )}
                <NumField label="נסיעות למשמרת (₪)" value={data.travelPerShift} isEditing={isEditing}
                  onChange={v => update('travelPerShift', Number(v))} />
                <NumField label="מקס׳ נסיעות/חודש (₪)" value={data.maxTravelMonthly} isEditing={isEditing}
                  onChange={v => update('maxTravelMonthly', Number(v))} />
                <NumField label="בריאות חודשית (₪)" value={data.monthlyHealthAmount} isEditing={isEditing}
                  onChange={v => update('monthlyHealthAmount', Number(v))} />

                <ToggleField label="זכאי לשעות נוספות" value={data.overtimeEligible} isEditing={isEditing}
                  onChange={v => update('overtimeEligible', v)} />
                <ToggleField label="דמי חופשה" value={data.vacationPayEligible} isEditing={isEditing}
                  onChange={v => update('vacationPayEligible', v)} />
                <ToggleField label="בריאות חודשית" value={data.monthlyHealthEligible} isEditing={isEditing}
                  onChange={v => update('monthlyHealthEligible', v)} />
              </div>

              {saveError && editing === emp.id && (
                <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}>{saveError}</div>
              )}
              {saved === emp.id && (
                <div className="mt-3 text-sm" style={{ color: '#00C4AA' }}>✓ נשמר בבסיס נתונים</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NumField({ label, value, isEditing, onChange }: { label: string; value: number; isEditing: boolean; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-[#8B8FA8] mb-2">{label}</label>
      {isEditing ? (
        <input type="number" value={value} min={0} onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg px-3 py-2 outline-none text-sm font-numbers"
          style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }} />
      ) : (
        <div className="text-sm px-3 py-2 rounded-lg font-numbers" style={{ background: '#0F1117', color: '#E8EAFF' }}>₪{value || 0}</div>
      )}
    </div>
  )
}

function ToggleField({ label, value, isEditing, onChange }: { label: string; value: boolean; isEditing: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <label className="block text-xs text-[#8B8FA8] mb-2">{label}</label>
      {isEditing ? (
        <button onClick={() => onChange(!value)}
          className="px-4 py-2 rounded-lg text-sm font-medium w-full"
          style={{
            background: value ? 'rgba(0,196,170,0.15)' : '#2A2D3E',
            color: value ? '#00C4AA' : '#8B8FA8',
            border: `1px solid ${value ? '#00C4AA' : '#2A2D3E'}`,
          }}>
          {value ? '✓ כן' : '✗ לא'}
        </button>
      ) : (
        <div className="px-3 py-2 rounded-lg text-sm"
          style={{ background: value ? 'rgba(0,196,170,0.1)' : '#2A2D3E', color: value ? '#00C4AA' : '#8B8FA8' }}>
          {value ? '✓ כן' : '✗ לא'}
        </div>
      )}
    </div>
  )
}
