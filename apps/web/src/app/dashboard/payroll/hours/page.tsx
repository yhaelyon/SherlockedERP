'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'

const HEBREW_DAYS: Record<number, string> = {
  0: 'ראשון', 1: 'שני', 2: 'שלישי', 3: 'רביעי', 4: 'חמישי', 5: 'שישי', 6: 'שבת',
}

const MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

interface Employee { id: string; name: string; role: string }

interface AttendanceLog {
  id: string
  clock_in: string
  clock_out: string | null
  total_minutes: number | null
  manual_entry: boolean
  note: string | null
  branches: { name: string } | null
}

interface AttendanceRow {
  id: string
  date: string
  dayOfWeek: number
  clockInIso: string
  clockOutIso: string | null
  in: string
  out: string | null
  h100: number  // minutes
  h125: number
  h150: number
  h200: number
  shabbat: number
  total: number
  note: string
  alert: boolean
  manual: boolean
  branchName: string
}

function formatTimeFromIso(iso: string) {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDateFromIso(iso: string) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatMinutes(mins: number): string {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

// Israeli labor law overtime: 7h base, 8th=125%, 9-10h=150%, >10h=200%
// Saturday: all = shabbat rate
function computeOvertime(totalMinutes: number, dayOfWeek: number) {
  if (dayOfWeek === 6) {
    return { h100: 0, h125: 0, h150: 0, h200: 0, shabbat: totalMinutes }
  }
  const base = 7 * 60
  const ot1End = 8 * 60   // 7-8h → 125%
  const ot2End = 10 * 60  // 8-10h → 150%

  const h100 = Math.min(totalMinutes, base)
  const h125 = Math.max(0, Math.min(totalMinutes - base, ot1End - base))
  const h150 = Math.max(0, Math.min(totalMinutes - ot1End, ot2End - ot1End))
  const h200 = Math.max(0, totalMinutes - ot2End)
  return { h100, h125, h150, h200, shabbat: 0 }
}

function buildRow(log: AttendanceLog): AttendanceRow {
  const d = new Date(log.clock_in)
  const totalMins = log.total_minutes ?? 0
  const isOpen = !log.clock_out
  const ot = computeOvertime(totalMins, d.getDay())
  const OPEN_THRESHOLD = 10 * 60

  return {
    id: log.id,
    date: formatDateFromIso(log.clock_in),
    dayOfWeek: d.getDay(),
    clockInIso: log.clock_in,
    clockOutIso: log.clock_out,
    in: formatTimeFromIso(log.clock_in),
    out: log.clock_out ? formatTimeFromIso(log.clock_out) : null,
    ...ot,
    total: totalMins,
    note: log.note ?? '',
    alert: isOpen && (Date.now() - d.getTime()) > OPEN_THRESHOLD * 60 * 1000,
    manual: log.manual_entry,
    branchName: log.branches?.name ?? '—',
  }
}

function currentMonthStr() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

export default function PayrollHoursPage() {
  const { user: me } = useAuth()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Manual entry modal
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ date: '', clockIn: '', clockOut: '', note: '' })
  const [manualSaving, setManualSaving] = useState(false)
  const [manualError, setManualError] = useState('')

  const isManager = me?.role === 'admin' || me?.role === 'shift_lead'

  // Load employees from DB
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmployees(data.map((u: { id: string; name: string; role: string }) => ({ id: u.id, name: u.name, role: u.role })))
          if (data.length > 0 && !selectedEmployeeId) {
            setSelectedEmployeeId(data[0].id)
          }
        }
      })
      .catch(() => {})
  }, [])

  const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId)

  const loadLogs = useCallback(() => {
    if (!selectedEmployeeId) return
    setLoading(true)
    setError('')
    fetch(`/api/attendance/logs?user_id=${selectedEmployeeId}&month=${monthStr}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRows(data.map(buildRow))
        } else {
          setError(data.error ?? 'שגיאה בטעינת נתונים')
        }
      })
      .catch(() => setError('שגיאת חיבור'))
      .finally(() => setLoading(false))
  }, [selectedEmployeeId, monthStr])

  useEffect(() => { loadLogs() }, [loadLogs])

  const alertCount = rows.filter(r => r.alert).length

  const totals = rows.reduce(
    (acc, r) => ({
      h100: acc.h100 + r.h100,
      h125: acc.h125 + r.h125,
      h150: acc.h150 + r.h150,
      h200: acc.h200 + r.h200,
      shabbat: acc.shabbat + r.shabbat,
      total: acc.total + r.total,
    }),
    { h100: 0, h125: 0, h150: 0, h200: 0, shabbat: 0, total: 0 }
  )

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!me?.id || !selectedEmployeeId) return
    setManualSaving(true)
    setManualError('')
    try {
      const clockIn = new Date(`${manualForm.date}T${manualForm.clockIn}`).toISOString()
      const clockOut = manualForm.clockOut ? new Date(`${manualForm.date}T${manualForm.clockOut}`).toISOString() : undefined

      // Use the first branch available - for manual entry we skip location check
      const branchRes = await fetch('/api/branches')
      const branches = await branchRes.json()
      const branchId = branches[0]?.id

      if (!branchId) { setManualError('לא נמצא סניף'); setManualSaving(false); return }

      const res = await fetch('/api/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedEmployeeId,
          branch_id: branchId,
          clock_in: clockIn,
          clock_out: clockOut,
          note: manualForm.note,
          manager_id: me.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setManualError(data.error ?? 'שגיאה'); setManualSaving(false); return }
      setShowManual(false)
      setManualForm({ date: '', clockIn: '', clockOut: '', note: '' })
      loadLogs()
    } catch {
      setManualError('שגיאת חיבור')
    }
    setManualSaving(false)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EAFF]">דוח שעות</h1>
          {selectedEmployee && (
            <div className="text-sm mt-0.5" style={{ color: '#00C4AA' }}>
              {selectedEmployee.name}
            </div>
          )}
          {alertCount > 0 && (
            <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>
              ⚠ {alertCount} רישום פתוח מעל 10 שעות
            </div>
          )}
        </div>
        {isManager && (
          <button onClick={() => setShowManual(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#00C4AA', color: '#0F1117' }}>
            + הוסף משמרת ידנית
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap p-4 rounded-xl"
        style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
        <div>
          <label className="block text-xs text-[#8B8FA8] mb-1">עובד</label>
          <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[#8B8FA8] mb-1">חודש</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[#8B8FA8] mb-1">שנה</label>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <div className="px-3 py-2 rounded-lg text-sm"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#00C4AA' }}>
            {selectedEmployee?.name ?? '—'} — {MONTHS[selectedMonth]} {selectedYear}
          </div>
          <button onClick={loadLogs}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#8B8FA8' }}>
            ↻
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}>{error}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #2A2D3E' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#12141F', borderBottom: '1px solid #2A2D3E' }}>
              {['תאריך', 'יום', 'סניף', 'כניסה', 'יציאה', '100%', '125%', '150%', '200%', 'שבת', 'סה״כ', 'הערה'].map(col => (
                <th key={col} className="px-3 py-3 text-right text-xs font-semibold text-[#8B8FA8] whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-sm text-[#4A4D5E]">טוען...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-sm text-[#4A4D5E]">אין רישומים לתקופה זו</td></tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id} style={{
                  borderBottom: i < rows.length - 1 ? '1px solid #2A2D3E' : 'none',
                  background: row.alert ? 'rgba(239,68,68,0.05)' : i % 2 === 0 ? '#1A1D27' : '#171A26',
                }}>
                  <td className="px-3 py-2.5 text-[#E8EAFF] font-numbers whitespace-nowrap">
                    {row.alert && <span className="inline-block w-2 h-2 rounded-full mr-1 -mt-0.5" style={{ background: '#EF4444' }} />}
                    {row.date}
                    {row.manual && <span className="mr-1 text-[10px] px-1 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>ידני</span>}
                  </td>
                  <td className="px-3 py-2.5 text-[#8B8FA8] whitespace-nowrap">יום {HEBREW_DAYS[row.dayOfWeek]}</td>
                  <td className="px-3 py-2.5 text-[#8B8FA8] whitespace-nowrap text-xs">{row.branchName}</td>
                  <td className="px-3 py-2.5 text-[#E8EAFF] font-numbers">{row.in}</td>
                  <td className="px-3 py-2.5 font-numbers" style={{ color: row.out ? '#E8EAFF' : '#EF4444' }}>
                    {row.out ?? '⚠ פתוח'}
                  </td>
                  {[row.h100, row.h125, row.h150, row.h200, row.shabbat].map((v, j) => (
                    <td key={j} className="px-3 py-2.5 font-numbers text-[#8B8FA8] text-center">{formatMinutes(v)}</td>
                  ))}
                  <td className="px-3 py-2.5 font-bold font-numbers" style={{ color: '#00C4AA' }}>{formatMinutes(row.total)}</td>
                  <td className="px-3 py-2.5 text-[#8B8FA8] max-w-[120px] truncate text-xs">{row.note || '—'}</td>
                </tr>
              ))
            )}
            {/* Totals row */}
            {rows.length > 0 && (
              <tr style={{ background: '#12141F', borderTop: '2px solid #2A2D3E' }}>
                <td colSpan={5} className="px-3 py-3 text-[#8B8FA8] font-semibold text-sm">סה״כ חודשי — {rows.length} משמרות</td>
                {[totals.h100, totals.h125, totals.h150, totals.h200, totals.shabbat].map((v, i) => (
                  <td key={i} className="px-3 py-3 font-bold font-numbers text-[#E8EAFF] text-center">{formatMinutes(v)}</td>
                ))}
                <td className="px-3 py-3 font-bold font-numbers text-lg" style={{ color: '#00C4AA' }}>{formatMinutes(totals.total)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Manual shift modal — managers only */}
      {showManual && isManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowManual(false)}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}
            onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#E8EAFF] mb-1">הוספת משמרת ידנית</h2>
            <p className="text-xs text-[#8B8FA8] mb-4">עבור: {selectedEmployee?.name ?? '—'}</p>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">תאריך</label>
                <input type="date" value={manualForm.date} required
                  onChange={e => setManualForm({ ...manualForm, date: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#8B8FA8] mb-1">שעת כניסה</label>
                  <input type="time" value={manualForm.clockIn} required
                    onChange={e => setManualForm({ ...manualForm, clockIn: e.target.value })}
                    className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                    style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }} />
                </div>
                <div>
                  <label className="block text-xs text-[#8B8FA8] mb-1">שעת יציאה</label>
                  <input type="time" value={manualForm.clockOut}
                    onChange={e => setManualForm({ ...manualForm, clockOut: e.target.value })}
                    className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                    style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">הערה</label>
                <input type="text" value={manualForm.note}
                  onChange={e => setManualForm({ ...manualForm, note: e.target.value })}
                  placeholder="הסבר לשינוי ידני..."
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }} />
              </div>
              {manualError && (
                <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}>{manualError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={manualSaving}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: manualSaving ? '#2A2D3E' : '#00C4AA', color: '#0F1117' }}>
                  {manualSaving ? 'שומר...' : 'שמור'}
                </button>
                <button type="button" onClick={() => setShowManual(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm"
                  style={{ background: '#2A2D3E', color: '#8B8FA8' }}>
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
