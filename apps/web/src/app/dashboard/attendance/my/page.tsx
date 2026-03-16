'use client'

import { useState, useEffect, useRef } from 'react'

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

type Status = 'out' | 'in'

type Branch = { id: string; name: string }

const VENUE_LAT = 31.99111
const VENUE_LNG = 34.76331
const VENUE_RADIUS_METERS = 150

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Attempt to get GPS coordinates — resolves with coords or undefined if denied/unavailable
function requestGeolocation(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(undefined), // denied or error — IP check will run server-side
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    )
  })
}

export default function AttendanceMyPage() {
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)


  // Fetch branches via internal API route (runtime env vars — no build-time baking needed)
  useEffect(() => {
    fetch('/api/branches')
      .then((r) => r.json())
      .then((data: Branch[]) => {
        if (!Array.isArray(data)) { setError('לא ניתן לטעון סניפים'); return }
        setBranches(data)
        if (data.length === 1) setSelectedBranch(data[0])
      })
      .catch(() => setError('לא ניתן לטעון סניפים'))
  }, [])

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Elapsed timer
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

  const hebrewDay = HEBREW_DAYS[now.getDay()]
  const hebrewDate = `יום ${hebrewDay}, ${now.getDate()} ב${HEBREW_MONTHS[now.getMonth()]} ${now.getFullYear()}`

  async function handleSubmit() {
    if (!selectedBranch) {
      setError('יש לבחור סניף')
      return
    }

    setError('')
    setSuccessMsg('')
    setLoading(true)

    // Step 1: try to get GPS coordinates
    setLoadingMsg('מבדק מיקום...')
    const coords = await requestGeolocation()

    // Step 2: if GPS available, check distance before calling API (skip if test mode)
    if (coords && !bypassLocation) {
      const dist = haversineDistance(coords.lat, coords.lng, VENUE_LAT, VENUE_LNG)
      if (dist > VENUE_RADIUS_METERS) {
        setError('אינך נמצא במיקום הסניף — יש להיות באתר כדי לדווח נוכחות')
        setLoadingMsg('')
        setLoading(false)
        return
      }
    }

    // Step 3: send to internal API
    setLoadingMsg('מעבד...')
    const endpoint = status === 'out' ? '/api/attendance/clock-in' : '/api/attendance/clock-out'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'TODO', // replace with session user id
          branch_id: selectedBranch.id,
          lat: coords?.lat,
          lng: coords?.lng,
          bypass_location: bypassLocation,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'שגיאה בלתי צפויה')
      } else {
        if (status === 'out') {
          setStatus('in')
          setClockInTime(new Date())
          setSuccessMsg('נרשמה כניסה למשמרת ✓')
        } else {
          setStatus('out')
          setClockInTime(null)
          setSuccessMsg('נרשמה יציאה ממשמרת ✓')
        }
      }
    } catch {
      setError('לא ניתן להתחבר לשרת')
    }

    setLoadingMsg('')
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-[#E8EAFF] mb-1">דיווח נוכחות</h1>
      <p className="text-[#8B8FA8] mb-8 text-sm">{hebrewDate}</p>

      {/* Clock display */}
      <div
        className="rounded-2xl p-8 mb-6 flex flex-col items-center"
        style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}
      >
        <div className="text-6xl font-bold font-numbers text-[#E8EAFF] mb-2 tabular-nums">
          {formatTime(now)}
        </div>
        <div className="text-[#8B8FA8] text-sm">{hebrewDate}</div>

        {status === 'in' && clockInTime && (
          <div className="mt-6 flex flex-col items-center">
            <div className="text-xs text-[#8B8FA8] mb-1">זמן במשמרת</div>
            <div
              className="text-3xl font-bold font-numbers tabular-nums px-6 py-2 rounded-xl"
              style={{ background: '#0F1117', color: '#00C4AA' }}
            >
              {formatElapsed(elapsed)}
            </div>
            <div className="text-xs text-[#8B8FA8] mt-2">
              כניסה: {formatTime(clockInTime)}
            </div>
          </div>
        )}

        {/* Status badge */}
        <div
          className="mt-4 px-4 py-1 rounded-full text-sm font-medium"
          style={{
            background: status === 'in' ? 'rgba(0,196,170,0.15)' : 'rgba(139,143,168,0.15)',
            color: status === 'in' ? '#00C4AA' : '#8B8FA8',
          }}
        >
          {status === 'in' ? '● במשמרת' : '○ לא במשמרת'}
        </div>
      </div>

      {/* Action card */}
      <div
        className="rounded-2xl p-6"
        style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}
      >
        {/* Branch selector — inside card, above button */}
        {branches.length === 0 && !error && (
          <div className="mb-4 text-center text-sm text-[#8B8FA8]">טוען סניפים...</div>
        )}
        {branches.length > 1 && (
          <div className="mb-4">
            <div className="text-xs text-[#8B8FA8] mb-2 text-right">בחר סניף</div>
            <div className="flex gap-3">
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBranch(b)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: selectedBranch?.id === b.id ? 'rgba(0,196,170,0.15)' : '#0F1117',
                    border: `1px solid ${selectedBranch?.id === b.id ? '#00C4AA' : '#2A2D3E'}`,
                    color: selectedBranch?.id === b.id ? '#00C4AA' : '#8B8FA8',
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div
            className="text-sm mb-4 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            className="text-sm mb-4 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(0,196,170,0.1)', color: '#00C4AA' }}
          >
            {successMsg}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-5 rounded-xl text-lg font-bold transition-all"
          style={{
            background: loading
              ? '#2A2D3E'
              : status === 'out'
              ? '#16A34A'
              : '#EA580C',
            color: loading ? '#4A4D5E' : '#FFFFFF',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading
            ? loadingMsg || 'מעבד...'
            : status === 'out'
            ? 'כניסה למשמרת'
            : 'יציאה ממשמרת'}
        </button>

        <p className="text-center text-xs text-[#8B8FA8] mt-3">
          {status === 'out'
            ? 'המערכת תאמת את מיקומך אוטומטית'
            : 'המערכת תאמת את מיקומך לרישום יציאה'}
        </p>

        {/* Test mode — bypass location check */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setBypassLocation((v) => !v)}
              className="w-8 h-4 rounded-full relative transition-colors"
              style={{ background: bypassLocation ? '#F59E0B' : '#2A2D3E' }}
            >
              <div
                className="absolute top-0.5 w-3 h-3 rounded-full transition-transform"
                style={{
                  background: '#fff',
                  transform: bypassLocation ? 'translateX(17px)' : 'translateX(2px)',
                }}
              />
            </div>
            <span className="text-xs" style={{ color: bypassLocation ? '#F59E0B' : '#4A4D5E' }}>
              מצב בדיקה (עקוף מיקום)
            </span>
          </label>
        </div>
      </div>

      {/* Recent logs placeholder */}
      <div className="mt-6">
        <h2 className="text-[#E8EAFF] font-semibold mb-3">רישומים אחרונים</h2>
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid #2A2D3E' }}
        >
          {[
            { date: '13/03/2026', day: 'שישי', in: '09:02', out: '17:15', total: '8:13' },
            { date: '12/03/2026', day: 'חמישי', in: '08:55', out: '16:50', total: '7:55' },
            { date: '11/03/2026', day: 'רביעי', in: '09:10', out: '17:00', total: '7:50' },
          ].map((log, i) => (
            <div
              key={i}
              className="flex items-center px-4 py-3 text-sm gap-4"
              style={{
                borderBottom: i < 2 ? '1px solid #2A2D3E' : 'none',
                background: '#1A1D27',
              }}
            >
              <span className="text-[#8B8FA8] w-24">{log.date}</span>
              <span className="text-[#8B8FA8] w-14">יום {log.day}</span>
              <span className="text-[#E8EAFF]">↪ {log.in}</span>
              <span className="text-[#E8EAFF]">↩ {log.out}</span>
              <span className="mr-auto font-numbers font-bold text-[#00C4AA]">{log.total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
