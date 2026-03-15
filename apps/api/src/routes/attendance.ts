import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'

// Haversine distance between two GPS coordinates, returns meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Extract real client IP (handles proxies / Railway)
function getClientIp(req: any): string {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) return (String(forwarded)).split(',')[0].trim()
  return req.ip ?? ''
}

// Returns true if the request comes from the venue — either by IP or by GPS proximity
// Coords are looked up from the branch record in the DB
async function verifyPresence(
  req: any,
  branchId: string,
  lat?: number,
  lng?: number
): Promise<{ allowed: boolean; method: string }> {
  const { data: branch } = await supabase
    .from('branches')
    .select('venue_lat, venue_lng, venue_radius_meters, venue_static_ip')
    .eq('id', branchId)
    .single()

  if (!branch) return { allowed: false, method: 'branch_not_found' }

  // 1. Static IP check (instant, no permission required)
  if (branch.venue_static_ip) {
    const clientIp = getClientIp(req)
    if (clientIp === branch.venue_static_ip) return { allowed: true, method: 'ip' }
  }

  // 2. GPS proximity check
  const { venue_lat, venue_lng, venue_radius_meters } = branch
  if (lat !== undefined && lng !== undefined && venue_lat != null && venue_lng != null) {
    const dist = haversineDistance(lat, lng, venue_lat, venue_lng)
    if (dist <= (venue_radius_meters ?? 150)) return { allowed: true, method: 'gps' }
    return { allowed: false, method: 'gps_too_far' }
  }

  return { allowed: false, method: 'no_data' }
}

export async function attendanceRoutes(app: FastifyInstance) {
  // POST /attendance/clock-in
  app.post('/attendance/clock-in', async (req, reply) => {
    const { user_id, branch_id, lat, lng } = req.body as {
      user_id: string
      branch_id: string
      lat?: number
      lng?: number
    }

    if (!user_id || !branch_id) {
      return reply.status(400).send({ error: 'user_id ו-branch_id נדרשים' })
    }

    const { allowed, method } = await verifyPresence(req, branch_id, lat, lng)

    if (!allowed) {
      return reply.status(403).send({
        error: 'לא ניתן לרשום נוכחות — ודא שאתה במתחם',
        method,
      })
    }

    // Check for existing open log (no clock_out)
    const { data: existing } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('user_id', user_id)
      .is('clock_out', null)
      .single()

    if (existing) {
      return reply.status(409).send({ error: 'כבר רשום כנכנס — יש לסיים משמרת קודם' })
    }

    const { data, error } = await supabase
      .from('attendance_logs')
      .insert({
        user_id,
        branch_id,
        clock_in: new Date().toISOString(),
        wifi_token_verified: true, // reused as "location_verified"
        manual_entry: false,
      })
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send({ ...data, verification_method: method })
  })

  // POST /attendance/clock-out
  app.post('/attendance/clock-out', async (req, reply) => {
    const { user_id, branch_id, lat, lng } = req.body as {
      user_id: string
      branch_id: string
      lat?: number
      lng?: number
    }

    if (!user_id || !branch_id) {
      return reply.status(400).send({ error: 'user_id ו-branch_id נדרשים' })
    }

    const { allowed, method } = await verifyPresence(req, branch_id, lat, lng)

    if (!allowed) {
      return reply.status(403).send({
        error: 'לא ניתן לרשום נוכחות — ודא שאתה במתחם',
        method,
      })
    }

    const clockOut = new Date()

    const { data: log, error: findErr } = await supabase
      .from('attendance_logs')
      .select('id, clock_in')
      .eq('user_id', user_id)
      .is('clock_out', null)
      .single()

    if (findErr || !log) {
      return reply.status(404).send({ error: 'לא נמצא רישום כניסה פתוח' })
    }

    const totalMinutes = Math.round((clockOut.getTime() - new Date(log.clock_in).getTime()) / 60000)

    const { data, error } = await supabase
      .from('attendance_logs')
      .update({
        clock_out: clockOut.toISOString(),
        total_minutes: totalMinutes,
        wifi_token_verified: true,
      })
      .eq('id', log.id)
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send({ ...data, verification_method: method })
  })

  // GET /attendance/logs?user_id=&month=YYYY-MM
  app.get('/attendance/logs', async (req, reply) => {
    const { user_id, month } = req.query as { user_id?: string; month?: string }

    let query = supabase
      .from('attendance_logs')
      .select('*, user_profiles(full_name)')
      .order('clock_in', { ascending: false })

    if (user_id) query = query.eq('user_id', user_id)
    if (month) {
      const [year, m] = month.split('-')
      const start = `${year}-${m}-01T00:00:00+02:00`
      const end = new Date(parseInt(year), parseInt(m), 1).toISOString()
      query = query.gte('clock_in', start).lt('clock_in', end)
    }

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // POST /attendance/manual — manager manual entry
  app.post('/attendance/manual', async (req, reply) => {
    const { user_id, branch_id, clock_in, clock_out, note, manager_id } = req.body as {
      user_id: string
      branch_id: string
      clock_in: string
      clock_out: string
      note?: string
      manager_id: string
    }

    const totalMinutes = Math.round(
      (new Date(clock_out).getTime() - new Date(clock_in).getTime()) / 60000
    )

    const { data, error } = await supabase
      .from('attendance_logs')
      .insert({
        user_id,
        branch_id,
        clock_in,
        clock_out,
        total_minutes: totalMinutes,
        wifi_token_verified: false,
        manual_entry: true,
        manual_by: manager_id,
        note,
      })
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })
}
