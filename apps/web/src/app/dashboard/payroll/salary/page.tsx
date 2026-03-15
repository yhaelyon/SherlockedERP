'use client'

import { useState } from 'react'

interface EmployeeSalary {
  id: string
  name: string
  role: string
  hourlyRate: number
  globalSalary: number | null
  travelPerShift: number
  maxTravelPerMonth: number
  overtimeEligible: boolean
  vacationPay: boolean
  monthlyHealth: number
}

const INITIAL_EMPLOYEES: EmployeeSalary[] = [
  { id: '1', name: 'דנה לוי', role: 'מנהלת', hourlyRate: 50, globalSalary: null, travelPerShift: 35, maxTravelPerMonth: 700, overtimeEligible: true, vacationPay: true, monthlyHealth: 150 },
  { id: '2', name: 'יוסי כהן', role: 'עובד', hourlyRate: 38, globalSalary: null, travelPerShift: 30, maxTravelPerMonth: 600, overtimeEligible: true, vacationPay: true, monthlyHealth: 100 },
  { id: '3', name: 'מירי שפירא', role: 'עובדת', hourlyRate: 40, globalSalary: null, travelPerShift: 25, maxTravelPerMonth: 500, overtimeEligible: true, vacationPay: true, monthlyHealth: 100 },
  { id: '4', name: 'אבי גולן', role: 'עובד', hourlyRate: 36, globalSalary: null, travelPerShift: 20, maxTravelPerMonth: 400, overtimeEligible: false, vacationPay: true, monthlyHealth: 100 },
]

const ROLES = ['עובד', 'עובדת', 'מנהל', 'מנהלת', 'קופאי', 'קופאית']

export default function PayrollSalaryPage() {
  const [employees, setEmployees] = useState<EmployeeSalary[]>(INITIAL_EMPLOYEES)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<EmployeeSalary>>({})
  const [saved, setSaved] = useState<string | null>(null)

  function startEdit(emp: EmployeeSalary) {
    setEditing(emp.id)
    setDraft({ ...emp })
  }

  function cancelEdit() {
    setEditing(null)
    setDraft({})
  }

  function saveEdit() {
    if (!editing) return
    setEmployees((prev) =>
      prev.map((e) => (e.id === editing ? { ...e, ...draft } as EmployeeSalary : e))
    )
    setSaved(editing)
    setTimeout(() => setSaved(null), 2000)
    setEditing(null)
    setDraft({})
  }

  function updateDraft<K extends keyof EmployeeSalary>(field: K, value: EmployeeSalary[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#E8EAFF] mb-2">ניהול שכר</h1>
      <p className="text-[#8B8FA8] text-sm mb-6">הגדרת פרמטרי שכר לכל עובד</p>

      <div className="grid gap-4">
        {employees.map((emp) => {
          const isEditing = editing === emp.id
          const data = isEditing ? (draft as EmployeeSalary) : emp

          return (
            <div
              key={emp.id}
              className="rounded-2xl p-5"
              style={{ background: '#1A1D27', border: `1px solid ${saved === emp.id ? '#00C4AA' : '#2A2D3E'}` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-[#E8EAFF] font-semibold text-lg">{emp.name}</span>
                  {isEditing ? (
                    <select
                      value={data.role}
                      onChange={(e) => updateDraft('role', e.target.value)}
                      className="rounded px-2 py-0.5 text-sm outline-none"
                      style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#8B8FA8' }}
                    >
                      {ROLES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: '#2A2D3E', color: '#8B8FA8' }}
                    >
                      {emp.role}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={saveEdit}
                        className="px-3 py-1.5 rounded-lg text-sm font-bold"
                        style={{ background: '#00C4AA', color: '#0F1117' }}
                      >
                        שמור
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 rounded-lg text-sm"
                        style={{ background: '#2A2D3E', color: '#8B8FA8' }}
                      >
                        ביטול
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startEdit(emp)}
                      className="px-3 py-1.5 rounded-lg text-sm"
                      style={{ background: '#2A2D3E', color: '#8B8FA8' }}
                    >
                      ✏ עריכה
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <NumField label="שכר שעתי (₪)" value={data.hourlyRate} isEditing={isEditing} onChange={(v) => updateDraft('hourlyRate', Number(v))} />
                <div>
                  <label className="block text-xs text-[#8B8FA8] mb-2">שכר גלובלי (₪)</label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={data.globalSalary ?? ''}
                      onChange={(e) => updateDraft('globalSalary', e.target.value === '' ? null : Number(e.target.value))}
                      placeholder="לא מוגדר"
                      className="w-full rounded-lg px-3 py-2 outline-none text-sm font-numbers"
                      style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                    />
                  ) : (
                    <div className="text-sm px-3 py-2 rounded-lg font-numbers" style={{ background: '#0F1117', color: emp.globalSalary ? '#E8EAFF' : '#4A4D5E' }}>
                      {emp.globalSalary ? `₪${emp.globalSalary}` : 'לא מוגדר'}
                    </div>
                  )}
                </div>
                <NumField label="נסיעות למשמרת (₪)" value={data.travelPerShift} isEditing={isEditing} onChange={(v) => updateDraft('travelPerShift', Number(v))} />
                <NumField label="מקס׳ נסיעות/חודש (₪)" value={data.maxTravelPerMonth} isEditing={isEditing} onChange={(v) => updateDraft('maxTravelPerMonth', Number(v))} />
                <NumField label="בריאות חודשית (₪)" value={data.monthlyHealth} isEditing={isEditing} onChange={(v) => updateDraft('monthlyHealth', Number(v))} />

                <ToggleField
                  label="זכאי לשעות נוספות"
                  value={data.overtimeEligible}
                  isEditing={isEditing}
                  onChange={(v) => updateDraft('overtimeEligible', v)}
                />
                <ToggleField
                  label="דמי חופשה"
                  value={data.vacationPay}
                  isEditing={isEditing}
                  onChange={(v) => updateDraft('vacationPay', v)}
                />
              </div>

              {saved === emp.id && (
                <div className="mt-3 text-sm" style={{ color: '#00C4AA' }}>✓ נשמר בהצלחה</div>
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
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={0}
          className="w-full rounded-lg px-3 py-2 outline-none text-sm font-numbers"
          style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
        />
      ) : (
        <div className="text-sm px-3 py-2 rounded-lg font-numbers" style={{ background: '#0F1117', color: '#E8EAFF' }}>
          ₪{value}
        </div>
      )}
    </div>
  )
}

function ToggleField({ label, value, isEditing, onChange }: { label: string; value: boolean; isEditing: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <label className="block text-xs text-[#8B8FA8] mb-2">{label}</label>
      {isEditing ? (
        <button
          onClick={() => onChange(!value)}
          className="px-4 py-2 rounded-lg text-sm font-medium w-full"
          style={{
            background: value ? 'rgba(0,196,170,0.15)' : '#2A2D3E',
            color: value ? '#00C4AA' : '#8B8FA8',
            border: `1px solid ${value ? '#00C4AA' : '#2A2D3E'}`,
          }}
        >
          {value ? '✓ כן' : '✗ לא'}
        </button>
      ) : (
        <div
          className="px-3 py-2 rounded-lg text-sm"
          style={{
            background: value ? 'rgba(0,196,170,0.1)' : '#2A2D3E',
            color: value ? '#00C4AA' : '#8B8FA8',
          }}
        >
          {value ? '✓ כן' : '✗ לא'}
        </div>
      )}
    </div>
  )
}
