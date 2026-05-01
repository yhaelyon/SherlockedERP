'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isLoginPage = pathname === '/dashboard/login'

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace('/dashboard/login')
    }
  }, [user, loading, router, isLoginPage])

  // Login page: render without sidebar/guard
  if (isLoginPage) return <>{children}</>

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0F1117' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg"
            style={{ backgroundColor: '#00C4AA', color: '#0F1117' }}
          >
            S
          </div>
          <div className="text-sm" style={{ color: '#8B8FA8' }}>טוען...</div>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="h-screen w-full bg-[#0F1117] flex overflow-hidden isolate" dir="rtl">
      {/* Sidebar - flex sibling */}
      <Sidebar />
      
      {/* Main content - flex sibling */}
      <main className="flex-1 h-full overflow-y-auto overflow-x-hidden bg-[#0F1117] relative">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
