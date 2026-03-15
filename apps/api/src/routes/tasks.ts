import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'

export async function tasksRoutes(app: FastifyInstance) {
  // GET /tasks?branch_id=&date=
  app.get('/tasks', async (req, reply) => {
    const { branch_id, date } = req.query as { branch_id?: string; date?: string }

    let query = supabase.from('tasks').select('*, user_profiles(full_name)').order('hour')

    if (branch_id) query = query.eq('branch_id', branch_id)

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // GET /tasks/checklist?branch_id=&date=&type=opening|closing
  app.get('/tasks/checklist', async (req, reply) => {
    const { branch_id, date, type } = req.query as {
      branch_id?: string
      date?: string
      type?: 'opening' | 'closing'
    }

    if (!date) return reply.status(400).send({ error: 'date required' })

    // Get or create daily checklist
    const { data: existing } = await supabase
      .from('task_checklist_daily')
      .select('*, task_templates(*)')
      .eq('date', date)
      .eq('task_templates.type', type ?? 'opening')
      .single()

    if (existing) return reply.send(existing)

    // Get template
    let templateQuery = supabase.from('task_templates').select('*')
    if (branch_id) templateQuery = templateQuery.eq('branch_id', branch_id)
    if (type) templateQuery = templateQuery.eq('type', type)

    const { data: template } = await templateQuery.single()
    if (!template) return reply.status(404).send({ error: 'No template found' })

    // Create today's checklist from template
    const { data: newChecklist, error } = await supabase
      .from('task_checklist_daily')
      .insert({
        template_id: template.id,
        date,
        items_json: template.items_json,
      })
      .select('*, task_templates(*)')
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(newChecklist)
  })

  // PATCH /tasks/checklist/:id — update item completion
  app.patch('/tasks/checklist/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { items_json, completed_by } = req.body as {
      items_json: unknown[]
      completed_by: string
    }

    const { data, error } = await supabase
      .from('task_checklist_daily')
      .update({ items_json, completed_by })
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // GET /cash-registers?branch_id=&room_id=&date=
  app.get('/cash-registers', async (req, reply) => {
    const { branch_id, room_id, date } = req.query as {
      branch_id?: string
      room_id?: string
      date?: string
    }

    let query = supabase
      .from('cash_registers')
      .select('*, rooms(name)')
      .order('date', { ascending: false })

    if (branch_id) query = query.eq('branch_id', branch_id)
    if (room_id) query = query.eq('room_id', room_id)
    if (date) query = query.eq('date', date)

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // POST /cash-registers
  app.post('/cash-registers', async (req, reply) => {
    const body = req.body as {
      branch_id: string
      room_id: string
      date: string
      shift_type: 'morning' | 'evening'
      opening_amount: number
      closing_amount: number
      cash_sales: number
      card_sales: number
      notes?: string
      submitted_by: string
    }

    const { data, error } = await supabase
      .from('cash_registers')
      .insert(body)
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })
}
