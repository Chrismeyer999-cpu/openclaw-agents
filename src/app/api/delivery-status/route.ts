import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as {
    id?: string
    status?: 'working' | 'partial' | 'planned' | 'blocked'
    works_now?: string | null
    not_working_yet?: string | null
    next_step?: string | null
  } | null

  if (!body?.id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status) payload.status = body.status
  if (body.works_now !== undefined) payload.works_now = body.works_now
  if (body.not_working_yet !== undefined) payload.not_working_yet = body.not_working_yet
  if (body.next_step !== undefined) payload.next_step = body.next_step

  const { data, error } = await supabase
    .from('delivery_status_items')
    .update(payload)
    .eq('id', body.id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Item niet gevonden' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
