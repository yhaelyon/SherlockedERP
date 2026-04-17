'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { format, addDays } from 'date-fns'
import { Calendar, Save, Trash2, Plus, Moon, AlertTriangle } from 'lucide-react'

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

interface Branch { id: string, name: string }
interface Room { id: string, name: string }
interface TimeSlot { time: string, is_next_day: boolean }

export default function EnhancedCalendarBuilder() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  
  // Phase 2: Multi-select days
  const [selectedDays, setSelectedDays] = useState<number[]>([0])
  
  // templates object: map of room_id to TimeSlot[] representing the BASELINE
  const [templates, setTemplates] = useState<Record<string, TimeSlot[]>>({})
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ text: '', type: 'info', title: '' })
  const [savingSettings, setSavingSettings] = useState(false)

  // Sync state
  const [syncStartDate, setSyncStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [syncEndDate, setSyncEndDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  const [syncing, setSyncing] = useState(false)
  const [conflicts, setConflicts] = useState<any[]>([])
  const [autofillInterval, setAutofillInterval] = useState(90)

  const supabase = createClient()

  // Load Base Data
  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: bData } = await supabase.from('branches').select('id, name')
    if (bData && bData.length) {
      const filtered = bData.filter(b => b.name !== 'בדיקה GPS')
      setBranches(filtered)
      if (filtered.length > 0) {
        setSelectedBranchId(filtered[0].id)
      }
    }
  }, [supabase])

  // Load Rooms & Templates when Branch or PRIMARY Day changes
  useEffect(() => {
    if (!selectedBranchId) return

    async function fetchRoomsAndTemplates() {
      // 1. Fetch active rooms for branch
      const { data: rData } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('branch_id', selectedBranchId)
        .eq('status', 'active')
        .order('display_order', { ascending: true })
      
      const activeRooms = rData || []
      setRooms(activeRooms)

      if (activeRooms.length === 0) {
        setTemplates({})
        setLoading(false)
        return
      }

      // 2. We use the FIRST selected day as the visual baseline template
      const primaryDay = selectedDays.length > 0 ? selectedDays[0] : 0

      const { data: tData } = await supabase
        .from('room_weekly_templates')
        .select('room_id, time_slots')
        .eq('day_of_week', primaryDay)
        .in('room_id', activeRooms.map(r => r.id))

      const tMap: Record<string, TimeSlot[]> = {}
      activeRooms.forEach(r => { tMap[r.id] = [] })

      tData?.forEach(row => {
        let slots: TimeSlot[] = row.time_slots || []
        slots.sort((a, b) => {
          if (a.is_next_day && !b.is_next_day) return 1
          if (!a.is_next_day && b.is_next_day) return -1
          return a.time.localeCompare(b.time)
        })
        tMap[row.room_id] = slots
      })

      // PRESET LOGIC: If a room has no slots, inject the default first slot from the blueprint
      const blueprint: Record<string, string> = {
        'אנתרקס': '09:30',
        'משימת שרלוק': '08:30',
        'מסעות גוליבר': '08:30',
        'אוז': '09:00',
        'חץ וקשת': '09:30',
        'VR': '08:30',
        'מיתוס': '10:15',
        'השאגה': '09:00',
        'הקלף של ג׳ק': '09:30',
        'השוקולד של טדי': '08:30'
      }

      activeRooms.forEach(room => {
        if (!tMap[room.id] || tMap[room.id].length === 0) {
          const defaultTime = blueprint[room.name] || '09:00'
          tMap[room.id] = [{ time: defaultTime, is_next_day: false }]
        }
      })

      setTemplates(tMap)
      setLoading(false)
    }

    fetchRoomsAndTemplates()
  }, [selectedBranchId, selectedDays[0], supabase])

  useEffect(() => { loadData() }, [loadData])

  function showMsg(text: string, type: 'success' | 'error' | 'info' | 'warning', title: string = '') {
    setMsg({ text, type, title })
    setTimeout(() => setMsg({ text: '', type: 'info', title: '' }), 8000)
  }

  function toggleDay(idx: number) {
    if (selectedDays.includes(idx)) {
      if (selectedDays.length === 1) return // Prevent deselecting the last day
      setSelectedDays(prev => prev.filter(d => d !== idx).sort())
    } else {
      setSelectedDays(prev => [...prev, idx].sort())
    }
  }

  function updateSlots(roomId: string, newSlots: TimeSlot[]) {
    newSlots.sort((a, b) => {
      if (a.is_next_day && !b.is_next_day) return 1
      if (!a.is_next_day && b.is_next_day) return -1
      return a.time.localeCompare(b.time)
    })
    setTemplates(prev => ({ ...prev, [roomId]: newSlots }))
  }

  function addSlot(roomId: string) {
    const slots = [...templates[roomId]]
    const lastSlot = slots.length > 0 ? slots[slots.length - 1] : null
    
    if (lastSlot) {
      const [h, m] = lastSlot.time.split(':').map(Number)
      let totalMins = h * 60 + m + autofillInterval
      const newH = Math.floor(totalMins / 60)
      const newM = totalMins % 60
      const clockH = newH % 24
      const isNextDay = lastSlot.is_next_day || newH >= 24
      const timeStr = `${String(clockH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
      slots.push({ time: timeStr, is_next_day: isNextDay })
    } else {
      slots.push({ time: '09:00', is_next_day: false })
    }
    updateSlots(roomId, slots)
  }

  function clearColumnExceptFirst(roomId: string) {
    if (templates[roomId] && templates[roomId].length > 1) {
      setTemplates(prev => ({ ...prev, [roomId]: [prev[roomId][0]] }))
    }
  }

  function removeSlot(roomId: string, idx: number) {
    const slots = [...templates[roomId]]
    slots.splice(idx, 1)
    updateSlots(roomId, slots)
  }

  function handleSlotChange(roomId: string, idx: number, field: keyof TimeSlot, value: any) {
    const slots = [...templates[roomId]]
    slots[idx] = { ...slots[idx], [field]: value }
    updateSlots(roomId, slots)
  }

  async function handleSaveAndSync() {
    setSavingSettings(true)
    setSyncing(true)
    setConflicts([])
    showMsg(`שומר תבניות ומסנכרן יומן עבור התאריכים ${syncStartDate} עד ${syncEndDate}...`, 'info', 'סנכרון בתהליך')

    try {
      let errors = 0
      // 1. Save Templates
      for (const day of selectedDays) {
        for (const roomId of Object.keys(templates)) {
          const res = await fetch('/api/admin/slots/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id: roomId, day_of_week: day, time_slots: templates[roomId] })
          })
          if (!res.ok) errors++
        }
      }

      if (errors > 0) throw new Error(`${errors} שגיאות אירעו במהלך השמירה`)

      // 2. Automatically Sync to Calendar
      const genRes = await fetch('/api/admin/slots/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: selectedBranchId, start_date: syncStartDate, end_date: syncEndDate })
      })
      const genData = await genRes.json()
      if (!genRes.ok) throw new Error(genData.details || genData.error || 'Sync failed')
      
      setConflicts(genData.conflicts || [])
      
      if (genData.conflicts && genData.conflicts.length > 0) {
        showMsg(`התבניות נשמרו והיומן סונכרן (נמחקו ${genData.deleted} סלוטים מיותרים). שים לב: נמצאו ${genData.conflicts.length} קונפליקטים!`, 'warning', 'סנכרון עם קונפליקטים')
      } else {
        showMsg(`סנכרון הושלם בהצלחה! התבניות נשמרו והיומן עודכן לטווח התאריכים שנבחר. ✅`, 'success', 'תהליך הסתיים')
      }
    } catch (e: any) {
      showMsg(e.message, 'error', 'שגיאת תהליך')
    } finally {
      setSavingSettings(false)
      setSyncing(false)
    }
  }

  function autoFillRoom(roomId: string) {
    const slots = [...(templates[roomId] || [])]
    if (slots.length === 0) return

    // Take the first slot as seed
    const firstSlot = slots[0]
    const [hStr, mStr] = firstSlot.time.split(':')
    let totalMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10)
    
    let newRoomSlots: TimeSlot[] = [firstSlot]
    
    // Add 11 more slots (total 12)
    for (let i = 0; i < 11; i++) {
      totalMins += autofillInterval
      const newH = Math.floor(totalMins / 60)
      const newM = totalMins % 60
      
      const clockH = newH % 24
      const isNextDay = newH >= 24 || (firstSlot.is_next_day && i === 0) // simplify check
      
      const timeStr = `${String(clockH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
      newRoomSlots.push({ time: timeStr, is_next_day: isNextDay })
    }

    setTemplates(prev => ({ ...prev, [roomId]: newRoomSlots }))
  }

   // Combined logic is now in handleSaveAndSync

  if (loading && branches.length === 0) return <div className="min-h-screen p-6 flex justify-center text-[#8B8FA8]">טוען ממשק...</div>

  return (
    <div className="pb-40 w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#E8EAFF] mb-2 tracking-tight">ניהול מערך היומן</h1>
          <p className="text-[#8B8FA8] text-base">הגדרת זמני כניסה מדויקים ויצירת תבניות למערכת ההזמנות</p>
        </div>
      </div>

      {msg.text && (
        <div 
          className="mb-8 px-5 py-4 rounded-xl shadow-lg border"
          style={{ 
            background: msg.type === 'error' ? 'rgba(239,68,68,0.1)' : msg.type === 'success' ? 'rgba(16,185,129,0.1)' : msg.type === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(139,143,168,0.1)',
            borderColor: msg.type === 'error' ? 'rgba(239,68,68,0.3)' : msg.type === 'success' ? 'rgba(16,185,129,0.3)' : msg.type === 'warning' ? 'rgba(245,158,11,0.3)' : 'rgba(139,143,168,0.3)'
          }}
        >
          {msg.title && <h3 className="font-bold mb-1" style={{ color: msg.type === 'error' ? '#F87171' : msg.type === 'success' ? '#10B981' : msg.type === 'warning' ? '#FBBF24' : '#E8EAFF' }}>{msg.title}</h3>}
          <p className="text-sm opacity-90" style={{ color: msg.type === 'error' ? '#F87171' : msg.type === 'success' ? '#10B981' : msg.type === 'warning' ? '#FBBF24' : '#E8EAFF' }}>{msg.text}</p>
        </div>
      )}

      {/* Top Controls: Branch & Day Selectors */}
      <div className="flex flex-col xl:flex-row gap-6 mb-8 p-6 rounded-2xl shadow-md" style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}>
        
        {/* Branch */}
        <div className="flex-shrink-0">
          <label className="block text-xs text-[#8B8FA8] mb-3 uppercase tracking-wider font-bold">סניף</label>
          <div className="flex gap-2 bg-[#13161F] p-1.5 rounded-xl w-fit">
            {branches.map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBranchId(b.id)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:bg-white/5"
                style={{
                  background: selectedBranchId === b.id ? 'linear-gradient(135deg, rgba(0,196,170,0.2) 0%, rgba(0,196,170,0.05) 100%)' : 'transparent',
                  color: selectedBranchId === b.id ? '#00C4AA' : '#8B8FA8',
                  border: `1px solid ${selectedBranchId === b.id ? 'rgba(0,196,170,0.3)' : 'transparent'}`
                }}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* Day of Week Multi-Select Tabs */}
        <div className="flex-1">
          <label className="block text-xs text-[#8B8FA8] mb-3 uppercase tracking-wider font-bold">החל על ימים (ניתן לבחור מרובים)</label>
          <div className="flex flex-wrap gap-2.5">
            {HEBREW_DAYS.map((day, idx) => {
              const isSelected = selectedDays.includes(idx);
              return (
                <button
                  key={idx}
                  onClick={() => toggleDay(idx)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border"
                  style={{
                    background: isSelected ? '#22253A' : '#13161F',
                    color: isSelected ? '#E8EAFF' : '#555870',
                    borderColor: isSelected ? '#4A9EFF' : '#2A2D3E',
                    boxShadow: isSelected ? '0 0 15px rgba(74,158,255,0.15)' : 'none'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: isSelected ? '#4A9EFF' : 'transparent', border: isSelected ? 'none' : '1px solid #555870' }} />
                    {day}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-[#555870] text-xs mt-3">* התבנית היומית מוצגת לפי היום הראשון שנבחר ({HEBREW_DAYS[selectedDays[0]]}). שמירה תעדכן את כל הימים המסומנים.</p>
        </div>

        {/* Sync Range (Integrated) */}
        <div className="flex-shrink-0 flex gap-4">
          <div>
            <label className="block text-xs text-[#8B8FA8] mb-3 uppercase tracking-wider font-bold text-center">מרווח (דק')</label>
            <div className="flex items-center gap-2 bg-[#13161F] p-1.5 rounded-xl border border-[#2A2D3E] w-20">
               <input 
                 type="number" 
                 value={autofillInterval} 
                 onChange={(e) => setAutofillInterval(parseInt(e.target.value) || 0)} 
                 className="bg-transparent text-center text-[12px] text-[#E8EAFF] outline-none w-full font-bold" 
               />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#8B8FA8] mb-3 uppercase tracking-wider font-bold">טווח תאריכים לסנכרון</label>
            <div className="flex items-center gap-2 bg-[#13161F] p-1.5 rounded-xl border border-[#2A2D3E]">
               <input type="date" value={syncStartDate} onChange={(e)=>setSyncStartDate(e.target.value)} className="bg-transparent text-[11px] text-[#E8EAFF] outline-none" style={{ colorScheme: 'dark' }} />
               <div className="text-[#555870]">-</div>
               <input type="date" value={syncEndDate} onChange={(e)=>setSyncEndDate(e.target.value)} className="bg-transparent text-[11px] text-[#E8EAFF] outline-none" style={{ colorScheme: 'dark' }} />
            </div>
          </div>
        </div>

        <div className="flex items-end">
           <button
             onClick={handleSaveAndSync}
             disabled={savingSettings || syncing}
             className="h-11 px-8 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95"
             style={{ 
               background: (savingSettings || syncing) ? '#2A2D3E' : '#00C4AA', 
               color: (savingSettings || syncing) ? '#8B8FA8' : '#0F1117',
               boxShadow: (savingSettings || syncing) ? 'none' : '0 4px 20px rgba(0,196,170,0.3)'
             }}
           >
             <Save size={16} /> {(savingSettings || syncing) ? 'מסנכרן...' : `שמור וסנכרן ל-${selectedDays.length} ימים`}
           </button>
        </div>
      </div>

      {/* Grid Builder */}
      {loading ? (
        <div className="py-20 text-center text-[#8B8FA8] animate-pulse">טוען משחקים בסניף...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl shadow-xl" style={{ border: '1px solid #2A2D3E', background: '#1A1D27' }}>
          <div className="flex min-w-max p-4 gap-4">
            {rooms.length === 0 ? (
               <div className="w-full text-center p-10 text-[#555870]">לא נמצאו חדרים פעילים בסניף זה.</div>
            ) : rooms.map(room => (
              <div key={room.id} className="w-56 flex-shrink-0 flex flex-col rounded-xl overflow-hidden border border-[#2A2D3E] shadow-sm bg-[#13161F]">
                <div className="flex bg-[#1A1D27] border-b border-[#2A2D3E] group relative items-center">
                  <button 
                    onClick={() => autoFillRoom(room.id)}
                    title="לחץ כאן לשכפול אוטומטי של השעות (לפי המרווח שנבחר)"
                    className="flex-1 py-4 px-3 text-center font-extrabold text-[#E8EAFF] tracking-wide hover:bg-[#22253A] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-center gap-2">
                      {room.name}
                      <div className="w-4 h-4 rounded-full bg-[#00C4AA]/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus size={10} className="text-[#00C4AA]" />
                      </div>
                    </div>
                  </button>
                  <button 
                    onClick={() => clearColumnExceptFirst(room.id)}
                    title="מחק הכל חוץ מהסלוט הראשון"
                    className="absolute right-2 p-2 rounded-lg text-[#555870] hover:text-[#F87171] hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <div className="p-3 flex-1 flex flex-col gap-2.5 min-h-[450px]">
                  {templates[room.id]?.map((slot, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center gap-2 rounded-lg p-1.5 transition-all outline outline-1 outline-offset-[-1px]"
                      dir="ltr"
                      style={{ 
                        background: slot.is_next_day ? 'rgba(239,68,68,0.06)' : '#1A1D27',
                        outlineColor: slot.is_next_day ? 'rgba(239,68,68,0.2)' : '#2A2D3E' 
                      }}
                    >
                      <input
                        type="time"
                        value={slot.time}
                        dir="ltr"
                        onChange={(e) => handleSlotChange(room.id, idx, 'time', e.target.value)}
                        className="bg-transparent text-base font-medium w-full outline-none px-2 text-center"
                        style={{ color: slot.is_next_day ? '#F87171' : '#E8EAFF' }}
                      />
                      
                      <button
                        title={slot.is_next_day ? "שייך ליום הבא (אחרי חצות)" : "סמן כיום הבא (משחקי לילה)"}
                        onClick={() => handleSlotChange(room.id, idx, 'is_next_day', !slot.is_next_day)}
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: slot.is_next_day ? '#F87171' : '#555870', background: slot.is_next_day ? 'rgba(239,68,68,0.1)' : 'transparent' }}
                      >
                        <Moon size={16} />
                      </button>

                      <button
                        onClick={() => removeSlot(room.id, idx)}
                        className="p-1.5 rounded-md text-[#555870] hover:text-[#F87171] hover:bg-[#2A2D3E] transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    onClick={() => addSlot(room.id)}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold text-[#8B8FA8] hover:text-[#00C4AA] hover:bg-[#1A1D27] transition-all border-2 border-dashed border-[#2A2D3E] hover:border-[#00C4AA]/30"
                  >
                    <Plus size={16} /> סלוט חדש
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Area Removed - Now part of top controls */}

      {/* Conflicts Modal */}
      {conflicts.length > 0 && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,17,23,0.85)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-[#1A1D27] rounded-2xl max-w-2xl w-full p-6 border border-[#2A2D3E] shadow-2xl relative">
               <div className="flex items-center gap-3 mb-4 text-[#FBBF24]">
                  <AlertTriangle size={28} />
                  <h2 className="text-xl font-bold text-[#E8EAFF]">דו"ח סנכרון: נמצאו קונפליקטים</h2>
               </div>
               <p className="text-[#8B8FA8] mb-6">
                 התבנית החדשה הוחלה בהצלחה, אך המערכת זיהתה הזמנות פעילות בשעות שכבר אינן מופיעות בתבנית החדשה ששמרת. הרשומות הבאות לא נמחקו ויש לטפל בהן ידנית ביומן עצמו:
               </p>

               <div className="max-h-64 overflow-y-auto pr-2 mb-6 space-y-3">
                 {conflicts.map((c, i) => {
                    const roomName = rooms.find(r => r.id === c.room_id)?.name || 'משחק לא ידוע'
                    const dateRaw = new Date(c.start_at)
                    const fDate = format(dateRaw, 'dd/MM/yyyy')
                    const fTime = format(dateRaw, 'HH:mm')
                    return (
                       <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-[#13161F] border border-[#2A2D3E]">
                          <div><span className="font-bold text-[#E8EAFF]">{roomName}</span> <span className="text-[#555870] mx-2">|</span> {fDate} בשעה {fTime}</div>
                          <div className="px-2.5 py-1 text-xs font-bold rounded-md" style={{ background: 'rgba(245,158,11,0.1)', color: '#FBBF24' }}>{c.status}</div>
                       </div>
                    )
                 })}
               </div>

               <div className="flex justify-end">
                  <button onClick={() => setConflicts([])} className="px-6 py-2 rounded-xl border border-[#3E4268] text-[#E8EAFF] hover:bg-[#22253A] font-bold">
                     הבנתי, סגור
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  )
}
