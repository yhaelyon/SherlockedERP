'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isToday,
  startOfWeek,
  endOfWeek
} from 'date-fns'
import { he } from 'date-fns/locale'
import { 
  ChevronRight, 
  ChevronLeft, 
  Calendar as CalendarIcon, 
  Users, 
  Phone, 
  Mail, 
  CreditCard, 
  Clock, 
  MapPin, 
  Info,
  ExternalLink,
  ChevronDown,
  Search
} from 'lucide-react'

// --- Types ---
interface Branch { id: string; name: string }
interface Room { id: string; name: string; color_hex: string }
interface Customer {
  id: string
  first_name: string
  last_name: string
  phone: string
  email?: string
}
interface Booking {
  id: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'no_show'
  participants_count: number
  price_total: number
  amount_paid: number
  notes?: string
  internal_notes?: string
  customers: Customer
}
interface Slot {
  id: string
  start_at: string
  end_at: string
  status: 'available' | 'pending' | 'booked' | 'blocked' | 'cancelled'
  bookings?: Booking | Booking[]
}

const HEBREW_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

export default function BookingsCalendarPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const supabase = createClient()

  // 1. Load Initial Data (Branches)
  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('branches').select('id, name').order('name')
      if (data && data.length > 0) {
        const filtered = data.filter(b => b.name !== 'בדיקה GPS')
        setBranches(filtered)
        setSelectedBranchId(filtered[0].id)
      }
    }
    init()
  }, [])

  // 2. Load Rooms when Branch changes
  useEffect(() => {
    if (!selectedBranchId) return
    async function fetchRooms() {
      const { data } = await supabase
        .from('rooms')
        .select('id, name, color_hex')
        .eq('branch_id', selectedBranchId)
        .eq('status', 'active')
        .order('display_order')
      
      setRooms(data || [])
      if (data && data.length > 0) {
        setSelectedRoomId(data[0].id)
      } else {
        setSelectedRoomId('')
      }
    }
    fetchRooms()
  }, [selectedBranchId])

  // 3. Load Slots when Room or Month changes
  const fetchSlots = useCallback(async () => {
    if (!selectedRoomId) {
      setSlots([])
      setLoading(false)
      return
    }

    setLoading(true)
    const start = format(startOfWeek(startOfMonth(currentMonth)), 'yyyy-MM-dd')
    const end = format(endOfWeek(endOfMonth(currentMonth)), 'yyyy-MM-dd')

    try {
      const res = await fetch(`/api/bookings/calendar?room_id=${selectedRoomId}&start_date=${start}&end_date=${end}`)
      const { data } = await res.json()
      setSlots(data || [])
    } catch (e) {
      console.error('Failed to fetch slots:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedRoomId, currentMonth])

  useEffect(() => {
    fetchSlots()
  }, [fetchSlots])

  // --- Calendar Math ---
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth))
    const end = endOfWeek(endOfMonth(currentMonth))
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const getSlotsForDay = (day: Date) => {
    return slots.filter(s => isSameDay(new Date(s.start_at), day))
  }

  // --- Helpers ---
  const getSlotColor = (slot: Slot) => {
    if (slot.status === 'available') return '#2A2D3E' // Dark/Grey for empty
    if (slot.status === 'pending') return '#F59E0B' // Orange for pending hold
    
    // Check booking status
    const booking = Array.isArray(slot.bookings) ? slot.bookings[0] : slot.bookings
    if (booking?.status === 'pending') return '#FBBF24' // Yellow for waiting CC
    if (booking?.status === 'confirmed') return '#10B981' // Green for confirmed
    
    return '#4A9EFF' // Default blue
  }

  const activeBooking = useMemo(() => {
    if (!selectedSlot?.bookings) return null
    return Array.isArray(selectedSlot.bookings) ? selectedSlot.bookings[0] : selectedSlot.bookings
  }, [selectedSlot])

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 overflow-hidden">
      {/* Left Side: Calendar View (70%) */}
      <div className="flex-[7] flex flex-col bg-[#1A1D27] rounded-3xl border border-[#2A2D3E] shadow-2xl overflow-hidden relative">
        {/* Header: Controls */}
        <div className="flex items-center justify-between p-6 border-b border-[#2A2D3E]">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black text-[#E8EAFF] tracking-tight">יומן משחקים</h1>
            <div className="flex items-center gap-1 bg-[#13161F] p-1 rounded-xl border border-[#2A2D3E]">
              <button 
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 hover:bg-[#22253A] rounded-lg text-[#8B8FA8] transition-colors"
              >
                <ChevronRight size={20} />
              </button>
              <div className="px-4 text-sm font-bold text-[#E8EAFF] min-w-[120px] text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: he })}
              </div>
              <button 
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 hover:bg-[#22253A] rounded-lg text-[#8B8FA8] transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
            </div>
            <button 
              onClick={() => setCurrentMonth(new Date())}
              className="px-4 py-2 text-xs font-bold bg-[#13161F] text-[#8B8FA8] rounded-xl border border-[#2A2D3E] hover:text-[#E8EAFF] transition-all"
            >
              היום
            </button>
          </div>

          <div className="flex items-center gap-3">
             {/* Branch Selector Shortcut */}
             <select 
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-[#13161F] text-sm text-[#E8EAFF] border border-[#2A2D3E] rounded-xl px-4 py-2 outline-none cursor-pointer focus:border-[#00C4AA] transition-all"
             >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
             </select>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-[#2A2D3E] bg-[#13161F]">
            {HEBREW_DAYS.map(day => (
              <div key={day} className="py-2 text-center text-[10px] font-black text-[#555870] uppercase tracking-widest leading-none">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="flex-1 grid grid-cols-7 grid-rows-6 auto-rows-fr overflow-y-auto">
            {days.map((day, idx) => {
              const daySlots = getSlotsForDay(day)
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
              
              return (
                <div 
                  key={idx} 
                  className={`border-b border-l border-[#2A2D3E] p-1.5 min-h-[100px] flex flex-col gap-1 transition-colors ${!isCurrentMonth ? 'bg-[#13161F]/40' : 'bg-transparent'} ${isToday(day) ? 'bg-[#00C4AA]/5' : ''}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[11px] font-bold ${isToday(day) ? 'bg-[#00C4AA] text-[#0F1117] px-1.5 py-0.5 rounded-md' : isCurrentMonth ? 'text-[#8B8FA8]' : 'text-[#3E4268]'}`}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-0.5 overflow-y-auto custom-scrollbar max-h-[80px]">
                    {daySlots.map(slot => {
                      const color = getSlotColor(slot)
                      const booking = Array.isArray(slot.bookings) ? slot.bookings[0] : slot.bookings
                      const isSelected = selectedSlot?.id === slot.id

                      return (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot)}
                          className="text-[9px] font-bold py-1 px-1.5 rounded-md text-left truncate transition-all flex items-center gap-1.5 border border-transparent"
                          style={{ 
                            background: isSelected ? color : 'rgba(255,255,255,0.03)',
                            color: isSelected ? '#13161F' : color,
                            opacity: isCurrentMonth ? 1 : 0.5,
                            borderLeft: isSelected ? 'none' : `3px solid ${color}`
                          }}
                        >
                          <span className="opacity-70 flex-shrink-0">{format(new Date(slot.start_at), 'HH:mm')}</span>
                          <span className="truncate">{booking ? booking.customers.first_name : 'פנוי'}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-[#0F1117]/40 backdrop-blur-[2px] flex items-center justify-center z-40">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[#00C4AA]"></div>
          </div>
        )}
      </div>

      {/* Right Side: Order Detail Panel (30%) */}
      <div className="flex-[3] flex flex-col bg-[#1A1D27] rounded-3xl border border-[#2A2D3E] shadow-2xl overflow-hidden min-w-[340px]">
        {/* Room Picker Header */}
        <div className="p-6 bg-[#13161F] border-b border-[#2A2D3E]">
          <label className="block text-[10px] uppercase font-black text-[#555870] mb-3 tracking-widest">בחירת חדר</label>
          <div className="relative">
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full bg-[#1A1D27] text-[#E8EAFF] border border-[#2A2D3E] rounded-xl px-4 py-3 outline-none appearance-none cursor-pointer focus:border-[#00C4AA] font-bold text-sm shadow-inner"
            >
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#555870]">
              <ChevronDown size={18} />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {!selectedSlot ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <CalendarIcon size={48} className="mb-4 text-[#555870]" />
              <div className="text-[#8B8FA8] font-bold">בחר שעת משחק ביומן</div>
              <div className="text-xs text-[#555870] mt-1 italic">כדי לצפות ולהפעיל פרטי הזמנה</div>
            </div>
          ) : !activeBooking ? (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-[#2A2D3E]/30 border border-dashed border-[#2A2D3E] text-center">
                <div className="text-xs text-[#8B8FA8] uppercase font-bold mb-2">סלוט פנוי</div>
                <div className="text-2xl font-black text-[#E8EAFF] mb-1">
                  {format(new Date(selectedSlot.start_at), 'HH:mm')}
                </div>
                <div className="text-xs text-[#555870]">
                  {format(new Date(selectedSlot.start_at), 'dd MMMM yyyy', { locale: he })}
                </div>
              </div>
              <button className="w-full py-4 rounded-xl bg-[#00C4AA] text-[#0F1117] font-black text-sm transition-transform active:scale-95 shadow-lg shadow-[#00C4AA]/20">
                צור הזמנה ידנית
              </button>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Main Order Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest" style={{ background: activeBooking.status === 'confirmed' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: activeBooking.status === 'confirmed' ? '#10B981' : '#F59E0B' }}>
                    {activeBooking.status === 'confirmed' ? 'confirmed' : 'pending cc'}
                  </div>
                  <div className="text-[10px] text-[#555870] font-bold">ID: #{activeBooking.id.slice(0, 8)}</div>
                </div>
                <h2 className="text-3xl font-black text-[#E8EAFF] leading-none">
                  {activeBooking.customers.first_name} {activeBooking.customers.last_name}
                </h2>
                <div className="flex items-center gap-2 text-[#8B8FA8] text-sm font-medium">
                  <Clock size={14} />
                  <span>{format(new Date(selectedSlot.start_at), 'HH:mm')} | {format(new Date(selectedSlot.start_at), 'EEEE, d MMM', { locale: he })}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#13161F] border border-[#2A2D3E]">
                   <div className="flex items-center gap-2 text-[#555870] mb-2 uppercase text-[9px] font-black tracking-widest">
                     <Users size={12} /> משתתפים
                   </div>
                   <div className="text-xl font-black text-[#E8EAFF]">{activeBooking.participants_count}</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#13161F] border border-[#2A2D3E]">
                   <div className="flex items-center gap-2 text-[#555870] mb-2 uppercase text-[9px] font-black tracking-widest">
                     <CreditCard size={12} /> סה"כ לתשלום
                   </div>
                   <div className="text-xl font-black text-[#00C4AA]">₪{activeBooking.price_total}</div>
                </div>
              </div>

              {/* Customer Contact */}
              <div className="space-y-4">
                 <div className="text-[10px] uppercase font-black text-[#555870] tracking-widest py-1 border-b border-[#2A2D3E]">פרטי קשר</div>
                 <div className="space-y-3">
                   <div className="flex items-center gap-4 group">
                      <div className="w-10 h-10 rounded-xl bg-[#13161F] flex items-center justify-center text-[#8B8FA8] group-hover:text-[#00C4AA] transition-colors border border-[#2A2D3E]">
                        <Phone size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] text-[#555870] font-black uppercase mb-0.5">טלפון</div>
                        <div className="text-sm font-bold text-[#E8EAFF]">{activeBooking.customers.phone}</div>
                      </div>
                   </div>
                   <div className="flex items-center gap-4 group">
                      <div className="w-10 h-10 rounded-xl bg-[#13161F] flex items-center justify-center text-[#8B8FA8] group-hover:text-[#4A9EFF] transition-colors border border-[#2A2D3E]">
                        <Mail size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] text-[#555870] font-black uppercase mb-0.5">אימייל</div>
                        <div className="text-sm font-bold text-[#E8EAFF] truncate max-w-[180px]">{activeBooking.customers.email || '—'}</div>
                      </div>
                   </div>
                 </div>
              </div>

              {/* Notes */}
              <div className="space-y-4">
                 <div className="text-[10px] uppercase font-black text-[#555870] tracking-widest py-1 border-b border-[#2A2D3E]">הערות להזמנה</div>
                 <div className="p-4 rounded-2xl bg-[#13161F] border border-[#2A2D3E] text-sm text-[#8B8FA8] italic">
                   {activeBooking.notes || 'אין הערות ללקוח'}
                 </div>
                 {activeBooking.internal_notes && (
                   <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 text-sm text-[#F87171]">
                     <div className="text-[10px] font-black uppercase mb-2 flex items-center gap-2"><Info size={12} /> הערה פנימית</div>
                     {activeBooking.internal_notes}
                   </div>
                 )}
              </div>

              {/* Actions */}
              <div className="pt-4 flex flex-col gap-3">
                 <button className="w-full py-4 rounded-xl bg-[#13161F] text-[#E8EAFF] font-black text-sm border border-[#2A2D3E] hover:bg-[#22253A] transition-all flex items-center justify-center gap-2">
                   <ExternalLink size={16} /> ערוך הזמנה
                 </button>
                 <button className="w-full py-4 rounded-xl bg-red-500/10 text-[#F87171] font-black text-sm border border-red-500/20 hover:bg-red-500/20 transition-all">
                   ביטול הזמנה
                 </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2A2D3E;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3E4268;
        }
      `}</style>
    </div>
  )
}
