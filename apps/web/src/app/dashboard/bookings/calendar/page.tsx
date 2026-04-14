'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { 
  format, 
  addMonths, 
  subMonths, 
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isToday,
  startOfWeek,
  endOfWeek,
  isSameMonth
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
  Info,
  ChevronDown,
  Search,
  LayoutGrid,
  Columns,
  ListTodo
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
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const [groupedRooms, setGroupedRooms] = useState<Record<string, Room[]>>({})
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  
  const supabase = createClient()

  // 1. Load ALL Rooms and group them by branch
  useEffect(() => {
    async function fetchAllRooms() {
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*, branches(name)')
        .eq('status', 'active')
        .order('display_order')

      if (roomsData) {
        setRooms(roomsData)
        const groups: Record<string, Room[]> = {}
        roomsData.forEach((r: any) => {
          const branchName = r.branches?.name || 'Uncategorized'
          if (!groups[branchName]) groups[branchName] = []
          groups[branchName].push(r)
        })
        setGroupedRooms(groups)

        const firstBranch = Object.keys(groups)[0]
        if (firstBranch && groups[firstBranch].length > 0 && !selectedRoomId) {
          setSelectedRoomId(groups[firstBranch][0].id)
        }
      }
    }
    fetchAllRooms()
  }, [])

  // 2. Load Slots when Room/Date/View changes
  const fetchSlots = useCallback(async () => {
    if (!selectedRoomId) {
      setSlots([])
      setLoading(false)
      return
    }

    setLoading(true)
    let start, end;
    if (viewMode === 'month') {
      start = format(startOfWeek(startOfMonth(currentDate)), 'yyyy-MM-dd')
      end = format(endOfWeek(endOfMonth(currentDate)), 'yyyy-MM-dd')
    } else if (viewMode === 'week') {
      start = format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'yyyy-MM-dd')
      end = format(endOfWeek(currentDate, { weekStartsOn: 0 }), 'yyyy-MM-dd')
    } else {
      start = format(currentDate, 'yyyy-MM-dd')
      end = format(currentDate, 'yyyy-MM-dd')
    }

    try {
      const res = await fetch(`/api/bookings/calendar?room_id=${selectedRoomId}&start_date=${start}&end_date=${end}`)
      const { data } = await res.json()
      setSlots(data || [])
    } catch (e) {
      console.error('Failed to fetch slots:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedRoomId, currentDate, viewMode])

  useEffect(() => {
    fetchSlots()
  }, [fetchSlots])

  // --- Date Math ---
  const days = useMemo(() => {
    if (viewMode === 'month') {
      return eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentDate)),
        end: endOfWeek(endOfMonth(currentDate))
      })
    } else if (viewMode === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 })
      })
    } else {
      return [currentDate]
    }
  }, [currentDate, viewMode])

  const getSlotsForDay = (day: Date) => {
    return slots.filter(s => isSameDay(new Date(s.start_at), day))
  }

  const getSlotColor = (slot: Slot) => {
    const booking = Array.isArray(slot.bookings) ? slot.bookings[0] : slot.bookings
    if (slot.status === 'cancelled' || booking?.status === 'cancelled') return '#EF4444' // Red
    if (slot.status === 'available') return '#2A2D3E' // Grey
    if (slot.status === 'pending' || booking?.status === 'pending') return '#000000' // Black
    if (booking?.status === 'confirmed' || slot.status === 'booked') return '#10B981' // Green
    return '#4A9EFF'
  }

  const activeBooking = useMemo(() => {
    if (!selectedSlot?.bookings) return null
    return Array.isArray(selectedSlot.bookings) ? selectedSlot.bookings[0] : selectedSlot.bookings
  }, [selectedSlot])

  return (
    <div className="flex flex-col xl:flex-row h-[calc(100vh-140px)] gap-6 overflow-hidden">
      {/* 🚀 LEFT SIDE: CALENDAR AREA */}
      <div className="flex-[7] flex flex-col bg-[#1A1D27] rounded-3xl border border-[#2A2D3E] shadow-2xl overflow-hidden relative">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between p-6 gap-4 border-b border-[#2A2D3E]">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-1 bg-[#13161F] p-1 rounded-xl border border-[#2A2D3E]">
               <button onClick={() => {
                  if (viewMode === 'month') setCurrentDate(prev => subMonths(prev, 1))
                  else if (viewMode === 'week') setCurrentDate(prev => subWeeks(prev, 1))
                  else setCurrentDate(prev => subDays(prev, 1))
               }} className="p-2 hover:bg-[#22253A] rounded-lg text-[#8B8FA8]">
                 <ChevronRight size={20} />
               </button>
               <div className="px-4 text-xs font-black text-[#E8EAFF] min-w-[140px] text-center uppercase tracking-wider">
                 {viewMode === 'month' ? format(currentDate, 'MMMM yyyy', { locale: he }) : 
                  viewMode === 'week' ? `שבוע ה-${format(currentDate, 'd MMM', { locale: he })}` :
                  format(currentDate, 'EEEE, d MMM', { locale: he })}
               </div>
               <button onClick={() => {
                  if (viewMode === 'month') setCurrentDate(prev => addMonths(prev, 1))
                  else if (viewMode === 'week') setCurrentDate(prev => addWeeks(prev, 1))
                  else setCurrentDate(prev => addDays(prev, 1))
               }} className="p-2 hover:bg-[#22253A] rounded-lg text-[#8B8FA8]">
                 <ChevronLeft size={20} />
               </button>
             </div>
             <button onClick={() => fetchSlots()} className="p-2.5 rounded-xl border border-[#2A2D3E] bg-[#13161F] text-[#00C4AA]"><Search size={18} /></button>
          </div>

          <div className="flex bg-[#13161F] p-1 rounded-xl border border-[#2A2D3E]">
            {(['month', 'week', 'day'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all flex items-center gap-2 ${viewMode === mode ? 'bg-[#2A2D3E] text-[#00C4AA] shadow-lg' : 'text-[#555870] hover:text-[#8B8FA8]'}`}
              >
                {mode === 'month' ? <LayoutGrid size={14} /> : mode === 'week' ? <Columns size={14} /> : <ListTodo size={14} />}
                <span>{mode === 'month' ? 'MONTH' : mode === 'week' ? 'WEEK' : 'DAY'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Calendar Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
           {(viewMode === 'month' || viewMode === 'week') && (
             <div className="grid grid-cols-7 border-b border-[#2A2D3E] bg-[#13161F]">
               {HEBREW_DAYS.map(day => (
                 <div key={day} className="py-2.5 text-center text-[10px] font-black text-[#555870] uppercase tracking-widest">{day}</div>
               ))}
             </div>
           )}

           <div className={`flex-1 overflow-y-auto custom-scrollbar ${viewMode === 'month' ? 'grid grid-cols-7' : viewMode === 'week' ? 'grid grid-cols-7' : 'p-6 flex flex-col gap-4'}`}>
              {days.map((day, idx) => {
                const daySlots = getSlotsForDay(day)
                const isCurrMonth = isSameMonth(day, currentDate)
                
                if (viewMode === 'day') {
                   return (
                     <div key={idx} className="space-y-4 max-w-4xl mx-auto w-full">
                       {daySlots.length === 0 ? <div className="py-20 text-center text-[#555870] italic">אין משחקים</div> :
                        daySlots.map(s => <AgendaItem key={s.id} slot={s} onClick={() => setSelectedSlot(s)} isSelected={selectedSlot?.id === s.id} color={getSlotColor(s)} />)}
                     </div>
                   )
                }

                return (
                  <div key={idx} className={`border-b border-l border-[#2A2D3E] p-1.5 min-h-[120px] flex flex-col gap-1 transition-colors ${!isCurrMonth && viewMode === 'month' ? 'bg-[#13161F]/40' : 'bg-transparent'} ${isToday(day) ? 'bg-[#00C4AA]/5' : ''}`}>
                    <div className="flex justify-between items-center mb-1"><span className={`text-[10px] font-black ${isToday(day) ? 'text-[#00C4AA]' : isCurrMonth ? 'text-[#8B8FA8]' : 'text-[#3E4268]'}`}>{format(day, 'd')}</span></div>
                    <div className="flex flex-col gap-0.5 overflow-y-auto custom-scrollbar max-h-full">
                      {daySlots.map(slot => {
                        const color = getSlotColor(slot)
                        const booking = Array.isArray(slot.bookings) ? slot.bookings[0] : slot.bookings
                        const isSelected = selectedSlot?.id === slot.id
                        
                        // Monthly Summary optimization: Show dots if many slots, or keep them if manageable
                        if (viewMode === 'month' && daySlots.length > 5 && !booking) return null;

                        return (
                          <button key={slot.id} onClick={() => setSelectedSlot(slot)} 
                            className="text-[9px] font-black py-1 px-2 rounded-md transition-all flex items-center justify-between border border-transparent shadow-sm"
                            style={{ 
                              background: isSelected ? color : 'rgba(255,255,255,0.03)',
                              color: isSelected ? (color === '#000000' || color === '#2A2D3E' ? '#FFF' : '#13161F') : (color === '#000000' ? '#FFF' : color),
                              borderRight: `3px solid ${color}`,
                            }}
                          >
                            <span className="flex-shrink-0 opacity-80">{format(new Date(slot.start_at), 'HH:mm')}</span>
                            {(viewMode === 'week' || booking) && <span className="truncate mr-2 text-right flex-1">{booking ? booking.customers.first_name : 'FREE'}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
           </div>
        </div>

        {loading && <div className="absolute inset-0 bg-[#0F1117]/60 backdrop-blur-[4px] flex items-center justify-center z-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[#00C4AA]"></div></div>}
      </div>

      {/* 🔍 RIGHT SIDE: INSPECTOR */}
      <div className="flex-[3] flex flex-col bg-[#1A1D27] rounded-3xl border border-[#2A2D3E] shadow-2xl overflow-hidden min-w-[340px]">
        <div className="p-6 border-b border-[#2A2D3E] bg-[#13161F]/50">
          <label className="block text-[10px] font-black text-[#555870] uppercase tracking-widest mb-3">בחירת חדר</label>
          <div className="relative">
            <select value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)} className="w-full bg-[#1A1D27] text-[#E8EAFF] text-sm font-bold py-3.5 px-4 rounded-xl border border-[#2A2D3E] appearance-none focus:border-[#00C4AA] transition-all">
              {Object.entries(groupedRooms).map(([branchName, branchRooms]) => (
                <optgroup key={branchName} label={branchName} className="bg-[#13161F] text-[#8B8FA8]">
                  {branchRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </optgroup>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#555870]"><ChevronDown size={18} /></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {!selectedSlot ? <div className="h-full flex flex-col items-center justify-center opacity-40"><CalendarIcon size={48} className="mb-4 text-[#555870]"/><div className="text-[10px] font-black uppercase tracking-widest">בחר שעה</div></div> :
           !activeBooking ? <div className="space-y-6"><div className="p-6 rounded-2xl bg-[#13161F] border border-dashed border-[#2A2D3E] text-center"><div className="text-[10px] text-[#555870] font-black mb-3">סלוט פנוי</div><div className="text-4xl font-black text-[#E8EAFF]">{format(new Date(selectedSlot.start_at), 'HH:mm')}</div></div><button className="w-full py-4 rounded-xl bg-[#00C4AA] text-[#0F1117] font-black text-[10px] uppercase tracking-widest">צור הזמנה ידנית</button></div> :
           <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="space-y-2">
               <div className="flex justify-between items-center"><div className="px-3 py-1 rounded-full text-[10px] font-black uppercase" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>{activeBooking.status}</div><div className="text-[10px] text-[#555870] font-bold">ID: #{activeBooking.id.slice(0, 8)}</div></div>
               <h2 className="text-3xl font-black text-[#E8EAFF]">{activeBooking.customers.first_name} {activeBooking.customers.last_name}</h2>
               <div className="flex items-center gap-2 text-[#00C4AA] text-[10px] font-black uppercase tracking-widest pt-2"><Clock size={12} /><span>{format(new Date(selectedSlot.start_at), 'HH:mm')} | {format(new Date(selectedSlot.start_at), 'EEEE', { locale: he })}</span></div>
             </div>
             <div className="grid grid-cols-2 gap-3">
               <div className="p-4 rounded-xl bg-[#13161F] border border-[#2A2D3E]"><div className="text-[9px] font-black text-[#555870] uppercase mb-2">משתתפים</div><div className="text-lg font-black text-[#E8EAFF]">{activeBooking.participants_count}</div></div>
               <div className="p-4 rounded-xl bg-[#13161F] border border-[#2A2D3E]"><div className="text-[9px] font-black text-[#555870] uppercase mb-2">סה"כ</div><div className="text-lg font-black text-[#00C4AA]">₪{activeBooking.price_total}</div></div>
             </div>
             <div className="space-y-4">
               <div className="text-[10px] font-black text-[#555870] uppercase tracking-widest border-b border-[#2A2D3E] pb-2">פרטי קשר</div>
               <div className="text-sm font-bold text-[#E8EAFF]">{activeBooking.customers.phone}</div>
               <div className="text-sm font-bold text-[#E8EAFF]">{activeBooking.customers.email || '—'}</div>
             </div>
             <div className="p-4 rounded-xl bg-[#13161F] text-xs text-[#8B8FA8] italic leading-relaxed">{activeBooking.notes || 'אין הערות'}</div>
           </div>}
        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2A2D3E; border-radius: 10px; }
      `}</style>
    </div>
  )
}

function AgendaItem({ slot, onClick, isSelected, color }: any) {
  const booking = Array.isArray(slot.bookings) ? slot.bookings[0] : slot.bookings
  return (
    <button onClick={onClick} className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 ${isSelected ? 'ring-2 ring-inset ring-[#00C4AA]' : ''}`} style={{ background: '#13161F', borderColor: isSelected ? '#00C4AA' : '#2A2D3E' }}>
       <div className="w-16 h-16 rounded-xl flex items-center justify-center font-black text-xl" style={{ background: color, color: color === '#000000' ? '#FFF' : '#13161F' }}>{format(new Date(slot.start_at), 'HH:mm')}</div>
       <div className="flex-1 text-right">
          <div className="text-sm font-black text-[#E8EAFF] mb-0.5">{booking ? `${booking.customers.first_name} ${booking.customers.last_name}` : 'סלוט פנוי'}</div>
          <div className="text-[10px] font-black text-[#555870] uppercase tracking-widest">{booking ? booking.status : 'AVAILABLE'}</div>
       </div>
    </button>
  )
}
