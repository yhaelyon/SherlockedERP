'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'

export default function AttendanceTabletPage() {
  const { user } = useAuth()
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [token, setToken] = useState<string>('')
  const [expiresAt, setExpiresAt] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 1. Load branches
  useEffect(() => {
    fetch('/api/branches')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setBranches(d)
          if (d.length > 0) setSelectedBranchId(d[0].id)
        }
      })
  }, [])

  // 2. Poll token
  useEffect(() => {
    if (!selectedBranchId) return

    const fetchToken = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/attendance/token?branch_id=${selectedBranchId}`)
        const data = await res.json()
        if (data.token) {
          setToken(data.token)
          setExpiresAt(data.expires_at)
        } else {
          setError(data.error || 'Failed to fetch token')
        }
      } catch (e) {
        setError('Connection error')
      }
      setLoading(false)
    }

    fetchToken()
    const interval = setInterval(fetchToken, 30000) // check every 30s
    return () => clearInterval(interval)
  }, [selectedBranchId])

  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return <div className="p-10 text-center text-[#F87171]">גישה למנהלים בלבד</div>
  }

  return (
    <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-2xl bg-[#1A1D27] rounded-[2rem] p-12 shadow-2xl border border-[#2A2D3E]">
        <h1 className="text-3xl font-bold text-[#E8EAFF] mb-8">קוד נוכחות לסניף</h1>

        <div className="mb-10">
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="bg-[#0F1117] border border-[#2A2D3E] text-[#E8EAFF] rounded-xl px-6 py-3 text-lg outline-none focus:border-[#00C4AA]"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <div className="text-[10rem] font-bold font-numbers tracking-widest text-[#00C4AA] leading-none mb-4 tabular-nums">
            {token || '------'}
          </div>
          
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1A1D27]/50 backdrop-blur-sm rounded-2xl">
              <div className="w-12 h-12 border-4 border-[#00C4AA] border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {error && <div className="text-[#F87171] mb-6">{error}</div>}

        <div className="p-6 rounded-2xl bg-[#0F1117]/50 border border-[#2A2D3E] inline-block">
          <p className="text-[#8B8FA8] text-lg">
            על העובד להזין קוד זה באפליקציה בתוך 5 דקות
          </p>
          <p className="text-xs text-[#555870] mt-2">
            תוקף: {expiresAt ? new Date(expiresAt).toLocaleTimeString('he-IL') : '--:--'}
          </p>
        </div>
        
        <div className="mt-12 flex items-center justify-center gap-2 text-[#555870]">
          <div className="w-2 h-2 rounded-full bg-[#00C4AA] animate-pulse"></div>
          הקוד מתרענן אוטומטית כל 5 דקות
        </div>
      </div>
      
      <p className="mt-8 text-[#555870] text-sm">המערכת מיועדת לתצוגה על טאבלט בסניף</p>
    </div>
  )
}
