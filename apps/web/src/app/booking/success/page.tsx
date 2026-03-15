export default function BookingSuccessPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      {/* Icon */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"
        style={{ backgroundColor: '#F0FDF4', border: '2px solid #BBF7D0' }}
      >
        ✅
      </div>

      <h1 className="text-2xl font-bold mb-2" style={{ color: '#1A1A2E' }}>
        ההזמנה אושרה!
      </h1>
      <p className="text-sm mb-8" style={{ color: '#6B7280' }}>
        פרטי ההזמנה נשלחו אליך בוואטסאפ
      </p>

      {/* Booking details card */}
      <div
        className="rounded-xl p-6 text-right space-y-3 mb-8"
        style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
      >
        <div className="flex justify-between text-sm">
          <span style={{ color: '#9CA3AF' }}>מספר הזמנה:</span>
          <span className="font-semibold font-inter" style={{ color: '#1A1A2E' }}>#—</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#9CA3AF' }}>חדר:</span>
          <span className="font-semibold" style={{ color: '#1A1A2E' }}>—</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#9CA3AF' }}>תאריך:</span>
          <span className="font-semibold" style={{ color: '#1A1A2E' }}>—</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#9CA3AF' }}>שעה:</span>
          <span className="font-semibold font-inter" style={{ color: '#1A1A2E' }}>—</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#9CA3AF' }}>משתתפים:</span>
          <span className="font-semibold" style={{ color: '#1A1A2E' }}>—</span>
        </div>
        <div className="border-t" style={{ borderColor: '#E5E7EB' }} />
        <div className="flex justify-between text-sm font-bold">
          <span style={{ color: '#374151' }}>סה&quot;כ ששולם:</span>
          <span style={{ color: '#10B981' }}>₪—</span>
        </div>
      </div>

      {/* WhatsApp note */}
      <div
        className="rounded-xl p-4 mb-6 text-sm text-right"
        style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
      >
        <p style={{ color: '#065F46' }}>
          📱 הודעת אישור נשלחה לוואטסאפ שלך. תזכורת תישלח 24 שעות לפני המשחק.
        </p>
      </div>

      <a
        href="/"
        className="inline-block px-8 py-3 rounded-xl font-semibold text-sm"
        style={{ backgroundColor: '#00C4AA', color: '#fff' }}
      >
        חזרה לדף הבית
      </a>
    </div>
  )
}
