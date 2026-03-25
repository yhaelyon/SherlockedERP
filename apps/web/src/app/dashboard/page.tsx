'use client'

import { useState, useEffect } from 'react'

type ActiveShift = {
  id: string
  user_id: string
  branch_id: string
  clock_in: string
  user_profiles: { full_name: string; role: string } | null
  branches: { name: string } | null
}

function formatElapsedShort(clockIn: string) {
  const secs = Math.floor((Date.now() - new Date(clockIn).getTime()) / 1000)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}ש' ${m}ד'`
  return `${m}ד'`
}

function formatClockInTime(iso: string) {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'מנהל',
  shift_lead: 'מנהל משמרת',
  manager: 'מנהל',
  staff: 'עובד',
}

export default function DashboardPage() {
  const [activeShifts, setActiveShifts] = useState<ActiveShift[]>([])
  const [shiftsLoading, setShiftsLoading] = useState(true)
  const [tick, setTick] = useState(0)

  // Re-render elapsed times every 30s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  function loadActiveShifts() {
    setShiftsLoading(true)
    fetch('/api/attendance/active-shifts')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setActiveShifts(data)
      })
      .catch(() => {})
      .finally(() => setShiftsLoading(false))
  }

  useEffect(() => { loadActiveShifts() }, [])

  // Group active shifts by branch
  const byBranch = activeShifts.reduce<Record<string, { branchName: string; shifts: ActiveShift[] }>>((acc, s) => {
    const key = s.branch_id
    if (!acc[key]) acc[key] = { branchName: s.branches?.name ?? '—', shifts: [] }
    acc[key].shifts.push(s)
    return acc
  }, {})

  const stats = [
    {
      label: 'הזמנות היום',
      value: '—',
      icon: '📅',
      color: '#4A9EFF',
      bg: 'rgba(74,158,255,0.08)',
    },
    {
      label: 'הכנסות היום',
      value: '—',
      icon: '💳',
      color: '#10B981',
      bg: 'rgba(16,185,129,0.08)',
    },
    {
      label: 'במשמרת עכשיו',
      value: activeShifts.length > 0 ? String(activeShifts.length) : '—',
      icon: '👥',
      color: '#00C4AA',
      bg: 'rgba(0,196,170,0.08)',
    },
    {
      label: 'חדרים פעילים',
      value: '—',
      icon: '🚪',
      color: '#8B5CF6',
      bg: 'rgba(139,92,246,0.08)',
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: '#E8EAFF' }}>
          לוח בקרה
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8B8FA8' }}>
          ברוך הבא למערכת Sherlocked ERP
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-5 flex items-center gap-4"
            style={{ backgroundColor: '#1A1D27', border: '1px solid #2E3150' }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: stat.bg }}
            >
              {stat.icon}
            </div>
            <div>
              <div className="text-2xl font-bold font-inter" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-sm mt-0.5" style={{ color: '#8B8FA8' }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Shifts + Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Active Shifts ── */}
        <div
          className="rounded-xl"
          style={{ backgroundColor: '#1A1D27', border: '1px solid #2E3150', overflow: 'hidden' }}
        >
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #2E3150' }}>
            <div>
              <h2 className="text-base font-semibold" style={{ color: '#E8EAFF' }}>
                עובדים במשמרת
              </h2>
              <p className="text-xs mt-0.5" style={{ color: '#555870' }}>
                כרגע בשטח
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeShifts.length > 0 && (
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-bold"
                  style={{ background: 'rgba(0,196,170,0.15)', color: '#00C4AA' }}
                >
                  {activeShifts.length} פעיל{activeShifts.length !== 1 ? 'ים' : ''}
                </span>
              )}
              <button
                onClick={loadActiveShifts}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ background: '#0F1117', color: '#555870' }}
              >
                ↻
              </button>
            </div>
          </div>

          <div style={{ minHeight: '80px' }}>
            {shiftsLoading ? (
              <div className="px-5 py-6 text-center text-sm" style={{ color: '#555870' }}>
                טוען...
              </div>
            ) : activeShifts.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm" style={{ color: '#555870' }}>
                אין עובדים במשמרת כרגע
              </div>
            ) : (
              Object.values(byBranch).map(({ branchName, shifts }) => (
                <div key={branchName}>
                  {/* Branch header */}
                  <div className="px-5 py-2 flex items-center gap-2" style={{ background: '#131520', borderBottom: '1px solid #2E3150' }}>
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#555870' }}>
                      📍 {branchName}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,196,170,0.08)', color: '#00C4AA' }}>
                      {shifts.length}
                    </span>
                  </div>
                  {shifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="px-5 py-3 flex items-center justify-between"
                      style={{ borderBottom: '1px solid #1E2035' }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: 'rgba(0,196,170,0.15)', color: '#00C4AA' }}
                        >
                          {(shift.user_profiles?.full_name ?? '?')[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium" style={{ color: '#E8EAFF' }}>
                            {shift.user_profiles?.full_name ?? '—'}
                          </div>
                          <div className="text-xs" style={{ color: '#555870' }}>
                            {ROLE_LABELS[shift.user_profiles?.role ?? ''] ?? shift.user_profiles?.role ?? ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono" style={{ color: '#E8EAFF' }}>
                          {/* tick causes re-render to update elapsed */}
                          {formatElapsedShort(shift.clock_in)}
                          {tick >= 0 ? '' : ''}
                        </div>
                        <div className="text-[10px]" style={{ color: '#555870' }}>
                          כניסה {formatClockInTime(shift.clock_in)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Placeholder sections */}
        <div className="flex flex-col gap-4">
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: '#1A1D27', border: '1px solid #2E3150' }}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#E8EAFF' }}>
              הזמנות קרובות
            </h2>
            <p className="text-sm" style={{ color: '#555870' }}>
              אין הזמנות להצגה כרגע
            </p>
          </div>

          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: '#1A1D27', border: '1px solid #2E3150' }}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#E8EAFF' }}>
              משימות פתוחות
            </h2>
            <p className="text-sm" style={{ color: '#555870' }}>
              אין משימות פתוחות כרגע
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
