'use client'

import { useState } from 'react'

const HEBREW_DAYS: Record<number, string> = {
  0: 'ראשון', 1: 'שני', 2: 'שלישי', 3: 'רביעי', 4: 'חמישי', 5: 'שישי', 6: 'שבת',
}

const EMPLOYEES = [
  { id: '1', name: 'דנה לוי' },
  { id: '2', name: 'יוסי כהן' },
  { id: '3', name: 'מירי שפירא' },
  { id: '4', name: 'אבי גולן' },
]

const MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

interface AttendanceRow {
  id: string
  date: string // DD/MM/YYYY
  dayOfWeek: number
  in: string
  out: string | null
  h100: string
  h125: string
  h150: string
  h175: string
  h200: string
  shabbat: string
  total: string
  note: string
  alert?: boolean // 10+ hours without clock-out
}

// Mock data
const MOCK_ROWS: AttendanceRow[] = [
  { id: '1', date: '01/03/2026', dayOfWeek: 0, in: '09:00', out: '17:15', h100: '7:00', h125: '1:15', h150: '', h175: '', h200: '', shabbat: '', total: '8:15', note: '' },
  { id: '2', date: '02/03/2026', dayOfWeek: 1, in: '08:50', out: '17:00', h100: '7:00', h125: '1:10', h150: '', h175: '', h200: '', shabbat: '', total: '8:10', note: '' },
  { id: '3', date: '03/03/2026', dayOfWeek: 2, in: '09:05', out: '20:10', h100: '7:00', h125: '1:00', h150: '3:05', h175: '', h200: '', shabbat: '', total: '11:05', note: 'אירוע מיוחד' },
  { id: '4', date: '06/03/2026', dayOfWeek: 5, in: '16:00', out: null, h100: '', h125: '', h150: '', h175: '', h200: '', shabbat: '', total: '', note: '', alert: true },
  { id: '5', date: '07/03/2026', dayOfWeek: 6, in: '10:00', out: '18:30', h100: '', h125: '', h150: '', h175: '', h200: '', shabbat: '8:30', total: '8:30', note: 'שבת' },
  { id: '6', date: '08/03/2026', dayOfWeek: 0, in: '09:00', out: '17:00', h100: '7:00', h125: '1:00', h150: '', h175: '', h200: '', shabbat: '', total: '8:00', note: '' },
  { id: '7', date: '10/03/2026', dayOfWeek: 2, in: '09:00', out: '23:30', h100: '7:00', h125: '1:00', h150: '2:00', h175: '3:30', h200: '', shabbat: '', total: '13:30', note: '' },
  { id: '8', date: '11/03/2026', dayOfWeek: 3, in: '09:00', out: '17:00', h100: '7:00', h125: '1:00', h150: '', h175: '', h200: '', shabbat: '', total: '8:00', note: '' },
  { id: '9', date: '12/03/2026', dayOfWeek: 4, in: '08:55', out: '16:50', h100: '7:00', h125: '0:55', h150: '', h175: '', h200: '', shabbat: '', total: '7:55', note: '' },
  { id: '10', date: '13/03/2026', dayOfWeek: 5, in: '09:02', out: '17:15', h100: '7:00', h125: '1:13', h150: '', h175: '', h200: '', shabbat: '', total: '8:13', note: '' },
]

const SHIFT_TYPES = ['בוקר', 'ערב', 'לילה', 'ידני']

export default function PayrollHoursPage() {
  const [selectedEmployee, setSelectedEmployee] = useState(EMPLOYEES[0].id)
  const [selectedMonth, setSelectedMonth] = useState(2) // March (0-indexed)
  const [selectedYear, setSelectedYear] = useState(2026)
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ date: '', type: 'בוקר', time: '', note: '' })
  const [rows] = useState<AttendanceRow[]>(MOCK_ROWS)

  const alertCount = rows.filter((r) => r.alert).length

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: POST /api/v1/attendance/manual
    setShowManual(false)
    setManualForm({ date: '', type: 'בוקר', time: '', note: '' })
  }

  const totals = rows.reduce(
    (acc, r) => ({
      h100: acc.h100 + parseHours(r.h100),
      h125: acc.h125 + parseHours(r.h125),
      h150: acc.h150 + parseHours(r.h150),
      h175: acc.h175 + parseHours(r.h175),
      h200: acc.h200 + parseHours(r.h200),
      shabbat: acc.shabbat + parseHours(r.shabbat),
      total: acc.total + parseHours(r.total),
    }),
    { h100: 0, h125: 0, h150: 0, h175: 0, h200: 0, shabbat: 0, total: 0 }
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EAFF]">דוח שעות</h1>
          {alertCount > 0 && (
            <div
              className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}
            >
              ⚠ {alertCount} רישום פתוח מעל 10 שעות
            </div>
          )}
        </div>

        <button
          onClick={() => setShowManual(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#00C4AA', color: '#0F1117' }}
        >
          + הוסף משמרת ידנית
        </button>
      </div>

      {/* Filters */}
      <div
        className="flex gap-3 mb-5 flex-wrap p-4 rounded-xl"
        style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}
      >
        <div>
          <label className="block text-xs text-[#8B8FA8] mb-1">עובד</label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
          >
            {EMPLOYEES.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[#8B8FA8] mb-1">חודש</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[#8B8FA8] mb-1">שנה</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <div
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#00C4AA' }}
          >
            {EMPLOYEES.find((e) => e.id === selectedEmployee)?.name} — {MONTHS[selectedMonth]} {selectedYear}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #2A2D3E' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#12141F', borderBottom: '1px solid #2A2D3E' }}>
              {['תאריך', 'יום', 'כניסה', 'יציאה', '100%', '125%', '150%', '175%', '200%', 'שבת', 'סה״כ', 'הערה', 'פעולות'].map((col) => (
                <th
                  key={col}
                  className="px-3 py-3 text-right text-xs font-semibold text-[#8B8FA8] whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                style={{
                  borderBottom: i < rows.length - 1 ? '1px solid #2A2D3E' : 'none',
                  background: row.alert ? 'rgba(239,68,68,0.05)' : i % 2 === 0 ? '#1A1D27' : '#171A26',
                }}
              >
                <td className="px-3 py-2.5 text-[#E8EAFF] font-numbers whitespace-nowrap">
                  {row.alert && (
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1 -mt-0.5"
                      style={{ background: '#EF4444' }}
                    />
                  )}
                  {row.date}
                </td>
                <td className="px-3 py-2.5 text-[#8B8FA8] whitespace-nowrap">
                  יום {HEBREW_DAYS[row.dayOfWeek]}
                </td>
                <td className="px-3 py-2.5 text-[#E8EAFF] font-numbers">{row.in}</td>
                <td className="px-3 py-2.5 font-numbers" style={{ color: row.out ? '#E8EAFF' : '#EF4444' }}>
                  {row.out ?? '⚠ פתוח'}
                </td>
                {[row.h100, row.h125, row.h150, row.h175, row.h200, row.shabbat].map((v, j) => (
                  <td key={j} className="px-3 py-2.5 font-numbers text-[#8B8FA8] text-center">
                    {v || '—'}
                  </td>
                ))}
                <td className="px-3 py-2.5 font-bold font-numbers" style={{ color: '#00C4AA' }}>
                  {row.total || '—'}
                </td>
                <td className="px-3 py-2.5 text-[#8B8FA8] max-w-[120px] truncate">
                  {row.note || '—'}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: '#2A2D3E', color: '#8B8FA8' }}
                  >
                    ✏ עריכה
                  </button>
                </td>
              </tr>
            ))}

            {/* Totals row */}
            <tr style={{ background: '#12141F', borderTop: '2px solid #2A2D3E' }}>
              <td colSpan={4} className="px-3 py-3 text-[#8B8FA8] font-semibold text-sm">
                סה״כ חודשי
              </td>
              {[totals.h100, totals.h125, totals.h150, totals.h175, totals.h200, totals.shabbat].map((v, i) => (
                <td key={i} className="px-3 py-3 font-bold font-numbers text-[#E8EAFF] text-center">
                  {formatHours(v)}
                </td>
              ))}
              <td className="px-3 py-3 font-bold font-numbers text-lg" style={{ color: '#00C4AA' }}>
                {formatHours(totals.total)}
              </td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Manual shift modal */}
      {showManual && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowManual(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[#E8EAFF] mb-4">הוספת משמרת ידנית</h2>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">תאריך</label>
                <input
                  type="date"
                  value={manualForm.date}
                  onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  required
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                />
              </div>
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">סוג</label>
                <select
                  value={manualForm.type}
                  onChange={(e) => setManualForm({ ...manualForm, type: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                >
                  {SHIFT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">שעה</label>
                <input
                  type="time"
                  value={manualForm.time}
                  onChange={(e) => setManualForm({ ...manualForm, time: e.target.value })}
                  required
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                />
              </div>
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">הערה</label>
                <input
                  type="text"
                  value={manualForm.note}
                  onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
                  placeholder="הסבר לשינוי ידני..."
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: '#00C4AA', color: '#0F1117' }}
                >
                  שמור
                </button>
                <button
                  type="button"
                  onClick={() => setShowManual(false)}
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

function parseHours(str: string): number {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function formatHours(minutes: number): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}
