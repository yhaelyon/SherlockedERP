'use client'

import { useState } from 'react'

interface Holiday {
  id: string
  name: string
  date: string
  type: 'חג' | 'ערב חג' | 'שינוי שעון'
  rate: number // percent, e.g. 150, 200
  notes: string
}

const INITIAL_HOLIDAYS: Holiday[] = [
  { id: '1', name: 'ערב ראש השנה', date: '22/09/2025', type: 'ערב חג', rate: 150, notes: '' },
  { id: '2', name: 'ראש השנה (א׳)', date: '23/09/2025', type: 'חג', rate: 200, notes: '' },
  { id: '3', name: 'ראש השנה (ב׳)', date: '24/09/2025', type: 'חג', rate: 200, notes: '' },
  { id: '4', name: 'ערב יום כיפור', date: '01/10/2025', type: 'ערב חג', rate: 150, notes: '' },
  { id: '5', name: 'יום כיפור', date: '02/10/2025', type: 'חג', rate: 200, notes: '' },
  { id: '6', name: 'סוכות (א׳)', date: '07/10/2025', type: 'חג', rate: 200, notes: '' },
  { id: '7', name: 'חול המועד סוכות', date: '08-13/10/2025', type: 'חג', rate: 150, notes: '' },
  { id: '8', name: 'שמחת תורה / שמיני עצרת', date: '14/10/2025', type: 'חג', rate: 200, notes: '' },
  { id: '9', name: 'חנוכה', date: '25/12/2025', type: 'חג', rate: 150, notes: '8 ימים' },
  { id: '10', name: 'שינוי שעון (חורף)', date: '26/10/2025', type: 'שינוי שעון', rate: 100, notes: 'שעה אחת לאחור' },
  { id: '11', name: 'פורים', date: '13/03/2026', type: 'חג', rate: 150, notes: '' },
  { id: '12', name: 'ערב פסח', date: '01/04/2026', type: 'ערב חג', rate: 150, notes: '' },
  { id: '13', name: 'פסח (א׳)', date: '02/04/2026', type: 'חג', rate: 200, notes: '' },
  { id: '14', name: 'חול המועד פסח', date: '03-07/04/2026', type: 'חג', rate: 150, notes: '' },
  { id: '15', name: 'פסח (ז׳)', date: '08/04/2026', type: 'חג', rate: 200, notes: '' },
  { id: '16', name: 'יום העצמאות', date: '29/04/2026', type: 'חג', rate: 150, notes: '' },
  { id: '17', name: 'שבועות', date: '21/05/2026', type: 'חג', rate: 200, notes: '' },
  { id: '18', name: 'שינוי שעון (קיץ)', date: '27/03/2026', type: 'שינוי שעון', rate: 100, notes: 'שעה אחת קדימה' },
]

const RATE_COLORS: Record<number, { bg: string; text: string }> = {
  100: { bg: '#2A2D3E', text: '#8B8FA8' },
  150: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  200: { bg: 'rgba(239,68,68,0.15)', text: '#F87171' },
}

const TYPE_COLORS: Record<string, string> = {
  'חג': '#A78BFA',
  'ערב חג': '#60A5FA',
  'שינוי שעון': '#8B8FA8',
}

export default function PayrollHolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>(INITIAL_HOLIDAYS)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<Omit<Holiday, 'id'>>({ name: '', date: '', type: 'חג', rate: 200, notes: '' })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setHolidays((prev) => [...prev, { id: String(Date.now()), ...addForm }])
    setShowAdd(false)
    setAddForm({ name: '', date: '', type: 'חג', rate: 200, notes: '' })
  }

  function deleteHoliday(id: string) {
    setHolidays((prev) => prev.filter((h) => h.id !== id))
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EAFF]">חגים ומועדים</h1>
          <p className="text-[#8B8FA8] text-sm mt-1">ימי חג ישראליים 2025–2026 ואחוזי תגמול</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#00C4AA', color: '#0F1117' }}
        >
          + הוסף חג
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {[
          { label: '200% — חג', ...RATE_COLORS[200] },
          { label: '150% — ערב חג / חול המועד', ...RATE_COLORS[150] },
          { label: '100% — רגיל', ...RATE_COLORS[100] },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
            style={{ background: item.bg, color: item.text }}
          >
            <span className="font-bold">●</span> {item.label}
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2A2D3E' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#12141F', borderBottom: '1px solid #2A2D3E' }}>
              {['חג / מועד', 'תאריך', 'סוג', 'אחוז תגמול', 'הערות', ''].map((col) => (
                <th key={col} className="px-4 py-3 text-right text-xs font-semibold text-[#8B8FA8]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holidays.map((h, i) => {
              const rateColor = RATE_COLORS[h.rate] ?? RATE_COLORS[100]
              return (
                <tr
                  key={h.id}
                  style={{
                    background: i % 2 === 0 ? '#1A1D27' : '#171A26',
                    borderBottom: i < holidays.length - 1 ? '1px solid #2A2D3E' : 'none',
                  }}
                >
                  <td className="px-4 py-3 text-[#E8EAFF] font-medium">{h.name}</td>
                  <td className="px-4 py-3 font-numbers text-[#8B8FA8]">{h.date}</td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: `${TYPE_COLORS[h.type]}22`, color: TYPE_COLORS[h.type] }}
                    >
                      {h.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold font-numbers"
                      style={{ background: rateColor.bg, color: rateColor.text }}
                    >
                      {h.rate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#8B8FA8] text-xs">{h.notes || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteHoliday(h.id)}
                      className="text-xs px-2 py-1 rounded opacity-50 hover:opacity-100"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add holiday modal */}
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
            <h2 className="text-lg font-bold text-[#E8EAFF] mb-4">הוספת חג / מועד</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">שם</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  required
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                />
              </div>
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">תאריך</label>
                <input
                  type="text"
                  value={addForm.date}
                  onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                  placeholder="DD/MM/YYYY"
                  required
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm font-numbers"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                />
              </div>
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">סוג</label>
                <select
                  value={addForm.type}
                  onChange={(e) => setAddForm({ ...addForm, type: e.target.value as Holiday['type'] })}
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                >
                  <option>חג</option>
                  <option>ערב חג</option>
                  <option>שינוי שעון</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">אחוז תגמול</label>
                <select
                  value={addForm.rate}
                  onChange={(e) => setAddForm({ ...addForm, rate: Number(e.target.value) })}
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm font-numbers"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                >
                  <option value={100}>100%</option>
                  <option value={150}>150%</option>
                  <option value={200}>200%</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">הערות</label>
                <input
                  type="text"
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: '#00C4AA', color: '#0F1117' }}>שמור</button>
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl text-sm" style={{ background: '#2A2D3E', color: '#8B8FA8' }}>ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
