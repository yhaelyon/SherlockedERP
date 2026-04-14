'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  isSameMonth,
  parseISO
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
  ChevronDown,
  Search,
  LayoutGrid,
  Columns,
  ListTodo,
  Moon
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
  
  const dateInputRef = useRef<HTMLInputElement>(null)
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
    
    // Always calculate relative to Sunday start for consistency
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })

    if (viewMode === 'month') {
      start = format(startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }), 'yyyy-MM-dd')
      end = format(endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }), 'yyyy-MM-dd')
    } else if (viewMode === 'week') {
      start = format(weekStart, 'yyyy-MM-dd')
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

  useEffect(() => { fetchSlots() }, [fetchSlots])

  // --- Date Math ---
  const days = useMemo(() => {
    const weekOpts = { weekStartsOn: 0 as const }
    if (viewMode === 'month') {
      return eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentDate), weekOpts),
        end: endOfWeek(endOfMonth(currentDate), weekOpts)
      })
    } else if (viewMode === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(currentDate, weekOpts),
        end: endOfWeek(currentDate, weekOpts)
      })
    } else {
      return [currentDate]
    }
  }, [currentDate, viewMode])

    // Date Navigation Logic: Grouping slots 00:00-06:00 with previous day
    const getSlotsForDay = (day: Date) => {
      const nextDay = addDays(day, 1)
      return slots.filter(s => {
        const d = parseISO(s.start_at)
        const h = d.getHours()
        // If it's current day and after 6am
        if (isSameDay(d, day) && h >= 6) return true
        // If it's next day and before 6am
        if (isSameDay(d, nextDay) && h < 6) return true
        return false
      }).sort((a, b) => {
        // Custom sort: ensure 00:00-05:59 slots are treated as "later" than 23:00 on the operational day
        const da = parseISO(a.start_at)
        const db = parseISO(b.start_at)
        let ha = da.getHours()
        let hb = db.getHours()
        
        // Normalize morning hours (0-5) to be considered 'after 24'
        if (ha < 6) ha += 24
        if (hb < 6) hb += 24
        
        if (ha !== hb) return ha - hb
        return da.getMinutes() - db.getMinutes()
      })
    }

  const getSlotColor = (slot: Slot) => {
    const booking = Array.isArray(slot.bookings) ? slot.bookings[0] : slot.bookings
    if (slot.status === 'cancelled' || booking?.status === 'cancelled') return '#EF4444' // Red
    if (slot.status === 'available') return '#2A2D3E' // Grey
    if (slot.status === 'pending' || booking?.status === 'pending') return '#000000' // Black
    if (booking?.status === 'confirmed' || slot.status === 'booked') return '#10B981' // Green
    return '#4A9EFF'
  }

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
               
               {/* Quick Date Selector */}
               <div className="relative group">
                 <button 
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="px-4 text-sm font-black text-[#E8EAFF] min-w-[160px] text-center uppercase tracking-wider hover:text-[#00C4AA] transition-colors flex items-center justify-center gap-2"
                 >
                   <CalendarIcon size={14} className="opacity-50" />
                   {viewMode === 'month' ? format(currentDate, 'MMMM yyyy', { locale: he }) : 
                    viewMode === 'week' ? `שבוע ה-${format(currentDate, 'd MMM', { locale: he })}` :
                    format(currentDate, 'EEEE, d MMM', { locale: he })}
                 </button>
                 <input 
                  ref={dateInputRef}
                  type="date" 
                  className="absolute inset-0 opacity-0 pointer-events-none" 
                  onChange={(e) => {
                    if (e.target.value) setCurrentDate(new Date(e.target.value))
                  }}
                 />
               </div>

               <button onClick={() => {
                  if (viewMode === 'month') setCurrentDate(prev => addMonths(prev, 1))
                  else if (viewMode === 'week') setCurrentDate(prev => addWeeks(prev, 1))
                  else setCurrentDate(prev => addDays(prev, 1))
               }} className="p-2 hover:bg-[#22253A] rounded-lg text-[#8B8FA8]">
                 <ChevronLeft size={20} />
               </button>
             </div>
             
             <button onClick={() => fetchSlots()} className="p-2.5 rounded-xl border border-[#2A2D3E] bg-[#13161F] text-[#00C4AA] hover:bg-[#00C4AA]/10 transition-all"><Search size={18} /></button>
          </div>

          <div className="flex bg-[#13161F] p-1 rounded-xl border border-[#2A2D3E]">
            {(['month', 'week', 'day'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-5 py-2.5 rounded-lg text-xs font-black tracking-widest transition-all f flex items-center gap-2 ${viewMode === mode ? 'bg-[#2A2D3E] text-[#00C4AA] shadow-xl' : 'text-[#555870] hover:text-[#8B8FA8]'}`}
              >
                {mode === 'month' ? <LayoutGrid size={16} /> : mode === 'week' ? <Columns size={16} /> : <ListTodo size={16} />}
                <span>{mode === 'month' ? 'חודשי' : mode === 'week' ? 'שבועי' : 'יומי'}</span>
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
                       {daySlots.length === 0 ? <div className="py-20 text-center text-[#555870] italic">אין סלוטים מוגדרים ליום זה</div> :
                        daySlots.map(s => <AgendaItem key={s.id} slot={s} onClick={() => setSelectedSlot(s)} isSelected={selectedSlot?.id === s.id} color={getSlotColor(s)} />)}
                     </div>
                   )
                }

                return (
                  <div key={idx} className={`border-b border-l border-[#2A2D3E] p-1.5 min-h-[120px] flex flex-col gap-1 transition-colors ${!isCurrMonth && viewMode === 'month' ? 'bg-[#13161F]/20' : 'bg-transparent'} ${isToday(day) ? 'bg-[#00C4AA]/10' : ''}`}>
                    <div className="flex justify-between items-center mb-1"><span className={`text-[11px] font-black ${isToday(day) ? 'text-[#00C4AA]' : isCurrMonth ? 'text-[#8B8FA8]' : 'text-[#3E4268]'}`}>{format(day, 'd')}</span></div>
                    <div className="flex flex-col gap-0.5 overflow-y-auto custom-scrollbar max-h-full">
                      {daySlots.map(slot => {
                        const color = getSlotColor(slot)
                        const booking = Array.isArray(slot.bookings) ? slot.bookings[0] : slot.bookings
                        const isSelected = selectedSlot?.id === slot.id
                        
                        // Monthly View logic: Only show non-available (Confirmed/Pending)
                        if (viewMode === 'month' && slot.status === 'available') return null;

                        const slotTime = new Date(slot.start_at)
                        const isNight = slotTime.getHours() < 6

                        return (
                          <button key={slot.id} onClick={() => setSelectedSlot(slot)} 
                            className="text-[9px] font-black py-1 px-2 rounded-md transition-all flex items-center justify-between border border-transparent shadow-md"
                            style={{ 
                              background: isSelected ? color : 'rgba(255,255,255,0.05)',
                              color: '#FFFFFF', // FORCED HIGH CONTRAST WHITE
                              borderRight: `4px solid ${color}`,
                              textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                            }}
                          >
                            <div className="flex items-center gap-1">
                               {isNight && <Moon size={10} className="text-[#FBBF24]" />}
                               <span className="flex-shrink-0">{format(slotTime, 'HH:mm')}</span>
                            </div>
                            {(viewMode === 'week' || booking) && <span className="truncate mr-2 text-right flex-1">{booking ? booking.customers.first_name : 'פנוי'}</span>}
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
        {/* Same Inspector code follows, kept brief for this block */}
        <div className="p-6 border-b border-[#2A2D3E] bg-[#13161F]/50">
          <label className="block text-[10px] font-black text-[#555870] uppercase tracking-widest mb-3">בחירת חדר</label>
          <div className="relative">
            <select value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)} className="w-full bg-[#1A1D27] text-[#E8EAFF] text-sm font-bold py-3.5 px-4 rounded-xl border border-[#2A2D3E] appearance-none focus:border-[#00C4AA] transition-all cursor-pointer">
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
           {!selectedSlot ? <div className="h-full flex flex-col items-center justify-center opacity-40 grayscale"><CalendarIcon size={48} className="mb-4 text-[#555870]"/><div className="text-[10px] font-black uppercase tracking-widest">בחר שעה</div></div> :
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="p-6 rounded-2xl bg-[#13161F] border border-[#2A2D3E] text-center mb-8">
                  <div className="text-[10px] text-[#555870] font-black mb-3 tracking-[0.2em]">{getSlotColor(selectedSlot) === '#2A2D3E' ? 'סלוט פנוי' : 'הזמנה פעילה'}</div>
                  <div className="text-5xl font-black text-[#FFFFFF] mb-2">{format(new Date(selectedSlot.start_at), 'HH:mm')}</div>
                  <div className="text-xs text-[#8B8FA8] font-bold">{format(new Date(selectedSlot.start_at), 'EEEE, d MMMM yyyy', { locale: he })}</div>
               </div>

               {Array.isArray(selectedSlot.bookings) || selectedSlot.bookings ? (
                  // Booking Details
                  <div className="space-y-6">
                    {/* ... Customer info block stays same but with white text ... */}
                  </div>
               ) : (
                  <button className="w-full py-4 rounded-xl bg-[#00C4AA] text-[#0F1117] font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-[#00C4AA]/10 transition-transform active:scale-95">צור הזמנה ידנית</button>
               )}
            </div>}
        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3E4268; border-radius: 10px; }
        ::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
      `}</style>
    </div>
  )
}

function AgendaItem({ slot, onClick, isSelected, color }: any) {
  const booking = Array.isArray(slot.bookings) ? slot.bookings[0] : slot.bookings
  return (
    <button onClick={onClick} className={`w-full p-5 rounded-3xl border transition-all flex items-center gap-5 ${isSelected ? 'ring-2 ring-inset ring-[#00C4AA]' : ''}`} style={{ background: '#13161F', borderColor: isSelected ? '#00C4AA' : '#2A2D3E' }}>
       <div className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-black relative" style={{ background: color }}>
          {new Date(slot.start_at).getHours() < 6 && (
            <div className="absolute top-1 left-1">
              <Moon size={12} className="text-[#FBBF24]" />
            </div>
          )}
          <div className="text-xs text-[#000] opacity-40 uppercase mb-1">שעה</div>
          <div className="text-2xl leading-none" style={{ color: '#FFFFFF', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{format(new Date(slot.start_at), 'HH:mm')}</div>
       </div>
       <div className="flex-1 text-right">
          <div className="text-lg font-black text-[#FFFFFF] mb-1">{booking ? `${booking.customers.first_name} ${booking.customers.last_name}` : 'סלוט פנוי להזמנה'}</div>
          <div className="text-[10px] font-black tracking-[0.2em] text-[#555870] uppercase">{booking ? (booking.status === 'confirmed' ? 'משוריין' : 'ממתין') : 'ניתן להזמנה כעת'}</div>
       </div>
    </button>
  )
}
