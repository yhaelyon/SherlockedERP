'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface WaStatus {
  status: 'unconfigured' | 'disconnected' | 'qr' | 'connecting' | 'connected'
  phoneNumber: string | null
  profileName: string | null
  lastConnected: string | null
  evolutionError?: boolean
}

interface WaTemplate {
  id: string
  key: string
  label: string
  body: string
  enabled: boolean
}

interface WaMessage {
  id: string
  to_number: string
  to_name: string | null
  message: string
  status: 'pending' | 'sent' | 'failed' | 'received'
  trigger_type: string | null
  created_at: string
}

type Tab = 'status' | 'templates' | 'manual' | 'log' | 'settings'

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
      style={{
        background: active ? 'rgba(0,196,170,0.15)' : 'transparent',
        color: active ? '#00C4AA' : '#8B8FA8',
        border: active ? '1px solid rgba(0,196,170,0.3)' : '1px solid transparent',
      }}
    >
      {children}
    </button>
  )
}

// ─── Status Indicator ────────────────────────────────────────────────────────

function StatusDot({ status }: { status: WaStatus['status'] }) {
  const color =
    status === 'connected'    ? '#10B981' :
    status === 'qr'           ? '#F59E0B' :
    status === 'connecting'   ? '#3B82F6' :
    '#6B7280'

  const label =
    status === 'connected'    ? 'מחובר' :
    status === 'qr'           ? 'ממתין לסריקה' :
    status === 'connecting'   ? 'מתחבר...' :
    status === 'unconfigured' ? 'לא מוגדר' :
    'לא מחובר'

  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ background: color, boxShadow: status === 'connected' ? `0 0 8px ${color}` : 'none' }}
      />
      <span style={{ color }}>{label}</span>
    </span>
  )
}

// ─── Connection Tab ───────────────────────────────────────────────────────────

function ConnectionTab({ status, qrCode, onConnect, onDisconnect, onRefreshStatus }: {
  status: WaStatus
  qrCode: string | null
  onConnect: () => void
  onDisconnect: () => void
  onRefreshStatus: () => void
}) {
  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className="rounded-2xl p-5" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#E8EAFF]">סטטוס חיבור</h3>
          <button
            onClick={onRefreshStatus}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: '#22253A', color: '#8B8FA8' }}
          >
            🔄 רענן
          </button>
        </div>

        <div className="flex items-center gap-3 text-lg mb-3">
          <StatusDot status={status.status} />
        </div>

        {status.status === 'connected' && (
          <div className="space-y-1 text-sm text-[#8B8FA8] mb-4">
            {status.phoneNumber && <div>📱 {status.phoneNumber}</div>}
            {status.profileName && <div>👤 {status.profileName}</div>}
            {status.lastConnected && (
              <div>🕐 מחובר מ: {new Date(status.lastConnected).toLocaleDateString('he-IL')}</div>
            )}
          </div>
        )}

        {status.evolutionError && (
          <div className="mb-3 p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#F87171' }}>
            ⚠️ לא ניתן לתקשר עם Evolution API — בדוק שה-URL וה-API Key מוגדרים נכון בהגדרות
          </div>
        )}

        <div className="flex gap-3 mt-4">
          {status.status !== 'connected' && status.status !== 'qr' && (
            <button
              onClick={onConnect}
              className="px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: '#00C4AA', color: '#0F1117' }}
            >
              📲 התחבר ל-WhatsApp
            </button>
          )}
          {status.status === 'connected' && (
            <>
              <button
                onClick={async () => {
                  await fetch('/api/whatsapp/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to: status.phoneNumber ?? '', message: 'בדיקה ✅ — Sherlocked ERP', triggerType: 'test' }),
                  })
                  alert('הודעת בדיקה נשלחה!')
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: '#22253A', color: '#00C4AA', border: '1px solid rgba(0,196,170,0.3)' }}
              >
                📤 שלח הודעת בדיקה
              </button>
              <button
                onClick={onDisconnect}
                className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#F87171' }}
              >
                🔌 נתק
              </button>
            </>
          )}
        </div>
      </div>

      {/* QR Code panel */}
      {(status.status === 'qr' || qrCode) && (
        <div className="rounded-2xl p-6 text-center" style={{ background: '#1A1D27', border: '1px solid rgba(245,158,11,0.3)' }}>
          <p className="text-sm font-medium text-[#F59E0B] mb-1">📱 סרוק את הקוד עם WhatsApp שלך</p>
          <p className="text-xs text-[#8B8FA8] mb-4">
            פתח WhatsApp → הגדרות → מכשירים מקושרים → קשר מכשיר
          </p>
          {qrCode ? (
            <div className="flex justify-center">
              <img
                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code"
                className="rounded-xl"
                style={{ width: 220, height: 220, imageRendering: 'pixelated', background: 'white', padding: 8 }}
              />
            </div>
          ) : (
            <div className="flex justify-center items-center" style={{ width: 220, height: 220, margin: '0 auto', background: '#0F1117', borderRadius: 12 }}>
              <span className="text-[#8B8FA8] text-sm">טוען QR...</span>
            </div>
          )}
          <p className="text-xs text-[#555870] mt-3">הקוד מתחדש כל 20 שניות</p>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
        <h3 className="font-semibold text-[#E8EAFF] text-sm">איך זה עובד?</h3>
        <ol className="space-y-2 text-xs text-[#8B8FA8] list-decimal list-inside">
          <li>לחץ &quot;התחבר ל-WhatsApp&quot; — יופיע קוד QR</li>
          <li>פתח את WhatsApp Business בטלפון הייעודי</li>
          <li>הגדרות → מכשירים מקושרים → קשר מכשיר → סרוק</li>
          <li>הסשן נשמר בצורה קבועה בשרת — אין צורך לסרוק שוב</li>
          <li>המערכת תשלח הודעות אוטומציה ותעדכן הזמנות לפי תגובות לקוחות</li>
        </ol>
      </div>
    </div>
  )
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<WaTemplate[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/whatsapp/templates').then(r => r.json()).then(setTemplates)
  }, [])

  async function saveTemplate(t: WaTemplate) {
    setSaving(true)
    await fetch('/api/whatsapp/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, body: editBody }),
    })
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, body: editBody } : x))
    setEditingId(null)
    setSaving(false)
  }

  async function toggleEnabled(t: WaTemplate) {
    await fetch('/api/whatsapp/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, enabled: !t.enabled }),
    })
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, enabled: !t.enabled } : x))
  }

  const VARS = ['{{clientName}}', '{{roomName}}', '{{date}}', '{{time}}', '{{amount}}', '{{branch}}', '{{link}}', '{{message}}']

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#8B8FA8] mb-4">
        ניתן לערוך את נוסח ההודעות. משתנים זמינים: {VARS.join(', ')}
      </p>
      {templates.map(t => (
        <div key={t.id} className="rounded-2xl p-4" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm text-[#E8EAFF]">{t.label}</span>
            <div className="flex items-center gap-2">
              {/* Toggle */}
              <button
                onClick={() => toggleEnabled(t)}
                className="relative w-10 h-5 rounded-full transition-all"
                style={{ background: t.enabled ? '#00C4AA' : '#2A2D3E' }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all"
                  style={{ left: t.enabled ? '1.25rem' : '0.125rem' }}
                />
              </button>
              <button
                onClick={() => { setEditingId(t.id); setEditBody(t.body) }}
                className="text-xs px-2.5 py-1.5 rounded-lg"
                style={{ background: '#22253A', color: '#8B8FA8' }}
              >
                ✏️ ערוך
              </button>
            </div>
          </div>
          {editingId === t.id ? (
            <div className="space-y-2">
              <textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                rows={4}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF', direction: 'rtl' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveTemplate(t)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-bold"
                  style={{ background: '#00C4AA', color: '#0F1117' }}
                >
                  {saving ? 'שומר...' : 'שמור'}
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ background: '#2A2D3E', color: '#8B8FA8' }}
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#555870] font-mono leading-relaxed" dir="rtl">{t.body}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Manual Send Tab ──────────────────────────────────────────────────────────

function ManualTab() {
  const [to, setTo]     = useState('')
  const [msg, setMsg]   = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function send() {
    if (!to || !msg) return
    setStatus('sending')
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message: msg, triggerType: 'manual' }),
    })
    setStatus(res.ok ? 'sent' : 'error')
    if (res.ok) { setTo(''); setMsg('') }
    setTimeout(() => setStatus('idle'), 3000)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-[#8B8FA8] mb-1">מספר טלפון</label>
        <input
          type="tel"
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="0501234567"
          dir="ltr"
          className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
          style={{ background: '#1A1D27', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
        />
      </div>
      <div>
        <label className="block text-xs text-[#8B8FA8] mb-1">הודעה</label>
        <textarea
          value={msg}
          onChange={e => setMsg(e.target.value)}
          rows={5}
          placeholder="כתוב הודעה..."
          className="w-full rounded-xl px-3 py-2.5 outline-none text-sm resize-none"
          style={{ background: '#1A1D27', border: '1px solid #2A2D3E', color: '#E8EAFF', direction: 'rtl' }}
        />
      </div>
      <button
        onClick={send}
        disabled={status === 'sending' || !to || !msg}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all"
        style={{
          background: status === 'sent' ? '#10B981' : status === 'error' ? '#EF4444' : '#00C4AA',
          color: '#0F1117',
          opacity: !to || !msg ? 0.5 : 1,
        }}
      >
        {status === 'sending' ? 'שולח...' : status === 'sent' ? '✅ נשלח!' : status === 'error' ? '❌ שגיאה' : '📤 שלח הודעה'}
      </button>
    </div>
  )
}

// ─── Message Log Tab ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  sent: '✅ נשלח',
  failed: '❌ נכשל',
  pending: '⏳ ממתין',
  received: '📨 התקבל',
}

const TRIGGER_LABELS: Record<string, string> = {
  booking_confirm: 'אישור הזמנה',
  booking_reminder: 'תזכורת',
  payment_request: 'בקשת תשלום',
  payment_receipt: 'קבלה',
  review_request: 'בקשת ביקורת',
  manual: 'ידני',
  incoming: '← לקוח',
  auto_reply_confirm: 'אישור אוטומטי',
  auto_reply_cancel: 'ביטול אוטומטי',
  test: 'בדיקה',
}

function LogTab() {
  const [messages, setMessages] = useState<WaMessage[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/whatsapp/messages?limit=100')
      .then(r => r.json())
      .then(d => { setMessages(d); setLoading(false) })
  }, [])

  if (loading) return <div className="text-center py-10 text-[#8B8FA8]">טוען...</div>
  if (!messages.length) return <div className="text-center py-10 text-[#8B8FA8]">אין הודעות עדיין</div>

  return (
    <div className="space-y-2">
      {messages.map(m => (
        <div key={m.id} className="rounded-xl p-3 flex items-start gap-3" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-medium text-[#E8EAFF]" dir="ltr">{m.to_number}</span>
              {m.to_name && <span className="text-xs text-[#8B8FA8]">{m.to_name}</span>}
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: m.status === 'sent' ? 'rgba(16,185,129,0.15)' :
                               m.status === 'failed' ? 'rgba(239,68,68,0.15)' :
                               m.status === 'received' ? 'rgba(59,130,246,0.15)' :
                               'rgba(139,143,168,0.15)',
                  color: m.status === 'sent' ? '#10B981' :
                         m.status === 'failed' ? '#F87171' :
                         m.status === 'received' ? '#60A5FA' :
                         '#8B8FA8',
                }}
              >
                {STATUS_LABELS[m.status] ?? m.status}
              </span>
              {m.trigger_type && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,143,168,0.1)', color: '#555870' }}>
                  {TRIGGER_LABELS[m.trigger_type] ?? m.trigger_type}
                </span>
              )}
            </div>
            <p className="text-xs text-[#8B8FA8] leading-relaxed line-clamp-2" dir="rtl">{m.message}</p>
          </div>
          <span className="text-xs text-[#555870] flex-shrink-0" dir="ltr">
            {new Date(m.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [saved, setSaved] = useState(false)

  async function testConnection() {
    setTestStatus('testing')
    try {
      const res = await fetch('/api/whatsapp/status')
      setTestStatus(res.ok ? 'ok' : 'fail')
    } catch {
      setTestStatus('fail')
    }
    setTimeout(() => setTestStatus('idle'), 3000)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 space-y-4" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
        <h3 className="font-semibold text-sm text-[#E8EAFF]">הגדרות Evolution API</h3>
        <p className="text-xs text-[#8B8FA8]">
          ה-URL וה-API Key מוגדרים כמשתני סביבה בשרת (Railway). לשינוי, עדכן את{' '}
          <code className="px-1 py-0.5 rounded" style={{ background: '#0F1117', color: '#00C4AA' }}>EVOLUTION_API_URL</code>
          {' '}ו-{' '}
          <code className="px-1 py-0.5 rounded" style={{ background: '#0F1117', color: '#00C4AA' }}>EVOLUTION_API_KEY</code>
          {' '}ב-Railway.
        </p>

        <div>
          <label className="block text-xs text-[#8B8FA8] mb-1">Evolution API URL (לבדיקה בלבד)</label>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://your-evolution-api.up.railway.app"
            dir="ltr"
            className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
            style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
          />
        </div>

        <div>
          <label className="block text-xs text-[#8B8FA8] mb-1">API Key (לבדיקה בלבד)</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="••••••••••••••••"
              dir="ltr"
              className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
              style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
            />
            <button
              type="button"
              onClick={() => setShowKey(p => !p)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: '#555870' }}
            >
              {showKey ? 'הסתר' : 'הצג'}
            </button>
          </div>
        </div>

        <button
          onClick={testConnection}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            background: testStatus === 'ok' ? 'rgba(16,185,129,0.15)' : testStatus === 'fail' ? 'rgba(239,68,68,0.1)' : '#22253A',
            color: testStatus === 'ok' ? '#10B981' : testStatus === 'fail' ? '#F87171' : '#8B8FA8',
          }}
        >
          {testStatus === 'testing' ? 'בודק...' : testStatus === 'ok' ? '✅ החיבור תקין' : testStatus === 'fail' ? '❌ החיבור נכשל' : '🔗 בדוק חיבור ל-API'}
        </button>
      </div>

      {/* Instructions */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
        <h3 className="font-semibold text-sm text-[#E8EAFF]">כיצד להגדיר את Evolution API ב-Railway</h3>
        <ol className="space-y-2 text-xs text-[#8B8FA8] list-decimal list-inside leading-relaxed">
          <li>היכנס ל-Railway → פרויקט <strong>sherlocked-whatsapp</strong></li>
          <li>בשירות evolution-api → Variables → הוסף:</li>
          <li dir="ltr" className="font-mono text-[#00C4AA] break-all">
            AUTHENTICATION_API_KEY=your-secret-key<br />
            DATABASE_CONNECTION_URI=${'{{'}Postgres.DATABASE_URL{'}}'}<br />
            CACHE_REDIS_URI=${'{{'}Redis.REDIS_URL{'}}'}<br />
            WEBHOOK_GLOBAL_URL=https://git-production-68ad.up.railway.app/api/whatsapp/webhook
          </li>
          <li>בפרויקט ה-ERP (sherlocked-erp) → Variables → הוסף:</li>
          <li dir="ltr" className="font-mono text-[#00C4AA] break-all">
            EVOLUTION_API_URL=https://your-evolution-api.up.railway.app<br />
            EVOLUTION_API_KEY=your-secret-key<br />
            EVOLUTION_INSTANCE_NAME=sherlocked
          </li>
        </ol>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminWhatsAppPage() {
  const [tab, setTab]         = useState<Tab>('status')
  const [waStatus, setWaStatus] = useState<WaStatus>({
    status: 'disconnected',
    phoneNumber: null,
    profileName: null,
    lastConnected: null,
  })
  const [qrCode, setQrCode]   = useState<string | null>(null)
  const qrPollRef              = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp/status?_t=${Date.now()}`)
      if (res.ok) {
        const data: WaStatus = await res.json()
        setWaStatus(data)
        if (data.status === 'connected') {
          setQrCode(null)
          stopQrPoll()
        }
      }
    } catch { /* ignore */ }
  }, [])

  function stopQrPoll() {
    if (qrPollRef.current) {
      clearInterval(qrPollRef.current)
      qrPollRef.current = null
    }
  }

  function startQrPoll() {
    stopQrPoll()
    qrPollRef.current = setInterval(async () => {
      // Refresh QR code
      try {
        const res = await fetch(`/api/whatsapp/qr?_t=${Date.now()}`)
        if (res.ok) {
          const data = await res.json()
          if (data.qrCode) setQrCode(data.qrCode)
        }
      } catch { /* ignore */ }
      // Also check if connected yet
      fetchStatus()
    }, 10000)
  }

  useEffect(() => {
    fetchStatus()
    // Poll status every 30s
    const statusInterval = setInterval(fetchStatus, 30000)
    return () => {
      clearInterval(statusInterval)
      stopQrPoll()
    }
  }, [fetchStatus])

  async function handleConnect() {
    setWaStatus(s => ({ ...s, status: 'connecting' }))
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.qrCode) setQrCode(data.qrCode)
        setWaStatus(s => ({ ...s, status: 'qr' }))
        startQrPoll()
      }
    } catch { /* ignore */ }
  }

  async function handleDisconnect() {
    if (!confirm('האם לנתק את WhatsApp? תצטרך לסרוק QR מחדש כדי להתחבר שוב.')) return
    await fetch('/api/whatsapp/disconnect', { method: 'POST' })
    setWaStatus(s => ({ ...s, status: 'disconnected', phoneNumber: null }))
    setQrCode(null)
    stopQrPoll()
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'status',    label: '📡 חיבור' },
    { id: 'templates', label: '📋 תבניות' },
    { id: 'manual',    label: '📤 שלח הודעה' },
    { id: 'log',       label: '📊 לוג' },
    { id: 'settings',  label: '⚙️ הגדרות' },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EAFF]">WhatsApp</h1>
          <p className="text-[#8B8FA8] text-sm mt-0.5 flex items-center gap-2">
            תקשורת אוטומטית עם לקוחות
            <StatusDot status={waStatus.status} />
          </p>
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{ background: 'rgba(37,211,102,0.15)' }}
        >
          💬
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {TABS.map(t => (
          <TabBtn key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </TabBtn>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'status' && (
        <ConnectionTab
          status={waStatus}
          qrCode={qrCode}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onRefreshStatus={fetchStatus}
        />
      )}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'manual' && <ManualTab />}
      {tab === 'log' && <LogTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  )
}
