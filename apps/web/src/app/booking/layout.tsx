import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'הזמנת חדר בריחה | Sherlocked',
  description: 'הזמן חדר בריחה — Sherlocked האוס',
}

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      dir="rtl"
      lang="he"
      style={{
        backgroundColor: '#FFFFFF',
        minHeight: '100vh',
        fontFamily: 'Heebo, sans-serif',
        color: '#1A1A2E',
      }}
    >
      {children}
    </div>
  )
}
