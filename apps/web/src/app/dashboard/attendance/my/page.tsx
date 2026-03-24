'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth'

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

// Test location: 32°00'37.7"N 34°46'04.2"E
const TEST_LOCATION_BRANCH = {
  id: '__test_location__',
  name: 'בדיקה GPS',
  lat: 32.010472,
  lng: 34.767833,
  radius: 150,
}

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
type VerificationMethod = 'gps' | 'ip' | 'bypass' | null
type GeoResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; denied: boolean }

type TestResult = {
  allowed: boolean
  method: string
  distance_meters?: number
  radius_meters?: number
  your_coords?: { lat: number; lng: number }
  target_coords?: { lat: number; lng: number }
  client_ip?: string
  branch_ip?: string | null
  branch_name?: string
  error?: string
  match?: boolean
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
      (err) => resolve({ ok: false, denied: err.code === 1 /* PERMISSION_DENIED */ }),
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    )
  })
}

function LocationPermissionBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: '#1A1D27', border: '1px solid #F59E0B55' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">📍</span>
          <div>
            <div className="font-bold text-[#E8EAFF]">נדרשת הרשאת מיקום</div>
            <div className="text-xs text-[#8B8FA8] mt-0.5">
              המערכת צריכה גישה למיקומך כדי לאמת נוכחות
            </div>
          </div>
        </div>

        <div
          className="rounded-xl p-4 mb-4 text-sm"
          style={{ background: '#0F1117', border: '1px solid #2A2D3E' }}
        >
          <div className="font-semibold text-[#E8EAFF] mb-2">כיצד להפעיל מיקום בכרום:</div>
          <ol className="space-y-1.5 text-[#8B8FA8] text-xs list-decimal list-inside">
            <li>לחץ על סמל המנעול <span className="font-mono bg-[#1A1D27] px-1 rounded">🔒</span> בשורת הכתובת</li>
            <li>בחר <strong className="text-[#E8EAFF]">"הגדרות אתר"</strong></li>
            <li>מצא <strong className="text-[#E8EAFF]">"מיקום"</strong> ושנה ל-<strong className="text-[#00C4AA]">"אפשר"</strong></li>
            <li>רענן את הדף ונסה שוב</li>
          </ol>
        </div>

        <div className="text-xs text-[#8B8FA8] mb-4 text-center">
          לחלופין, ניתן להשתמש ב<strong className="text-[#F59E0B]">מצב בדיקה (עקוף מיקום)</strong> אם מורשה
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

function VerificationBadge({ method, detail }: { method: VerificationMethod; detail?: string }) {
  if (!method) return null
  const cfg = {
    gps: { label: 'אומת לפי GPS מיקום', icon: '📍', color: '#00C4AA', bg: 'rgba(0,196,170,0.10)' },
    ip: { label: 'אומת לפי כתובת IP', icon: '🌐', color: '#818CF8', bg: 'rgba(129,140,248,0.10)' },
    bypass: { label: 'עקיפת בדיקה (מצב בדיקה)', icon: '⚡', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  }
  const c = cfg[method]
  return (
    <div
      className="mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
      style={{ background: c.bg, border: `1px solid ${c.color}22`, color: c.color }}
    >
      <span>{c.icon}</span>
      <span className="font-medium">{c.label}</span>
      {detail && <span className="mr-auto opacity-70">{detail}</span>}
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
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>(null)
  const [verificationDetail, setVerificationDetail] = useState('')
  const [showLocationBanner, setShowLocationBanner] = useState(false)

  // Test panel state
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testMode, setTestMode] = useState<'gps_branch' | 'ip_branch' | 'gps_test_location' | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

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

  const allBranches: Branch[] = [...branches, TEST_LOCATION_BRANCH]

  async function handleSubmit() {
    if (!selectedBranch) {
      setError('יש לבחור סניף')
      return
    }

    setError('')
    setSuccessMsg('')
    setVerificationMethod(null)
    setVerificationDetail('')
    setLoading(true)

    setLoadingMsg('מבדק מיקום...')
    const geoResult = await requestGeolocation()

    // Show banner if permission denied (and not in bypass mode)
    if (!bypassLocation && !geoResult.ok && geoResult.denied) {
      setShowLocationBanner(true)
      setLoadingMsg('')
      setLoading(false)
      return
    }

    const coords = geoResult.ok ? { lat: geoResult.lat, lng: geoResult.lng } : undefined

    // Client-side pre-check for test location branch
    if (selectedBranch.id === '__test_location__' && !bypassLocation) {
      if (!coords) {
        setError('לא ניתן לקבל מיקום GPS — אפשר גישה למיקום בדפדפן')
        setLoadingMsg('')
        setLoading(false)
        return
      }
      const dist = haversineDistance(coords.lat, coords.lng, TEST_LOCATION_BRANCH.lat, TEST_LOCATION_BRANCH.lng)
      if (dist > TEST_LOCATION_BRANCH.radius) {
        setError(`אינך נמצא במיקום הבדיקה (מרחק: ${Math.round(dist)}מ', מותר: ${TEST_LOCATION_BRANCH.radius}מ')`)
        setLoadingMsg('')
        setLoading(false)
        return
      }
      setSuccessMsg(`בדיקת מיקום GPS עברה בהצלחה ✓ (מרחק: ${Math.round(dist)}מ')`)
      setVerificationMethod('gps')
      setVerificationDetail(`${Math.round(dist)}מ' מהמיקום`)
      setLoadingMsg('')
      setLoading(false)
      return
    }

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

      if (!res.ok) {
        setError(data.error ?? 'שגיאה בלתי צפויה')
      } else {
        const method: VerificationMethod = data.verification_method ?? (bypassLocation ? 'bypass' : null)
        setVerificationMethod(method)
        if (method === 'gps' && data.distance_meters !== undefined) {
          setVerificationDetail(`${data.distance_meters}מ' מהסניף`)
        } else if (method === 'ip') {
          setVerificationDetail('IP תואם')
        }

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

  async function runTest(mode: 'gps_branch' | 'ip_branch' | 'gps_test_location') {
    setTestLoading(true)
    setTestResult(null)
    setTestMode(mode)

    try {
      let body: Record<string, unknown> = { mode: 'gps' }
      let coords: { lat: number; lng: number } | undefined

      if (mode === 'gps_test_location') {
        body = { mode: 'test_location', branch_id: '__test_location__' }
        const geo = await requestGeolocation()
        if (!geo.ok && geo.denied) { setShowLocationBanner(true); setTestLoading(false); return }
        coords = geo.ok ? { lat: geo.lat, lng: geo.lng } : undefined
        if (coords) { body.lat = coords.lat; body.lng = coords.lng }
      } else if (mode === 'ip_branch') {
        body = { mode: 'ip', branch_id: selectedBranch?.id }
      } else if (mode === 'gps_branch') {
        body = { mode: 'gps', branch_id: selectedBranch?.id }
        const geo = await requestGeolocation()
        if (!geo.ok && geo.denied) { setShowLocationBanner(true); setTestLoading(false); return }
        coords = geo.ok ? { lat: geo.lat, lng: geo.lng } : undefined
        if (coords) { body.lat = coords.lat; body.lng = coords.lng }
      }

      const res = await fetch('/api/attendance/check-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ allowed: false, method: 'error', error: 'לא ניתן להתחבר לשרת' })
    }

    setTestLoading(false)
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      {showLocationBanner && (
        <LocationPermissionBanner onDismiss={() => setShowLocationBanner(false)} />
      )}

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
        {/* Branch selector */}
        {branches.length === 0 && !error && (
          <div className="mb-4 text-center text-sm text-[#8B8FA8]">טוען סניפים...</div>
        )}
        {allBranches.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-[#8B8FA8] mb-2 text-right">בחר סניף</div>
            <div className="flex gap-2 flex-wrap">
              {allBranches.map((b) => {
                const isTest = b.id === '__test_location__'
                const isSelected = selectedBranch?.id === b.id
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBranch(b)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold transition-all min-w-[80px]"
                    style={{
                      background: isSelected
                        ? isTest ? 'rgba(245,158,11,0.15)' : 'rgba(0,196,170,0.15)'
                        : '#0F1117',
                      border: `1px solid ${isSelected ? (isTest ? '#F59E0B' : '#00C4AA') : '#2A2D3E'}`,
                      color: isSelected ? (isTest ? '#F59E0B' : '#00C4AA') : '#8B8FA8',
                    }}
                  >
                    {b.name}
                    {isTest && (
                      <div className="text-[10px] opacity-60 font-normal mt-0.5">
                        32.010°N 34.768°E
                      </div>
                    )}
                  </button>
                )
              })}
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
            className="text-sm mb-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(0,196,170,0.1)', color: '#00C4AA' }}
          >
            {successMsg}
          </div>
        )}

        <VerificationBadge method={verificationMethod} detail={verificationDetail} />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-5 rounded-xl text-lg font-bold transition-all mt-3"
          style={{
            background: loading
              ? '#2A2D3E'
              : selectedBranch?.id === '__test_location__'
              ? '#78350F'
              : status === 'out'
              ? '#16A34A'
              : '#EA580C',
            color: loading ? '#4A4D5E' : '#FFFFFF',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading
            ? loadingMsg || 'מעבד...'
            : selectedBranch?.id === '__test_location__'
            ? 'בדוק מיקום GPS'
            : status === 'out'
            ? 'כניסה למשמרת'
            : 'יציאה ממשמרת'}
        </button>

        <p className="text-center text-xs text-[#8B8FA8] mt-3">
          {selectedBranch?.id === '__test_location__'
            ? 'בדיקה בלבד — לא נרשמת נוכחות'
            : status === 'out'
            ? 'המערכת תאמת את מיקומך אוטומטית'
            : 'המערכת תאמת את מיקומך לרישום יציאה'}
        </p>

        {/* Test mode toggle */}
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

      {/* ─── Test Panel ─────────────────────────────────────── */}
      <div className="mt-6">
        <h2 className="text-[#E8EAFF] font-semibold mb-3 flex items-center gap-2">
          <span style={{ color: '#F59E0B' }}>🔧</span>
          כלי בדיקה
        </h2>
        <div
          className="rounded-2xl p-5"
          style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}
        >
          <p className="text-xs text-[#8B8FA8] mb-4 text-right">
            בדיקות אלה בודקות את שיטת האימות בלבד — ללא רישום נוכחות
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => runTest('gps_test_location')}
              disabled={testLoading}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: testMode === 'gps_test_location' && testResult ? 'rgba(245,158,11,0.15)' : '#0F1117',
                border: '1px solid #F59E0B44',
                color: '#F59E0B',
                cursor: testLoading ? 'not-allowed' : 'pointer',
              }}
            >
              📍 בדוק GPS נגד מיקום הבדיקה (32.010°N, 34.768°E)
            </button>

            <button
              onClick={() => runTest('gps_branch')}
              disabled={testLoading || !selectedBranch || selectedBranch.id === '__test_location__'}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: testMode === 'gps_branch' && testResult ? 'rgba(0,196,170,0.10)' : '#0F1117',
                border: '1px solid #00C4AA44',
                color: selectedBranch && selectedBranch.id !== '__test_location__' ? '#00C4AA' : '#4A4D5E',
                cursor: (testLoading || !selectedBranch || selectedBranch.id === '__test_location__') ? 'not-allowed' : 'pointer',
              }}
            >
              📍 בדוק GPS נגד {selectedBranch && selectedBranch.id !== '__test_location__' ? `"${selectedBranch.name}"` : 'סניף נבחר'}
            </button>

            <button
              onClick={() => runTest('ip_branch')}
              disabled={testLoading || !selectedBranch || selectedBranch.id === '__test_location__'}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: testMode === 'ip_branch' && testResult ? 'rgba(129,140,248,0.10)' : '#0F1117',
                border: '1px solid #818CF844',
                color: selectedBranch && selectedBranch.id !== '__test_location__' ? '#818CF8' : '#4A4D5E',
                cursor: (testLoading || !selectedBranch || selectedBranch.id === '__test_location__') ? 'not-allowed' : 'pointer',
              }}
            >
              🌐 בדוק IP נגד {selectedBranch && selectedBranch.id !== '__test_location__' ? `"${selectedBranch.name}"` : 'סניף נבחר'}
            </button>
          </div>

          {testLoading && (
            <div className="mt-4 text-center text-sm text-[#8B8FA8]">בודק...</div>
          )}

          {testResult && !testLoading && (
            <div
              className="mt-4 rounded-xl p-4 text-xs"
              style={{
                background: testResult.allowed ? 'rgba(0,196,170,0.07)' : 'rgba(239,68,68,0.07)',
                border: `1px solid ${testResult.allowed ? '#00C4AA33' : '#F8717133'}`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{testResult.allowed ? '✅' : '❌'}</span>
                <span
                  className="font-bold text-sm"
                  style={{ color: testResult.allowed ? '#00C4AA' : '#F87171' }}
                >
                  {testResult.allowed ? 'אימות עבר בהצלחה' : 'אימות נכשל'}
                </span>
                <span
                  className="mr-auto px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{
                    background: testResult.method === 'gps' ? 'rgba(0,196,170,0.15)' : 'rgba(129,140,248,0.15)',
                    color: testResult.method === 'gps' ? '#00C4AA' : '#818CF8',
                  }}
                >
                  {testResult.method === 'gps' ? '📍 GPS' : '🌐 IP'}
                </span>
              </div>

              <div className="space-y-1.5 text-[#8B8FA8]" dir="ltr">
                {testResult.client_ip && (
                  <div className="flex justify-between">
                    <span className="text-[#4A4D5E]">Your IP</span>
                    <span className="font-mono">{testResult.client_ip}</span>
                  </div>
                )}
                {testResult.branch_ip !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-[#4A4D5E]">Branch IP</span>
                    <span className="font-mono">{testResult.branch_ip ?? 'לא הוגדר'}</span>
                  </div>
                )}
                {testResult.your_coords && (
                  <div className="flex justify-between">
                    <span className="text-[#4A4D5E]">Your GPS</span>
                    <span className="font-mono">
                      {testResult.your_coords.lat.toFixed(6)}, {testResult.your_coords.lng.toFixed(6)}
                    </span>
                  </div>
                )}
                {testResult.target_coords && (
                  <div className="flex justify-between">
                    <span className="text-[#4A4D5E]">Target GPS</span>
                    <span className="font-mono">
                      {testResult.target_coords.lat.toFixed(6)}, {testResult.target_coords.lng.toFixed(6)}
                    </span>
                  </div>
                )}
                {testResult.distance_meters !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-[#4A4D5E]">Distance</span>
                    <span
                      style={{
                        color: testResult.allowed ? '#00C4AA' : '#F87171',
                        fontWeight: 700,
                      }}
                    >
                      {testResult.distance_meters}m / {testResult.radius_meters}m allowed
                    </span>
                  </div>
                )}
                {testResult.error && (
                  <div className="mt-2 text-[#F87171]">{testResult.error}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent logs */}
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
