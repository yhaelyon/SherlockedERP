import type { Metadata } from 'next'
import { Heebo, Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-heebo',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sherlocked ERP | מערכת ניהול',
  description: 'מערכת ERP לניהול חדרי בריחה - הזמנות, משמרות, תשלומים ועוד',
  keywords: 'חדר בריחה, escape room, ניהול, הזמנות, ERP',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html dir="rtl" lang="he" className={`${heebo.variable} ${inter.variable}`}>
      <body
        className={`${heebo.className} bg-[#0F1117] text-[#E8EAFF] antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
