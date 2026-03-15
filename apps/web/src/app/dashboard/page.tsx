export default function DashboardPage() {
  const stats = [
    {
      label: 'הזמנות היום',
      value: '—',
      icon: '📅',
      color: '#4A9EFF',
      bg: 'rgba(74,158,255,0.08)',
    },
    {
      label: 'הכנסות היום',
      value: '—',
      icon: '💳',
      color: '#10B981',
      bg: 'rgba(16,185,129,0.08)',
    },
    {
      label: 'משמרת הנוכחית',
      value: '—',
      icon: '📋',
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.08)',
    },
    {
      label: 'חדרים פעילים',
      value: '—',
      icon: '🚪',
      color: '#8B5CF6',
      bg: 'rgba(139,92,246,0.08)',
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: '#E8EAFF' }}>
          לוח בקרה
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8B8FA8' }}>
          ברוך הבא למערכת Sherlocked ERP
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-5 flex items-center gap-4"
            style={{
              backgroundColor: '#1A1D27',
              border: '1px solid #2E3150',
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: stat.bg }}
            >
              {stat.icon}
            </div>
            <div>
              <div className="text-2xl font-bold font-inter" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-sm mt-0.5" style={{ color: '#8B8FA8' }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1A1D27',
            border: '1px solid #2E3150',
          }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#E8EAFF' }}>
            הזמנות קרובות
          </h2>
          <p className="text-sm" style={{ color: '#555870' }}>
            אין הזמנות להצגה כרגע
          </p>
        </div>

        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1A1D27',
            border: '1px solid #2E3150',
          }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#E8EAFF' }}>
            משימות פתוחות
          </h2>
          <p className="text-sm" style={{ color: '#555870' }}>
            אין משימות פתוחות כרגע
          </p>
        </div>
      </div>
    </div>
  )
}
