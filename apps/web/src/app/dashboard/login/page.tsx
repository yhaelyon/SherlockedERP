'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const { login, user, loading, error } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Already logged in → go to dashboard
  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const ok = await login(email.trim(), password)
    if (ok) router.replace('/dashboard')
    setSubmitting(false)
  }

  if (loading) return null

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#0F1117' }}
    >
      <div className="w-full max-w-md">
        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{ backgroundColor: '#1A1D27', border: '1px solid #2E3150' }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold mb-4"
              style={{ backgroundColor: '#00C4AA', color: '#0F1117' }}
            >
              S
            </div>
            <h1 className="text-2xl font-bold" style={{ color: '#E8EAFF' }}>
              Sherlocked ERP
            </h1>
            <p className="text-sm mt-1" style={{ color: '#8B8FA8' }}>
              מערכת ניהול חדרי בריחה
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#8B8FA8' }}>
                אימייל
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-colors"
                style={{
                  backgroundColor: '#22253A',
                  border: '1px solid #2E3150',
                  color: '#E8EAFF',
                  direction: 'ltr',
                  textAlign: 'right',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#00C4AA')}
                onBlur={(e) => (e.target.style.borderColor = '#2E3150')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#8B8FA8' }}>
                סיסמה
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: '#22253A',
                    border: '1px solid #2E3150',
                    color: '#E8EAFF',
                    direction: 'ltr',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#00C4AA')}
                  onBlur={(e) => (e.target.style.borderColor = '#2E3150')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: '#555870' }}
                >
                  {showPassword ? 'הסתר' : 'הצג'}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="px-4 py-3 rounded-lg text-sm"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  color: '#F87171',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg font-semibold text-sm transition-all mt-2"
              style={{
                backgroundColor: submitting ? '#007A6A' : '#00C4AA',
                color: '#0F1117',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'מתחבר...' : 'התחבר'}
            </button>
          </form>
        </div>

        {/* Dev credentials hint */}
        <div
          className="mt-4 rounded-xl p-4 text-xs"
          style={{ background: '#1A1D27', border: '1px solid #2A2D3E', color: '#555870' }}
        >
          <div className="font-semibold mb-2" style={{ color: '#8B8FA8' }}>פרטי כניסה לפיתוח</div>
          <div className="space-y-1 font-numbers" dir="ltr">
            <div>
              admin@sherlocked.co.il / Admin1234 —{' '}
              <span style={{ color: '#F87171' }}>מנהל</span>
            </div>
            <div>
              lead@sherlocked.co.il / Lead1234 —{' '}
              <span style={{ color: '#F59E0B' }}>מנהל משמרת</span>
            </div>
            <div>
              staff@sherlocked.co.il / Staff1234 —{' '}
              <span style={{ color: '#8B8FA8' }}>עובד</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
