'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Step = 'slots' | 'form' | 'payment' | 'success'

interface SlotRow {
  id: string
  start: string
  end: string
  status: 'available' | 'booked' | 'pending'
}

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
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [step, setStep] = useState<Step>('slots')
  const [loading, setLoading] = useState(true)
  const [room, setRoom] = useState<any>(null)
  const [slots, setSlots] = useState<SlotRow[]>([])
  
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedSlot, setSelectedSlot] = useState<SlotRow | null>(null)
  
  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    source: '',
    experience: '',
    notes: '',
  })
  
  const [participants, setParticipants] = useState(2)
  const [isClubMember, setIsClubMember] = useState<'yes' | 'no' | null>(null)
  const [showJoinClub, setShowJoinClub] = useState(false)
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherApplied, setVoucherApplied] = useState(false)
  const [voucherAmount, setVoucherAmount] = useState(0)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const clubDiscount = isClubMember === 'yes' ? 15 * participants : 0
  const regularPrice = getPrice(participants)
  const total = Math.max(0, regularPrice - clubDiscount - voucherAmount)

  // 1. Fetch Room Info
  useEffect(() => {
    async function loadRoom() {
      const { data, error } = await supabase
        .from('rooms')
        .select('*, branches(name)')
        .eq('slug', params.roomSlug)
        .single()
      
      if (error) {
        console.error('Error loading room:', error)
        return
      }
      setRoom(data)
    }
    loadRoom()
  }, [params.roomSlug, supabase])

  // 2. Fetch Slots for Date
  const loadSlots = useCallback(async () => {
    if (!room?.id) return
    setLoading(true)
    
    // Start/End of selected day
    const startOfDay = new Date(selectedDate)
    startOfDay.setHours(0,0,0,0)
    const endOfDay = new Date(selectedDate)
    endOfDay.setHours(23,59,59,999)

    const { data, error } = await supabase
      .from('slots')
      .select('*')
      .eq('room_id', room.id)
      .gte('start_at', startOfDay.toISOString())
      .lte('start_at', endOfDay.toISOString())
      .order('start_at', { ascending: true })

    if (error) {
      console.error('Error loading slots:', error)
    } else {
      const mapped = (data || []).map((s: any) => ({
        id: s.id,
        start: new Date(s.start_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }),
        end: new Date(s.end_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }),
        status: s.status as any
      }))
      setSlots(mapped)
    }
    setLoading(false)
  }, [room?.id, selectedDate, supabase])

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

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

  const handleBookingSubmit = async () => {
    if (!termsAccepted) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: room.branch_id,
          room_id: room.id,
          slot_id: selectedSlot?.id,
          customer: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
            email: formData.email,
          },
          participants_count: participants,
          is_club_member: isClubMember === 'yes',
          price_total: total,
          voucher_code: voucherCode,
          voucher_amount: voucherAmount,
          terms_accepted: true,
          date_str: formatDate(selectedDate),
          time_str: selectedSlot?.start,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create booking')

      // Move to success or payment
      setStep('success')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
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
            {room?.name || 'הזמנת חדר בריחה'}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            Sherlocked {room?.branches?.name || ''}
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
          {loading ? (
            <div className="py-12 text-center text-sm text-[#9CA3AF]">טוען שעות פנויות...</div>
          ) : slots.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#9CA3AF]">אין שעות פנויות בתאריך זה</div>
          ) : (
            slots.map((slot) => {
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
            })
          )}
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
          <div className="lg:col-span-3 space-y-5">
            <h2 className="text-xl font-bold" style={{ color: '#1A1A2E' }}>
              פרטי הזמנה
            </h2>

            <div
              className="rounded-xl p-5 space-y-4"
              style={{ border: '1px solid #E5E7EB', backgroundColor: '#fff' }}
            >
              <h3 className="font-semibold text-sm" style={{ color: '#6B7280' }}>
                פרטי לקוח
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="שם פרטי *"
                  value={formData.firstName}
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg text-sm"
                  style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', outline: 'none' }}
                />
                <input
                  type="text"
                  placeholder="שם משפחה *"
                  value={formData.lastName}
                  onChange={e => setFormData({...formData, lastName: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg text-sm"
                  style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', outline: 'none' }}
                />
              </div>
              <input
                type="tel"
                placeholder="פלאפון (למשל: 0501234567) *"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 rounded-lg text-sm"
                style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', direction: 'ltr', outline: 'none' }}
              />
              <input
                type="email"
                placeholder="אימייל (לא חובה)"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 rounded-lg text-sm"
                style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', direction: 'ltr', outline: 'none' }}
              />
              
              <div className="border-t pt-4" />

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
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                rows={3}
                className="w-full px-4 py-3 rounded-lg text-sm resize-none"
                style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', outline: 'none' }}
              />
            </div>

            {/* Voucher Section */}
            <div className="rounded-xl p-5" style={{ border: '1px solid #E5E7EB', backgroundColor: '#fff' }}>
              <label className="text-sm font-medium mb-3 block" style={{ color: '#374151' }}>קוד קופון או שובר מתנה</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  placeholder="הכנס קוד"
                  className="flex-1 px-4 py-2 rounded-lg text-sm"
                  style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', direction: 'ltr', outline: 'none' }}
                />
                <button
                  onClick={() => { setVoucherApplied(true); setVoucherAmount(100) }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: '#00C4AA', color: '#fff' }}
                >
                  אמת
                </button>
              </div>
            </div>

            {/* Terms & Submit */}
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 rounded"
                />
                <span className="text-sm" style={{ color: '#374151' }}>
                  קראתי והסכמתי ל
                  <span className="underline" style={{ color: '#00C4AA' }}>תנאי התקנון</span> ומדיניות הביטולים
                </span>
              </label>

              {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}

              <button
                onClick={handleBookingSubmit}
                disabled={!termsAccepted || submitting}
                className="w-full py-4 rounded-xl font-bold text-base transition-all"
                style={{
                  backgroundColor: termsAccepted && !submitting ? '#00C4AA' : '#D1D5DB',
                  color: '#fff',
                }}
              >
                {submitting ? 'מעבד הזמנה...' : 'הזמן עכשיו'}
              </button>
            </div>
          </div>

          {/* Sticky Summary */}
          <div className="lg:col-span-2">
            <div className="rounded-xl p-5 lg:sticky lg:top-4" style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
              <h3 className="font-bold text-base mb-4" style={{ color: '#1A1A2E' }}>סיכום הזמנה</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: '#6B7280' }}>חדר:</span>
                  <span className="font-medium">{room?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#6B7280' }}>תאריך:</span>
                  <span className="font-medium">{formatDate(selectedDate)}</span>
                </div>
                {selectedSlot && (
                  <div className="flex justify-between">
                    <span style={{ color: '#6B7280' }}>שעה:</span>
                    <span className="font-medium">{selectedSlot.start}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-2 mt-2">
                  <span>סה&quot;כ:</span>
                  <span style={{ color: '#00C4AA' }}>₪{total}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✓</div>
        <h2 className="text-2xl font-bold mb-2">תודה, {formData.firstName}!</h2>
        <p className="text-gray-600 mb-8">ההזמנה שלך התקבלה בהצלחה. שלחנו לך אישור ב-WhatsApp לנייד שמסרת.</p>
        <button 
          onClick={() => window.location.href = '/'}
          className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold"
        >
          חזרה לדף הבית
        </button>
      </div>
    )
  }

  return null
}
