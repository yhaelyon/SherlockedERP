'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth, ROLE_LABELS, ROLE_COLORS, type Permission } from '@/lib/auth'

interface NavChild {
  label: string
  href: string
  permission?: Permission
}

interface NavItem {
  label: string
  href: string
  icon: string
  permission?: Permission
  children?: NavChild[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'לוח בקרה', href: '/dashboard', icon: '🏠', permission: 'dashboard' },
  {
    label: 'משמרות', href: '/dashboard/shifts', icon: '📋', permission: 'shifts',
    children: [
      { label: 'הגשת אילוצים', href: '/dashboard/shifts/constraints', permission: 'shifts' },
      { label: 'לוח משמרות', href: '/dashboard/shifts/board', permission: 'shifts' },
    ],
  },
  {
    label: 'הזמנות', href: '/dashboard/bookings', icon: '📅', permission: 'bookings',
    children: [
      { label: 'יומן משחקים', href: '/dashboard/bookings/calendar', permission: 'bookings' },
      { label: 'רשימת לקוחות', href: '/dashboard/bookings/customers', permission: 'bookings' },
      { label: 'הגדרות סלוטים', href: '/dashboard/bookings/slots/settings', permission: 'bookings' },
      { label: 'הוספת סלוטים', href: '/dashboard/bookings/slots/add', permission: 'bookings' },
      { label: 'מחיקת סלוטים', href: '/dashboard/bookings/slots/delete', permission: 'bookings' },
      { label: 'הגדרות יומן', href: '/dashboard/bookings/journal-settings', permission: 'bookings' },
      { label: 'ייצוא / ייבוא', href: '/dashboard/bookings/export', permission: 'bookings' },
    ],
  },
  {
    label: 'ניהול תשלומים', href: '/dashboard/payments', icon: '💳', permission: 'payments',
    children: [
      { label: 'רשימת תשלומים', href: '/dashboard/payments/list', permission: 'payments' },
      { label: 'יצירת לינק תשלום', href: '/dashboard/payments/link', permission: 'payments' },
      { label: 'דוחות תשלום', href: '/dashboard/payments/reports', permission: 'payments' },
      { label: 'ספירת קופה', href: '/dashboard/payments/cash', permission: 'payments' },
    ],
  },
  {
    label: 'משימות', href: '/dashboard/tasks', icon: '✅', permission: 'tasks',
    children: [
      { label: 'משימות יומיות', href: '/dashboard/tasks/daily', permission: 'tasks' },
      { label: 'ניהול משימות', href: '/dashboard/tasks/manage', permission: 'tasks' },
      { label: "צ'ק ליסט פתיחה", href: '/dashboard/tasks/checklist/opening', permission: 'tasks' },
      { label: "צ'ק ליסט סגירה", href: '/dashboard/tasks/checklist/closing', permission: 'tasks' },
    ],
  },
  {
    label: 'שוברים', href: '/dashboard/vouchers', icon: '🎫', permission: 'vouchers',
    children: [
      { label: 'רשימת שוברים', href: '/dashboard/vouchers/list', permission: 'vouchers' },
      { label: 'הזמנת שובר', href: '/dashboard/vouchers/new', permission: 'vouchers' },
      { label: 'סוגי שוברים', href: '/dashboard/vouchers/types', permission: 'vouchers' },
    ],
  },
  { label: 'מידע למפעיל', href: '/dashboard/operator-info', icon: '📄', permission: 'operator_info' },
  { label: 'עובדים', href: '/dashboard/employees', icon: '👥', permission: 'employees' },
  { label: 'דיווח נוכחות', href: '/dashboard/attendance/my', icon: '🕐', permission: 'attendance' },
  {
    label: 'דוח שעות', href: '/dashboard/payroll', icon: '📊', permission: 'payroll',
    children: [
      { label: 'דוח שעות', href: '/dashboard/payroll/hours', permission: 'payroll' },
      { label: 'ניהול שכר', href: '/dashboard/payroll/salary', permission: 'payroll' },
      { label: 'חגים ומועדים', href: '/dashboard/payroll/holidays', permission: 'payroll' },
      { label: 'סיכום שכר חודשי', href: '/dashboard/payroll/summary', permission: 'payroll' },
      { label: 'ניהול חשבונות בנק', href: '/dashboard/payroll/bank', permission: 'payroll' },
    ],
  },
]

const SETTINGS_CHILDREN: NavChild[] = [
  { label: 'פרטי חברה', href: '/dashboard/admin/company', permission: 'admin' },
  { label: 'חדרים ומחירים', href: '/dashboard/admin/rooms', permission: 'admin' },
  { label: 'הגדרות יומן', href: '/dashboard/admin/calendar', permission: 'admin' },
  { label: 'הגדרות הזמנות', href: '/dashboard/admin/booking-settings', permission: 'admin' },
  { label: 'הגדרות משמרות', href: '/dashboard/admin/shifts-settings', permission: 'admin' },
  { label: 'הגדרות נוכחות', href: '/dashboard/admin/attendance-settings', permission: 'admin' },
  { label: 'WhatsApp', href: '/dashboard/admin/whatsapp', permission: 'admin' },
  { label: 'ניהול משתמשים', href: '/dashboard/admin/users', permission: 'user_management' },
  { label: 'גיבויים', href: '/dashboard/admin/backup', permission: 'admin' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, can } = useAuth()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [settingsOpen, setSettingsOpen] = useState(false)

  const toggleSection = (href: string) =>
    setOpenSections((prev) => ({ ...prev, [href]: !prev[href] }))

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(href + '/')

  const isChildActive = (children?: NavChild[]) =>
    children?.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'))

  const handleLogout = () => {
    logout()
    router.replace('/dashboard/login')
  }

  const roleColor = user ? ROLE_COLORS[user.role] : { bg: '#2A2D3E', text: '#8B8FA8' }
  const visibleSettings = SETTINGS_CHILDREN.filter((c) => !c.permission || can(c.permission))

  return (
    <aside
      className="fixed top-0 right-0 h-screen flex flex-col overflow-hidden z-40"
      style={{ width: '256px', backgroundColor: '#13161F', borderLeft: '1px solid #2E3150' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid #1E2035' }}>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-base font-bold flex-shrink-0"
          style={{ backgroundColor: '#00C4AA', color: '#0F1117' }}
        >
          S
        </div>
        <div>
          <div className="font-bold text-sm leading-tight" style={{ color: '#E8EAFF' }}>Sherlocked</div>
          <div className="text-xs" style={{ color: '#555870' }}>מערכת ניהול</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_ITEMS.filter((item) => !item.permission || can(item.permission)).map((item) => {
          const active = isActive(item.href)
          const childActive = isChildActive(item.children)
          const isOpen = openSections[item.href] ?? (active || childActive || false)
          const visibleChildren = item.children?.filter((c) => !c.permission || can(c.permission))

          if (visibleChildren && visibleChildren.length > 0) {
            return (
              <div key={item.href}>
                <button
                  onClick={() => toggleSection(item.href)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg mb-0.5 text-right transition-all duration-150"
                  style={{
                    backgroundColor: active || childActive ? '#22253A' : 'transparent',
                    color: active || childActive ? '#E8EAFF' : '#8B8FA8',
                    borderRight: active || childActive ? '2px solid #00C4AA' : '2px solid transparent',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{item.icon}</span>
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <span
                    className="text-xs transition-transform duration-200"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', color: '#555870' }}
                  >
                    ▾
                  </span>
                </button>
                {isOpen && (
                  <div className="mb-1" style={{ paddingRight: '28px' }}>
                    {visibleChildren.map((child) => {
                      const childIsActive = pathname === child.href
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md mb-0.5 text-sm transition-all duration-150"
                          style={{
                            backgroundColor: childIsActive ? '#22253A' : 'transparent',
                            color: childIsActive ? '#E8EAFF' : '#8B8FA8',
                            borderRight: childIsActive ? '2px solid #00C4AA' : '2px solid transparent',
                          }}
                        >
                          <span
                            className="w-1 h-1 rounded-full flex-shrink-0"
                            style={{ backgroundColor: childIsActive ? '#00C4AA' : '#555870' }}
                          />
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 transition-all duration-150"
              style={{
                backgroundColor: active ? '#22253A' : 'transparent',
                color: active ? '#E8EAFF' : '#8B8FA8',
                borderRight: active ? '2px solid #00C4AA' : '2px solid transparent',
              }}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          )
        })}

        {/* Settings (admin/shift_lead filtered) */}
        {visibleSettings.length > 0 && (
          <>
            <div className="my-3 mx-2" style={{ borderTop: '1px solid #1E2035' }} />
            <div>
              <button
                onClick={() => setSettingsOpen((p) => !p)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg mb-0.5 text-right transition-all duration-150"
                style={{
                  backgroundColor: pathname.startsWith('/dashboard/admin') ? '#22253A' : 'transparent',
                  color: pathname.startsWith('/dashboard/admin') ? '#E8EAFF' : '#8B8FA8',
                  borderRight: pathname.startsWith('/dashboard/admin') ? '2px solid #00C4AA' : '2px solid transparent',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base leading-none">⚙️</span>
                  <span className="text-sm font-medium">הגדרות</span>
                </div>
                <span
                  className="text-xs transition-transform duration-200"
                  style={{ transform: settingsOpen ? 'rotate(180deg)' : 'none', color: '#555870' }}
                >
                  ▾
                </span>
              </button>
              {settingsOpen && (
                <div style={{ paddingRight: '28px' }}>
                  {visibleSettings.map((child) => {
                    const childIsActive = pathname === child.href
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md mb-0.5 text-sm transition-all duration-150"
                        style={{
                          backgroundColor: childIsActive ? '#22253A' : 'transparent',
                          color: childIsActive ? '#E8EAFF' : '#8B8FA8',
                          borderRight: childIsActive ? '2px solid #00C4AA' : '2px solid transparent',
                        }}
                      >
                        <span
                          className="w-1 h-1 rounded-full flex-shrink-0"
                          style={{ backgroundColor: childIsActive ? '#00C4AA' : '#555870' }}
                        />
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </nav>

      {/* User card + logout */}
      {user && (
        <div className="px-4 py-4" style={{ borderTop: '1px solid #1E2035' }}>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: '#22253A', color: '#00C4AA' }}
            >
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: '#E8EAFF' }}>
                {user.name}
              </div>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: roleColor.bg, color: roleColor.text }}
              >
                {ROLE_LABELS[user.role]}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-sm py-2 rounded-lg transition-all"
            style={{ background: '#22253A', color: '#8B8FA8' }}
          >
            התנתק
          </button>
        </div>
      )}
    </aside>
  )
}
