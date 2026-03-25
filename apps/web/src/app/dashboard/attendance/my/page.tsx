'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth'

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

function formatTime(date: Date) {
  return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatLogTime(d: Date) {
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatMinutes(mins: number | null) {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}ש' ${m}ד'` : `${m}ד'`
}

function currentMonthStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

type Status = 'out' | 'in'
type Branch = { id: string; name: string }
type GeoResult = { ok: true; lat: number; lng: number } | { ok: false; denied: boolean }

type LogEntry = {
  id: number
  ts: Date
  tag: 'כניסה' | 'יציאה' | 'GPS' | 'IP' | 'שגיאה' | 'מיקום-בדיקה'
  ok: boolean
  branch: string
  lines: string[]
}

type AttendanceRecord = {
  id: string
  branch_id: string
  clock_in: string
  clock_out: string | null
  total_minutes: number | null
  manual_entry: boolean
  note: string | null
  branches: { name: string } | null
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function requestGeolocation(): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ ok: false, denied: false })
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => resolve({ ok: false, denied: err.code === 1 }),
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    )
  })
}

let logIdCounter = 0

function LocationPermissionBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: '#1A1D27', border: '1px solid #F59E0B66' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">📍</span>
          <div>
            <div className="font-bold text-[#E8EAFF]">נדרשת הרשאת מיקום</div>
            <div className="text-xs text-[#8B8FA8] mt-0.5">המערכת צריכה גישה למיקומך לאימות נוכחות</div>
          </div>
        </div>
        <div className="rounded-xl p-4 mb-4" style={{ background: '#0F1117', border: '1px solid #2A2D3E' }}>
          <div className="font-semibold text-[#E8EAFF] mb-2 text-sm">כיצד להפעיל מיקום בכרום:</div>
          <ol className="space-y-1.5 text-[#8B8FA8] text-xs list-decimal list-inside">
            <li>לחץ על סמל המנעול <span className="font-mono bg-[#1A1D27] px-1 rounded">🔒</span> בשורת הכתובת</li>
            <li>בחר <strong className="text-[#E8EAFF]">&quot;הגדרות אתר&quot;</strong></li>
            <li>מצא <strong className="text-[#E8EAFF]">&quot;מיקום&quot;</strong> → שנה ל-<strong className="text-[#00C4AA]">&quot;אפשר&quot;</strong></li>
            <li>רענן את הדף ונסה שוב</li>
          </ol>
        </div>
        <div className="text-xs text-[#8B8FA8] mb-4 text-center">
          לחלופין — הפעל <strong className="text-[#F59E0B]">מצב בדיקה (עקוף מיקום)</strong>
        </div>
        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-xl font-bold text-sm"
          style={{ background: '#F59E0B', color: '#0F1117' }}
        >
          הבנתי
        </button>
      </div>
    </div>
  )
}

// ── Edit Modal (managers/shift_lead only) ────────────────────────────────────
function EditModal({
  record,
  managerId,
  onSave,
  onClose,
}: {
  record: AttendanceRecord
  managerId: string
  onSave: (updated: AttendanceRecord) => void
  onClose: () => void
}) {
  function toLocalInput(iso: string) {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [clockIn, setClockIn] = useState(toLocalInput(record.clock_in))
  const [clockOut, setClockOut] = useState(record.clock_out ? toLocalInput(record.clock_out) : '')
  const [note, setNote] = useState(record.note ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    setSaving(true)
    setErr('')
    try {
      const body: Record<string, unknown> = {
        manager_id: managerId,
        note,
        clock_in: new Date(clockIn).toISOString(),
      }
      if (clockOut) body.clock_out = new Date(clockOut).toISOString()

      const res = await fetch(`/api/attendance/logs/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'שגיאה'); setSaving(false); return }
      onSave(data)
    } catch {
      setErr('שגיאת חיבור')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-[#E8EAFF]">עריכת רישום נוכחות</h3>
          <button onClick={onClose} className="text-[#4A4D5E] hover:text-[#8B8FA8] text-xl leading-none">✕</button>
        </div>

        <div className="text-xs text-[#8B8FA8] mb-1">סניף</div>
        <div className="text-sm text-[#E8EAFF] mb-4">{record.branches?.name ?? '—'}</div>

        <div className="mb-3">
          <div className="text-xs text-[#8B8FA8] mb-1">שעת כניסה</div>
          <input
            type="datetime-local"
            value={clockIn}
            onChange={e => setClockIn(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
          />
        </div>

        <div className="mb-3">
          <div className="text-xs text-[#8B8FA8] mb-1">שעת יציאה (ריק = משמרת פתוחה)</div>
          <input
            type="datetime-local"
            value={clockOut}
            onChange={e => setClockOut(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
          />
        </div>

        <div className="mb-4">
          <div className="text-xs text-[#8B8FA8] mb-1">הערה</div>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="הערה אופציונלית..."
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
          />
        </div>

        {err && (
          <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}>{err}</div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#8B8FA8' }}
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: saving ? '#2A2D3E' : '#818CF8', color: '#fff' }}
          >
            {saving ? 'שומר...' : 'שמור שינויים'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AttendanceMyPage() {
  const { user } = useAuth()
  const [now, setNow] = useState(new Date())
  const [status, setStatus] = useState<Status>('out')
  const [clockInTime, setClockInTime] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [bypassLocation, setBypassLocation] = useState(false)
  const [showLocationBanner, setShowLocationBanner] = useState(false)

  // History
  const [historyMonth, setHistoryMonth] = useState(currentMonthStr())
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null)

  // Debug log
  const [log, setLog] = useState<LogEntry[]>([])
  const logRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  // IP test
  const [currentIp, setCurrentIp] = useState<string>('')
  const [testIpInput, setTestIpInput] = useState('')
  const [ipTesting, setIpTesting] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const canEdit = user?.role === 'admin' || user?.role === 'shift_lead'

  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'ts'>) => {
    setLog((prev) => [{ ...entry, id: ++logIdCounter, ts: new Date() }, ...prev])
  }, [])

  // ── Fetch current IP on mount ───────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/attendance/check-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'my_ip' }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.client_ip) setCurrentIp(d.client_ip) })
      .catch(() => {})
  }, [])

  // ── Restore active shift state on mount ─────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return

    fetch(`/api/attendance/active?user_id=${user.id}`)
      .then(r => r.json())
      .then(({ active }) => {
        if (active) {
          setStatus('in')
          setClockInTime(new Date(active.clock_in))
          // Auto-select the branch from the active shift
          if (active.branches) {
            setSelectedBranch({ id: active.branch_id, name: active.branches.name })
          }
        }
      })
      .catch(() => {})
  }, [user?.id])

  const [branchesError, setBranchesError] = useState('')

  function loadBranches() {
    setBranchesError('')
    fetch('/api/branches')
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setBranchesError(data?.error ? `שגיאה: ${data.error}` : 'לא ניתן לטעון סניפים')
          return
        }
        setBranches(data)
      })
      .catch(() => setBranchesError('לא ניתן להתחבר — בדוק חיבור'))
  }

  useEffect(() => { loadBranches() }, [])

  // ── Clock tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Elapsed timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'in' && clockInTime) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - clockInTime.getTime()) / 1000))
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setElapsed(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status, clockInTime])

  // ── Load history ─────────────────────────────────────────────────────────────
  const loadHistory = useCallback(() => {
    if (!user?.id) return
    setHistoryLoading(true)
    fetch(`/api/attendance/logs?user_id=${user.id}&month=${historyMonth}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setHistoryRecords(data)
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [user?.id, historyMonth])

  useEffect(() => { loadHistory() }, [loadHistory])

  const hebrewDay = HEBREW_DAYS[now.getDay()]
  const hebrewDate = `יום ${hebrewDay}, ${now.getDate()} ב${HEBREW_MONTHS[now.getMonth()]} ${now.getFullYear()}`

  // ── Clock in / Clock out ────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!selectedBranch) { setError('יש לבחור סניף'); return }

    setError('')
    setSuccessMsg('')
    setLoading(true)
    setLoadingMsg('מבדק מיקום...')

    const geoResult = await requestGeolocation()

    if (!bypassLocation && !geoResult.ok && geoResult.denied) {
      setShowLocationBanner(true)
      addLog({ tag: 'שגיאה', ok: false, branch: selectedBranch.name, lines: ['הרשאת מיקום נדחתה בדפדפן'] })
      setLoadingMsg(''); setLoading(false); return
    }

    const coords = geoResult.ok ? { lat: geoResult.lat, lng: geoResult.lng } : undefined

    setLoadingMsg('מעבד...')
    const endpoint = status === 'out' ? '/api/attendance/clock-in' : '/api/attendance/clock-out'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          branch_id: selectedBranch.id,
          lat: coords?.lat,
          lng: coords?.lng,
          bypass_location: bypassLocation,
        }),
      })

      const data = await res.json()
      const action = status === 'out' ? 'כניסה' : 'יציאה'

      const checksLines: string[] = Array.isArray(data.checks)
        ? data.checks.map((c: { step: string; result: string }) => `[${c.step}] ${c.result}`)
        : []

      if (!res.ok) {
        setError(data.error ?? 'שגיאה בלתי צפויה')
        addLog({
          tag: 'שגיאה',
          ok: false,
          branch: selectedBranch.name,
          lines: [
            `פעולה: ${action}`,
            coords ? `GPS שלך: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : 'GPS: לא זמין',
            `IP: ${currentIp || 'לא זוהה'}`,
            ...checksLines,
            `❌ ${data.error ?? 'שגיאה לא ידועה'}`,
          ],
        })
      } else {
        const method: string = data.verification_method ?? (bypassLocation ? 'bypass' : 'unknown')
        const methodLabel = method === 'gps' ? 'GPS' : method === 'ip' ? 'IP' : 'bypass'
        addLog({
          tag: action,
          ok: true,
          branch: selectedBranch.name,
          lines: [
            coords ? `GPS שלך: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : 'GPS: לא זמין',
            `IP: ${currentIp || 'לא זוהה'}`,
            ...checksLines,
            `✅ אומת לפי: ${methodLabel}`,
          ],
        })
        if (status === 'out') {
          setStatus('in'); setClockInTime(new Date())
          setSuccessMsg(`נרשמה כניסה למשמרת ✓ (${methodLabel})`)
        } else {
          setStatus('out'); setClockInTime(null)
          setSuccessMsg(`נרשמה יציאה ממשמרת ✓ (${methodLabel})`)
          loadHistory()
        }
      }
    } catch {
      setError('לא ניתן להתחבר לשרת')
      addLog({ tag: 'שגיאה', ok: false, branch: selectedBranch?.name ?? '?', lines: ['fetch failed — לא ניתן להתחבר לשרת'] })
    }

    setLoadingMsg(''); setLoading(false)
  }

  async function handleIpTest() {
    if (!selectedBranch) {
      addLog({ tag: 'שגיאה', ok: false, branch: '—', lines: ['יש לבחור סניף'] })
      return
    }
    setIpTesting(true)
    const ipToTest = testIpInput.trim() || undefined

    try {
      const res = await fetch('/api/attendance/check-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'ip', branch_id: selectedBranch.id, test_ip: ipToTest }),
      })
      const data = await res.json()

      addLog({
        tag: 'IP',
        ok: data.allowed ?? false,
        branch: selectedBranch.name,
        lines: [
          `IP שנבדק: ${data.tested_ip ?? currentIp ?? 'לא זוהה'}`,
          `IP מוגדר בסניף: ${data.branch_ip ?? 'לא הוגדר'}`,
          `IP נוכחי (שרת): ${data.client_ip ?? 'לא זוהה'}`,
          data.allowed ? '✅ IP תואם — מותר' : '❌ IP לא תואם — נדחה',
        ],
      })
    } catch {
      addLog({ tag: 'שגיאה', ok: false, branch: selectedBranch.name, lines: ['בדיקת IP נכשלה — fetch error'] })
    }

    setIpTesting(false)
  }

  async function handleGpsTest() {
    const branchForTest = selectedBranch

    const geoResult = await requestGeolocation()
    if (!geoResult.ok && geoResult.denied) {
      setShowLocationBanner(true)
      addLog({ tag: 'שגיאה', ok: false, branch: branchForTest?.name ?? '?', lines: ['הרשאת מיקום נדחתה'] })
      return
    }
    const coords = geoResult.ok ? { lat: geoResult.lat, lng: geoResult.lng } : undefined

    if (!branchForTest) {
      addLog({ tag: 'שגיאה', ok: false, branch: '—', lines: ['יש לבחור סניף'] })
      return
    }

    const body: Record<string, unknown> = { mode: 'gps', branch_id: branchForTest.id }
    if (coords) { body.lat = coords.lat; body.lng = coords.lng }

    try {
      const res = await fetch('/api/attendance/check-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      addLog({
        tag: 'GPS',
        ok: data.allowed ?? false,
        branch: branchForTest.name,
        lines: [
          coords ? `GPS שלך: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : 'GPS: לא זמין',
          data.target_coords ? `מטרה: ${(data.target_coords.lat as number).toFixed(6)}, ${(data.target_coords.lng as number).toFixed(6)}` : '',
          data.distance_meters !== undefined ? `מרחק: ${data.distance_meters}מ' (מותר: ${data.radius_meters}מ')` : '',
          `IP נוכחי: ${data.client_ip ?? currentIp ?? 'לא זוהה'}`,
          data.error ? `שגיאה: ${data.error}` : '',
          data.allowed ? '✅ מיקום תקין' : '❌ מיקום מחוץ לתחום',
        ].filter(Boolean),
      })
    } catch {
      addLog({ tag: 'שגיאה', ok: false, branch: branchForTest.name, lines: ['בדיקת GPS נכשלה — fetch error'] })
    }
  }

  function copyLog() {
    const text = log
      .map((e) => `[${formatLogTime(e.ts)}] [${e.tag}] ${e.ok ? '✅' : '❌'} ${e.branch}\n${e.lines.map((l) => '  ' + l).join('\n')}`)
      .join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // History month navigation
  function prevMonth() {
    const [y, m] = historyMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setHistoryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function nextMonth() {
    const [y, m] = historyMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setHistoryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const historyTotalMinutes = historyRecords
    .filter(r => r.clock_out != null)
    .reduce((sum, r) => sum + (r.total_minutes ?? 0), 0)

  const tagColors: Record<string, { bg: string; color: string }> = {
    כניסה: { bg: 'rgba(0,196,170,0.15)', color: '#00C4AA' },
    יציאה: { bg: 'rgba(234,88,12,0.15)', color: '#FB923C' },
    GPS: { bg: 'rgba(129,140,248,0.15)', color: '#818CF8' },
    IP: { bg: 'rgba(129,140,248,0.15)', color: '#818CF8' },
    שגיאה: { bg: 'rgba(239,68,68,0.15)', color: '#F87171' },
    'מיקום-בדיקה': { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      {showLocationBanner && <LocationPermissionBanner onDismiss={() => setShowLocationBanner(false)} />}
      {editRecord && user && (
        <EditModal
          record={editRecord}
          managerId={user.id}
          onSave={(updated) => {
            setHistoryRecords(prev => prev.map(r => r.id === updated.id ? updated : r))
            setEditRecord(null)
          }}
          onClose={() => setEditRecord(null)}
        />
      )}

      <h1 className="text-2xl font-bold text-[#E8EAFF] mb-1">דיווח נוכחות</h1>
      <p className="text-[#8B8FA8] mb-6 text-sm">{hebrewDate}</p>

      {/* ── Clock ── */}
      <div className="rounded-2xl p-8 mb-5 flex flex-col items-center" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
        <div className="text-6xl font-bold font-numbers text-[#E8EAFF] mb-2 tabular-nums">{formatTime(now)}</div>
        <div className="text-[#8B8FA8] text-sm">{hebrewDate}</div>
        {status === 'in' && clockInTime && (
          <div className="mt-6 flex flex-col items-center">
            <div className="text-xs text-[#8B8FA8] mb-1">זמן במשמרת</div>
            <div className="text-3xl font-bold font-numbers tabular-nums px-6 py-2 rounded-xl" style={{ background: '#0F1117', color: '#00C4AA' }}>
              {formatElapsed(elapsed)}
            </div>
            <div className="text-xs text-[#8B8FA8] mt-2">כניסה: {formatTime(clockInTime)}</div>
            {selectedBranch && (
              <div className="text-xs mt-1 px-3 py-1 rounded-full" style={{ background: 'rgba(0,196,170,0.1)', color: '#00C4AA' }}>
                {selectedBranch.name}
              </div>
            )}
          </div>
        )}
        <div
          className="mt-4 px-4 py-1 rounded-full text-sm font-medium"
          style={{ background: status === 'in' ? 'rgba(0,196,170,0.15)' : 'rgba(139,143,168,0.15)', color: status === 'in' ? '#00C4AA' : '#8B8FA8' }}
        >
          {status === 'in' ? '● במשמרת' : '○ לא במשמרת'}
        </div>
      </div>

      {/* ── Action card ── */}
      <div className="rounded-2xl p-6 mb-5" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
        {branches.length === 0 && !branchesError && <div className="mb-4 text-center text-sm text-[#8B8FA8]">טוען סניפים...</div>}
        {branchesError && (
          <div className="mb-4 px-3 py-2 rounded-lg flex items-center justify-between" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}>
            <span className="text-xs">{branchesError}</span>
            <button onClick={loadBranches} className="text-xs px-2 py-1 rounded-lg mr-2" style={{ background: 'rgba(239,68,68,0.2)', color: '#F87171' }}>נסה שוב</button>
          </div>
        )}
        {branches.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-[#8B8FA8] mb-2 text-right">בחר סניף</div>
            <div className="flex gap-2 flex-wrap">
              {branches.map((b) => {
                const isSel = selectedBranch?.id === b.id
                return (
                  <button
                    key={b.id}
                    onClick={() => { if (status === 'out') setSelectedBranch(b) }}
                    disabled={status === 'in'}
                    className="flex-1 py-3 rounded-xl text-sm font-bold transition-all min-w-[80px]"
                    style={{
                      background: isSel ? 'rgba(0,196,170,0.15)' : '#0F1117',
                      border: `1px solid ${isSel ? '#00C4AA' : '#2A2D3E'}`,
                      color: isSel ? '#00C4AA' : '#8B8FA8',
                      cursor: status === 'in' ? 'default' : 'pointer',
                      opacity: status === 'in' && !isSel ? 0.4 : 1,
                    }}
                  >
                    {b.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}>{error}</div>
        )}
        {successMsg && (
          <div className="text-sm mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,196,170,0.1)', color: '#00C4AA' }}>{successMsg}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-5 rounded-xl text-lg font-bold transition-all"
          style={{
            background: loading ? '#2A2D3E' : status === 'out' ? '#16A34A' : '#EA580C',
            color: loading ? '#4A4D5E' : '#FFFFFF',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (loadingMsg || 'מעבד...') : status === 'out' ? 'כניסה למשמרת' : 'יציאה ממשמרת'}
        </button>

        <p className="text-center text-xs text-[#8B8FA8] mt-3">
          {status === 'out' ? 'המערכת תאמת מיקום GPS ← IP לפי הסדר' : 'המערכת תאמת מיקומך לרישום יציאה'}
        </p>

        <div className="flex items-center justify-center gap-2 mt-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setBypassLocation((v) => !v)}
              className="w-8 h-4 rounded-full relative transition-colors"
              style={{ background: bypassLocation ? '#F59E0B' : '#2A2D3E' }}
            >
              <div className="absolute top-0.5 w-3 h-3 rounded-full transition-transform" style={{ background: '#fff', transform: bypassLocation ? 'translateX(17px)' : 'translateX(2px)' }} />
            </div>
            <span className="text-xs" style={{ color: bypassLocation ? '#F59E0B' : '#4A4D5E' }}>
              מצב בדיקה (עקוף מיקום)
            </span>
          </label>
        </div>
      </div>

      {/* ── Attendance History ── */}
      <div className="rounded-2xl overflow-hidden mb-5" style={{ border: '1px solid #2A2D3E' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#1A1D27', borderBottom: '1px solid #2A2D3E' }}>
          <h2 className="text-[#E8EAFF] font-semibold text-sm">היסטוריית נוכחות</h2>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-6 h-6 rounded-lg text-xs flex items-center justify-center" style={{ background: '#0F1117', color: '#8B8FA8' }}>‹</button>
            <span className="text-xs text-[#8B8FA8] min-w-[70px] text-center">{historyMonth}</span>
            <button onClick={nextMonth} className="w-6 h-6 rounded-lg text-xs flex items-center justify-center" style={{ background: '#0F1117', color: '#8B8FA8' }}>›</button>
            <button onClick={loadHistory} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#0F1117', color: '#4A4D5E' }}>↻</button>
          </div>
        </div>

        {/* Month summary */}
        {historyRecords.length > 0 && (
          <div className="px-4 py-2 flex items-center gap-4 text-xs" style={{ background: '#13151E', borderBottom: '1px solid #2A2D3E' }}>
            <span style={{ color: '#8B8FA8' }}>סה״כ: <strong style={{ color: '#E8EAFF' }}>{historyRecords.filter(r => r.clock_out).length} משמרות</strong></span>
            <span style={{ color: '#8B8FA8' }}>שעות: <strong style={{ color: '#00C4AA' }}>{formatMinutes(historyTotalMinutes)}</strong></span>
          </div>
        )}

        <div style={{ background: '#0F1117' }}>
          {historyLoading ? (
            <div className="px-4 py-6 text-center text-xs text-[#4A4D5E]">טוען...</div>
          ) : historyRecords.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[#4A4D5E]">אין רישומים לחודש זה</div>
          ) : (
            historyRecords.map((rec) => (
              <div key={rec.id} className="px-4 py-3" style={{ borderBottom: '1px solid #1A1D27' }}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: '#E8EAFF' }}>{formatDateTime(rec.clock_in)}</span>
                      <span className="text-[10px] text-[#4A4D5E]">→</span>
                      <span className="text-xs font-mono" style={{ color: rec.clock_out ? '#E8EAFF' : '#F59E0B' }}>
                        {rec.clock_out ? formatDateTime(rec.clock_out) : 'פתוח ●'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px]" style={{ color: '#8B8FA8' }}>{rec.branches?.name ?? '—'}</span>
                      {rec.total_minutes != null && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,196,170,0.1)', color: '#00C4AA' }}>
                          {formatMinutes(rec.total_minutes)}
                        </span>
                      )}
                      {rec.manual_entry && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>עריכה ידנית</span>
                      )}
                    </div>
                    {rec.note && (
                      <div className="text-[11px] mt-1" style={{ color: '#4A4D5E' }}>{rec.note}</div>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setEditRecord(rec)}
                      className="mr-2 text-xs px-2 py-1 rounded-lg flex-shrink-0"
                      style={{ background: 'rgba(129,140,248,0.1)', color: '#818CF8' }}
                    >
                      עריכה
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── IP Test Panel ── */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
        <div className="flex items-center gap-2 mb-4">
          <span style={{ color: '#818CF8' }}>🌐</span>
          <h2 className="text-[#E8EAFF] font-semibold">בדיקת כתובת IP</h2>
        </div>

        <div className="flex items-center justify-between mb-4 px-3 py-2 rounded-lg" style={{ background: '#0F1117', border: '1px solid #2A2D3E' }}>
          <span className="text-xs text-[#8B8FA8]">כתובת IP נוכחית (שרת):</span>
          <span className="font-mono text-sm" style={{ color: currentIp ? '#818CF8' : '#4A4D5E' }}>
            {currentIp || 'מזהה...'}
          </span>
        </div>

        <div className="text-xs text-[#8B8FA8] mb-1 text-right">בדוק IP ספציפי (השאר ריק לבדיקת ה-IP הנוכחי)</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={testIpInput}
            onChange={(e) => setTestIpInput(e.target.value)}
            placeholder="לדוגמה: 192.168.1.1"
            dir="ltr"
            className="flex-1 px-3 py-2 rounded-xl text-sm font-mono outline-none"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleIpTest() }}
          />
          <button
            onClick={handleIpTest}
            disabled={ipTesting}
            className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: '#818CF8', color: '#fff', cursor: ipTesting ? 'not-allowed' : 'pointer', opacity: ipTesting ? 0.6 : 1 }}
          >
            בדוק
          </button>
        </div>
        <p className="text-xs text-[#4A4D5E] mt-2 text-right">הבדיקה נשמרת בלוג למטה</p>

        <div className="mt-3 pt-3" style={{ borderTop: '1px solid #2A2D3E' }}>
          <button
            onClick={handleGpsTest}
            className="w-full py-2.5 rounded-xl text-sm font-bold"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#818CF8' }}
          >
            📍 בדוק GPS עבור הסניף הנבחר
          </button>
        </div>
      </div>

      {/* ── Debug Log ── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A2D3E' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ background: '#1A1D27', borderBottom: '1px solid #2A2D3E' }}>
          <h2 className="text-[#E8EAFF] font-semibold text-sm">לוג בדיקות</h2>
          <div className="flex gap-2">
            {log.length > 0 && (
              <button
                onClick={() => setLog([])}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ background: '#0F1117', color: '#4A4D5E' }}
              >
                נקה
              </button>
            )}
            <button
              onClick={copyLog}
              disabled={log.length === 0}
              className="text-xs px-3 py-1 rounded-lg font-medium transition-all"
              style={{ background: copied ? 'rgba(0,196,170,0.15)' : '#0F1117', color: copied ? '#00C4AA' : log.length ? '#8B8FA8' : '#4A4D5E' }}
            >
              {copied ? '✓ הועתק' : 'העתק הכל'}
            </button>
          </div>
        </div>

        <div ref={logRef} className="overflow-y-auto" style={{ maxHeight: '320px', background: '#0F1117' }}>
          {log.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[#4A4D5E]">
              לוג ריק — פעולות יופיעו כאן
            </div>
          ) : (
            log.map((entry) => {
              const tc = tagColors[entry.tag] ?? { bg: 'rgba(139,143,168,0.15)', color: '#8B8FA8' }
              return (
                <div key={entry.id} className="px-4 py-3" style={{ borderBottom: '1px solid #1A1D27' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs text-[#4A4D5E]">{formatLogTime(entry.ts)}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: tc.bg, color: tc.color }}>{entry.tag}</span>
                    <span className="text-xs text-[#8B8FA8]">{entry.branch}</span>
                    <span className="mr-auto text-sm">{entry.ok ? '✅' : '❌'}</span>
                  </div>
                  <div className="space-y-0.5">
                    {entry.lines.map((line, i) => (
                      <div key={i} className="font-mono text-xs" style={{ color: '#6B7096', userSelect: 'text' }}>{line}</div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
