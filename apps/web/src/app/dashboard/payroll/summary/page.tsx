'use client'

import { useState } from 'react'

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

interface EmployeeSummary {
  id: string
  name: string
  role: string
  h100: number // minutes
  h125: number
  h150: number
  h175: number
  h200: number
  shabbat: number
  travelDays: number
  travelPerShift: number
  bonus: number
  vacationDays: number
  hourlyRate: number
  monthlyHealth: number
  totalSalary: number
}

const MOCK_SUMMARIES: EmployeeSummary[] = [
  {
    id: '1', name: 'דנה לוי', role: 'מנהלת',
    h100: 7 * 60 * 18, h125: 60 * 18, h150: 2 * 60, h175: 0, h200: 0, shabbat: 8 * 60,
    travelDays: 20, travelPerShift: 35,
    bonus: 200, vacationDays: 2,
    hourlyRate: 50, monthlyHealth: 150,
    totalSalary: 8540,
  },
  {
    id: '2', name: 'יוסי כהן', role: 'עובד',
    h100: 7 * 60 * 16, h125: 60 * 8, h150: 0, h175: 0, h200: 0, shabbat: 0,
    travelDays: 16, travelPerShift: 30,
    bonus: 0, vacationDays: 1,
    hourlyRate: 38, monthlyHealth: 100,
    totalSalary: 5680,
  },
  {
    id: '3', name: 'מירי שפירא', role: 'עובדת',
    h100: 7 * 60 * 17, h125: 60 * 12, h150: 60 * 3, h175: 0, h200: 0, shabbat: 8 * 60,
    travelDays: 18, travelPerShift: 25,
    bonus: 0, vacationDays: 0,
    hourlyRate: 40, monthlyHealth: 100,
    totalSalary: 6820,
  },
  {
    id: '4', name: 'אבי גולן', role: 'עובד',
    h100: 7 * 60 * 14, h125: 0, h150: 0, h175: 0, h200: 0, shabbat: 0,
    travelDays: 14, travelPerShift: 20,
    bonus: 0, vacationDays: 1,
    hourlyRate: 36, monthlyHealth: 100,
    totalSalary: 4120,
  },
]

function fmtH(minutes: number) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function fmtILS(n: number) {
  return `₪${n.toLocaleString('he-IL')}`
}

function calcTravel(days: number, perShift: number, max = 700) {
  return Math.min(days * perShift, max)
}

function calcVacation(vacDays: number, hourlyRate: number) {
  return vacDays * 7 * hourlyRate
}

export default function PayrollSummaryPage() {
  const [selectedMonth, setSelectedMonth] = useState(2)
  const [selectedYear, setSelectedYear] = useState(2026)

  const grandTotal = MOCK_SUMMARIES.reduce((s, e) => s + e.totalSalary, 0)

  function exportCSV() {
    const headers = ['עובד', 'תפקיד', '100%', '125%', '150%', '175%', '200%', 'שבת', 'נסיעות', 'בונוס', 'חופשה', 'בריאות', 'סה"כ']
    const rows = MOCK_SUMMARIES.map((e) => [
      e.name, e.role,
      fmtH(e.h100), fmtH(e.h125), fmtH(e.h150), fmtH(e.h175), fmtH(e.h200), fmtH(e.shabbat),
      calcTravel(e.travelDays, e.travelPerShift),
      e.bonus,
      calcVacation(e.vacationDays, e.hourlyRate),
      e.monthlyHealth,
      e.totalSalary,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll-${MONTHS[selectedMonth]}-${selectedYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EAFF]">סיכום שכר חודשי</h1>
          <p className="text-[#8B8FA8] text-sm mt-1">{MONTHS[selectedMonth]} {selectedYear}</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: '#1A1D27', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
          >
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: '#1A1D27', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
          >
            {[2025, 2026, 2027].map((y) => <option key={y}>{y}</option>)}
          </select>
          <button
            onClick={exportCSV}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            style={{ background: '#2A2D3E', color: '#E8EAFF' }}
          >
            ↓ ייצוא CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'סה"כ לתשלום', value: fmtILS(grandTotal), color: '#00C4AA' },
          { label: 'מספר עובדים', value: MOCK_SUMMARIES.length, color: '#E8EAFF' },
          { label: 'ממוצע לעובד', value: fmtILS(Math.round(grandTotal / MOCK_SUMMARIES.length)), color: '#E8EAFF' },
          { label: 'שעות נוספות', value: fmtH(MOCK_SUMMARIES.reduce((s, e) => s + e.h125 + e.h150 + e.h175 + e.h200, 0)), color: '#F59E0B' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl p-4" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
            <div className="text-xs text-[#8B8FA8] mb-1">{card.label}</div>
            <div className="text-xl font-bold font-numbers" style={{ color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Main table */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #2A2D3E' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: '#12141F', borderBottom: '1px solid #2A2D3E' }}>
              {['עובד', '100%', '125%', '150%', '175%', '200%', 'שבת', 'נסיעות', 'בונוס', 'חופשה', 'בריאות', 'סה"כ'].map((col) => (
                <th key={col} className="px-3 py-3 text-right text-xs font-semibold text-[#8B8FA8] whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_SUMMARIES.map((emp, i) => {
              const travel = calcTravel(emp.travelDays, emp.travelPerShift)
              const vacation = calcVacation(emp.vacationDays, emp.hourlyRate)
              return (
                <tr
                  key={emp.id}
                  style={{
                    background: i % 2 === 0 ? '#1A1D27' : '#171A26',
                    borderBottom: i < MOCK_SUMMARIES.length - 1 ? '1px solid #2A2D3E' : 'none',
                  }}
                >
                  <td className="px-3 py-3">
                    <div className="text-[#E8EAFF] font-medium">{emp.name}</div>
                    <div className="text-xs text-[#8B8FA8]">{emp.role} · ₪{emp.hourlyRate}/שעה</div>
                  </td>
                  {[emp.h100, emp.h125, emp.h150, emp.h175, emp.h200, emp.shabbat].map((v, j) => (
                    <td key={j} className="px-3 py-3 font-numbers text-center text-[#8B8FA8]">
                      {fmtH(v)}
                    </td>
                  ))}
                  <td className="px-3 py-3 font-numbers text-center text-[#E8EAFF]">
                    {fmtILS(travel)}
                    <div className="text-xs text-[#8B8FA8]">{emp.travelDays} משמרות</div>
                  </td>
                  <td className="px-3 py-3 font-numbers text-center" style={{ color: emp.bonus > 0 ? '#00C4AA' : '#4A4D5E' }}>
                    {emp.bonus > 0 ? fmtILS(emp.bonus) : '—'}
                  </td>
                  <td className="px-3 py-3 font-numbers text-center" style={{ color: vacation > 0 ? '#60A5FA' : '#4A4D5E' }}>
                    {vacation > 0 ? fmtILS(vacation) : '—'}
                  </td>
                  <td className="px-3 py-3 font-numbers text-center text-[#8B8FA8]">
                    {fmtILS(emp.monthlyHealth)}
                  </td>
                  <td className="px-3 py-3 font-numbers font-bold text-lg" style={{ color: '#00C4AA' }}>
                    {fmtILS(emp.totalSalary)}
                  </td>
                </tr>
              )
            })}

            {/* Grand total row */}
            <tr style={{ background: '#12141F', borderTop: '2px solid #2A2D3E' }}>
              <td className="px-3 py-3 font-bold text-[#E8EAFF]">סה"כ</td>
              <td colSpan={10} />
              <td className="px-3 py-3 font-bold font-numbers text-xl" style={{ color: '#00C4AA' }}>
                {fmtILS(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Per-employee breakdown cards */}
      <h2 className="text-[#E8EAFF] font-semibold mt-8 mb-4">פירוט לפי עובד</h2>
      <div className="grid gap-4">
        {MOCK_SUMMARIES.map((emp) => {
          const travel = calcTravel(emp.travelDays, emp.travelPerShift)
          const vacation = calcVacation(emp.vacationDays, emp.hourlyRate)
          const regularPay = (emp.h100 / 60) * emp.hourlyRate
          const overtimePay = (emp.h125 / 60) * emp.hourlyRate * 1.25
            + (emp.h150 / 60) * emp.hourlyRate * 1.5
            + (emp.h175 / 60) * emp.hourlyRate * 1.75
            + (emp.h200 / 60) * emp.hourlyRate * 2
          const shabbatPay = (emp.shabbat / 60) * emp.hourlyRate * 1.5
          return (
            <div
              key={emp.id}
              className="rounded-xl p-4"
              style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[#E8EAFF] font-semibold">{emp.name}</span>
                  <span className="text-xs text-[#8B8FA8] mr-2">{emp.role}</span>
                </div>
                <div className="font-bold font-numbers text-lg" style={{ color: '#00C4AA' }}>
                  {fmtILS(emp.totalSalary)}
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                {[
                  { label: 'שכר רגיל', value: fmtILS(Math.round(regularPay)) },
                  { label: 'שעות נוספות', value: fmtILS(Math.round(overtimePay)) },
                  { label: 'שבת', value: fmtILS(Math.round(shabbatPay)) },
                  { label: 'נסיעות', value: fmtILS(travel) },
                  { label: 'בריאות', value: fmtILS(emp.monthlyHealth) },
                  { label: 'בונוס + חופשה', value: fmtILS(emp.bonus + vacation) },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg p-2" style={{ background: '#0F1117' }}>
                    <div className="text-[#8B8FA8] mb-0.5">{item.label}</div>
                    <div className="font-numbers font-medium text-[#E8EAFF]">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
