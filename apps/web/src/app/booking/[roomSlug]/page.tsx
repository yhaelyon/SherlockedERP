'use client'

import { useState } from 'react'

type Step = 'slots' | 'form' | 'payment'

interface SlotRow {
  id: string
  start: string
  end: string
  status: 'available' | 'booked' | 'pending'
}

const MOCK_SLOTS: SlotRow[] = [
  { id: '1', start: '09:40', end: '10:40', status: 'available' },
  { id: '2', start: '11:10', end: '12:10', status: 'booked' },
  { id: '3', start: '12:40', end: '13:40', status: 'available' },
  { id: '4', start: '14:10', end: '15:10', status: 'available' },
  { id: '5', start: '15:40', end: '16:40', status: 'booked' },
  { id: '6', start: '17:10', end: '18:10', status: 'available' },
  { id: '7', start: '18:40', end: '19:40', status: 'available' },
  { id: '8', start: '20:10', end: '21:10', status: 'available' },
]

const PRICING: Record<number, number> = {
  2: 300, 3: 420, 4: 520, 5: 600, 6: 720,
  7: 840, 8: 960, 9: 1080, 10: 1200,
}
function getPrice(n: number): number {
  if (n <= 2) return 300
  if (n >= 10) return 1200 + (n - 10) * 120
  return PRICING[n] ?? 300
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function BookingPage({ params }: { params: { roomSlug: string } }) {
  const [step, setStep] = useState<Step>('slots')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedSlot, setSelectedSlot] = useState<SlotRow | null>(null)
  const [participants, setParticipants] = useState(2)
  const [isClubMember, setIsClubMember] = useState<'yes' | 'no' | null>(null)
  const [showJoinClub, setShowJoinClub] = useState(false)
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherApplied, setVoucherApplied] = useState(false)
  const [voucherAmount, setVoucherAmount] = useState(0)
  const [termsAccepted, setTermsAccepted] = useState(false)

  const clubDiscount = isClubMember === 'yes' ? 15 * participants : 0
  const regularPrice = getPrice(participants)
  const total = Math.max(0, regularPrice - clubDiscount - voucherAmount)

  const prevDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(d)
  }
  const nextDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    setSelectedDate(d)
  }

  const handleSelectSlot = (slot: SlotRow) => {
    if (slot.status !== 'available') return
    setSelectedSlot(slot)
    setStep('form')
  }

  if (step === 'slots') {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl text-xl font-bold mb-3"
            style={{ backgroundColor: '#00C4AA', color: '#fff' }}
          >
            S
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>
            הזמנת חדר בריחה
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            Sherlocked האוס
          </p>
        </div>

        {/* Date navigation */}
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl mb-4"
          style={{ backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB' }}
        >
          <button
            onClick={prevDay}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#374151' }}
          >
            ▶
          </button>
          <span className="text-sm font-semibold" style={{ color: '#1A1A2E' }}>
            {formatDate(selectedDate)}
          </span>
          <button
            onClick={nextDay}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#374151' }}
          >
            ◀
          </button>
        </div>

        {/* Slot list */}
        <div className="space-y-2">
          {MOCK_SLOTS.map((slot) => {
            const available = slot.status === 'available'
            return (
              <button
                key={slot.id}
                onClick={() => handleSelectSlot(slot)}
                disabled={!available}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-150"
                style={{
                  backgroundColor: available ? '#FFFFFF' : '#F9FAFB',
                  border: `1px solid ${available ? '#E5E7EB' : '#F3F4F6'}`,
                  cursor: available ? 'pointer' : 'not-allowed',
                  opacity: available ? 1 : 0.5,
                  boxShadow: available ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: available ? '#10B981' : '#D1D5DB' }}
                  />
                  <span className="font-semibold text-sm" style={{ color: '#1A1A2E', fontFamily: 'Inter, monospace' }}>
                    {slot.start} – {slot.end}
                  </span>
                </div>
                {available ? (
                  <span
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: '#00C4AA', color: '#fff' }}
                  >
                    הזמנה
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: '#9CA3AF' }}>
                    תפוס
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (step === 'form') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => setStep('slots')}
          className="flex items-center gap-2 text-sm mb-6"
          style={{ color: '#00C4AA' }}
        >
          ▶ חזרה לבחירת שעה
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT — Form */}
          <div className="lg:col-span-3 space-y-5">
            <h2 className="text-xl font-bold" style={{ color: '#1A1A2E' }}>
              פרטי הזמנה
            </h2>

            {/* Customer details */}
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ border: '1px solid #E5E7EB', backgroundColor: '#fff' }}
            >
              <h3 className="font-semibold text-sm" style={{ color: '#6B7280' }}>
                פרטי לקוח
              </h3>
              <input
                type="text"
                placeholder="שם מלא *"
                className="w-full px-4 py-3 rounded-lg text-sm"
                style={{
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F9FAFB',
                  color: '#1A1A2E',
                  outline: 'none',
                }}
              />
              <input
                type="tel"
                placeholder="פלאפון *"
                className="w-full px-4 py-3 rounded-lg text-sm"
                style={{
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F9FAFB',
                  color: '#1A1A2E',
                  outline: 'none',
                  direction: 'ltr',
                }}
              />
              <input
                type="email"
                placeholder="אימייל (לא חובה)"
                className="w-full px-4 py-3 rounded-lg text-sm"
                style={{
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F9FAFB',
                  color: '#1A1A2E',
                  outline: 'none',
                  direction: 'ltr',
                }}
              />
              <select
                className="w-full px-4 py-3 rounded-lg text-sm"
                style={{
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F9FAFB',
                  color: '#6B7280',
                  outline: 'none',
                }}
              >
                <option value="">איך הגעתם אלינו?</option>
                <option>גוגל</option>
                <option>פייסבוק</option>
                <option>חבר</option>
                <option>שלט</option>
                <option>אחר</option>
              </select>
              <select
                className="w-full px-4 py-3 rounded-lg text-sm"
                style={{
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F9FAFB',
                  color: '#6B7280',
                  outline: 'none',
                }}
              >
                <option value="">ניסיון חדרי בריחה?</option>
                <option>ראשון</option>
                <option>1-3 חדרים</option>
                <option>4+ חדרים</option>
                <option>מנוסים</option>
              </select>

              {/* Participants */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  מספר משתתפים *
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setParticipants((p) => Math.max(2, p - 1))}
                    className="w-10 h-10 rounded-lg font-bold text-lg"
                    style={{ backgroundColor: '#F3F4F6', color: '#374151' }}
                  >
                    –
                  </button>
                  <span className="text-xl font-bold w-8 text-center" style={{ color: '#1A1A2E' }}>
                    {participants}
                  </span>
                  <button
                    onClick={() => setParticipants((p) => p + 1)}
                    className="w-10 h-10 rounded-lg font-bold text-lg"
                    style={{ backgroundColor: '#F3F4F6', color: '#374151' }}
                  >
                    +
                  </button>
                </div>
              </div>

              <textarea
                placeholder="הערות הזמנה (לא חובה)"
                rows={3}
                className="w-full px-4 py-3 rounded-lg text-sm resize-none"
                style={{
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F9FAFB',
                  color: '#1A1A2E',
                  outline: 'none',
                }}
              />
            </div>

            {/* Voucher */}
            <div
              className="rounded-xl p-5"
              style={{ border: '1px solid #E5E7EB', backgroundColor: '#fff' }}
            >
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium" style={{ color: '#374151' }}>
                <input type="checkbox" className="rounded" />
                יש לי קוד שובר מתנה
              </label>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  placeholder="הכנס קוד שובר"
                  className="flex-1 px-4 py-2 rounded-lg text-sm"
                  style={{
                    border: '1px solid #E5E7EB',
                    backgroundColor: '#F9FAFB',
                    color: '#1A1A2E',
                    outline: 'none',
                    direction: 'ltr',
                  }}
                />
                <button
                  onClick={() => { setVoucherApplied(true); setVoucherAmount(100) }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: '#00C4AA', color: '#fff' }}
                >
                  אמת
                </button>
              </div>
              {voucherApplied && (
                <p className="text-sm mt-2" style={{ color: '#10B981' }}>
                  ✅ שובר הוחל — הנחה ₪{voucherAmount}
                </p>
              )}
            </div>

            {/* Escape Club */}
            <div
              className="rounded-xl p-5"
              style={{ border: '1px solid #E5E7EB', backgroundColor: '#fff' }}
            >
              <p className="text-sm font-medium mb-3" style={{ color: '#374151' }}>
                האם אתה חבר Escape Club?
              </p>
              <div className="flex gap-3 mb-3">
                <button
                  onClick={() => { setIsClubMember('yes'); setShowJoinClub(false) }}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors"
                  style={{
                    backgroundColor: isClubMember === 'yes' ? '#00C4AA' : '#fff',
                    borderColor: isClubMember === 'yes' ? '#00C4AA' : '#E5E7EB',
                    color: isClubMember === 'yes' ? '#fff' : '#374151',
                  }}
                >
                  כן 👑
                </button>
                <button
                  onClick={() => { setIsClubMember('no'); setShowJoinClub(true) }}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors"
                  style={{
                    backgroundColor: isClubMember === 'no' ? '#F3F4F6' : '#fff',
                    borderColor: isClubMember === 'no' ? '#D1D5DB' : '#E5E7EB',
                    color: '#374151',
                  }}
                >
                  לא
                </button>
              </div>

              {isClubMember === 'yes' && (
                <input
                  type="text"
                  placeholder="מספר טלפון או מספר חבר"
                  className="w-full px-4 py-2 rounded-lg text-sm"
                  style={{
                    border: '1px solid #E5E7EB',
                    backgroundColor: '#F9FAFB',
                    color: '#1A1A2E',
                    outline: 'none',
                    direction: 'ltr',
                  }}
                />
              )}

              {showJoinClub && isClubMember === 'no' && (
                <div
                  className="mt-3 p-4 rounded-xl"
                  style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
                >
                  <p className="text-sm font-semibold mb-3" style={{ color: '#065F46' }}>
                    🎉 הצטרף עכשיו וקבל ₪{15 * participants} הנחה על המשחק הזה!
                  </p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="שם פרטי"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ border: '1px solid #D1FAE5', backgroundColor: '#fff', outline: 'none' }}
                    />
                    <input
                      type="text"
                      placeholder="תעודת זהות"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ border: '1px solid #D1FAE5', backgroundColor: '#fff', outline: 'none', direction: 'ltr' }}
                    />
                    <input
                      type="date"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ border: '1px solid #D1FAE5', backgroundColor: '#fff', outline: 'none' }}
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setIsClubMember('yes')}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: '#10B981', color: '#fff' }}
                    >
                      הצטרף וקבל הנחה
                    </button>
                    <button
                      onClick={() => setShowJoinClub(false)}
                      className="py-2 px-3 rounded-lg text-xs"
                      style={{ color: '#6B7280' }}
                    >
                      אולי בפעם הבאה
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cancellation policy */}
            <div
              className="rounded-xl p-4 text-sm"
              style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}
            >
              <p className="font-semibold mb-2" style={{ color: '#92400E' }}>
                מדיניות ביטולים:
              </p>
              <ul className="space-y-1" style={{ color: '#78350F' }}>
                <li>• ביטול עד 24 שעות לפני — ללא חיוב</li>
                <li>• ביטול בין 24 שעות ל-2 שעות לפני — חיוב 50%</li>
                <li>• ביטול פחות מ-2 שעות / אי הגעה / איחור מעל 30 דק&#39; — חיוב מלא 100%</li>
              </ul>
            </div>

            {/* Terms */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 rounded"
              />
              <span className="text-sm" style={{ color: '#374151' }}>
                קראתי והסכמתי ל
                <span className="underline cursor-pointer" style={{ color: '#00C4AA' }}>
                  תנאי התקנון
                </span>
              </span>
            </label>

            <button
              onClick={() => setStep('payment')}
              disabled={!termsAccepted}
              className="w-full py-4 rounded-xl font-bold text-base transition-all"
              style={{
                backgroundColor: termsAccepted ? '#00C4AA' : '#D1D5DB',
                color: termsAccepted ? '#fff' : '#9CA3AF',
                cursor: termsAccepted ? 'pointer' : 'not-allowed',
              }}
            >
              הזמן עכשיו
            </button>
          </div>

          {/* RIGHT — Summary (sticky) */}
          <div className="lg:col-span-2">
            <div
              className="rounded-xl p-5 lg:sticky lg:top-4"
              style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}
            >
              <h3 className="font-bold text-base mb-4" style={{ color: '#1A1A2E' }}>
                פרטי המשחק
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: '#6B7280' }}>חדר:</span>
                  <span className="font-medium" style={{ color: '#1A1A2E' }}>
                    {params.roomSlug.replace(/-/g, ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#6B7280' }}>תאריך:</span>
                  <span className="font-medium" style={{ color: '#1A1A2E' }}>
                    {selectedDate.toLocaleDateString('he-IL')}
                  </span>
                </div>
                {selectedSlot && (
                  <div className="flex justify-between">
                    <span style={{ color: '#6B7280' }}>שעה:</span>
                    <span className="font-medium font-inter" style={{ color: '#1A1A2E' }}>
                      {selectedSlot.start} – {selectedSlot.end} (60 דקות)
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ color: '#6B7280' }}>משתתפים:</span>
                  <span className="font-medium" style={{ color: '#1A1A2E' }}>
                    {participants}
                  </span>
                </div>

                <div className="border-t my-3" style={{ borderColor: '#E5E7EB' }} />

                <div className="flex justify-between">
                  <span style={{ color: '#6B7280' }}>מחיר רגיל:</span>
                  <span style={{ color: '#374151' }}>₪{regularPrice}</span>
                </div>
                {clubDiscount > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: '#6B7280' }}>הנחת מועדון:</span>
                    <span style={{ color: '#10B981' }}>-₪{clubDiscount}</span>
                  </div>
                )}
                {voucherApplied && (
                  <div className="flex justify-between">
                    <span style={{ color: '#6B7280' }}>הנחת שובר:</span>
                    <span style={{ color: '#10B981' }}>-₪{voucherAmount}</span>
                  </div>
                )}

                <div className="border-t my-3" style={{ borderColor: '#E5E7EB' }} />

                <div className="flex justify-between text-base font-bold">
                  <span style={{ color: '#1A1A2E' }}>סה&quot;כ לתשלום:</span>
                  <span style={{ color: '#00C4AA' }}>₪{total}</span>
                </div>
              </div>

              {/* Countdown */}
              <div
                className="mt-4 px-3 py-2 rounded-lg text-center text-sm font-semibold"
                style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}
              >
                ⏱ זמן שנותר להשלמת ההזמנה: 4:59
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Payment step
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
        style={{ backgroundColor: '#F0FDF4' }}
      >
        💳
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ color: '#1A1A2E' }}>
        מעביר לתשלום...
      </h2>
      <p className="text-sm" style={{ color: '#6B7280' }}>
        הסכום לתשלום: ₪{total}
      </p>
      <p className="text-xs mt-4" style={{ color: '#9CA3AF' }}>
        תועבר לעמוד התשלום המאובטח של PayPlus
      </p>
    </div>
  )
}
