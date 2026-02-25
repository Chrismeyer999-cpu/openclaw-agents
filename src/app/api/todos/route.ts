import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('dashboard_todos')
    .select('id,title,notes,status,priority,due_date,created_at')
    .order('status', { ascending: true })
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { title?: string; notes?: string; priority?: 'low' | 'medium' | 'high' } | null
  if (!body?.title || body.title.trim().length < 3) {
    return NextResponse.json({ error: 'title is verplicht (min. 3 tekens)' }, { status: 400 })
  }

  const payload = {
    title: body.title.trim(),
    notes: body.notes?.trim() || null,
    priority: body.priority ?? 'medium',
    status: 'open'
  }

  const { data, error } = await supabase.from('dashboard_todos').insert(payload).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data?.id }, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { id?: string; status?: 'open' | 'doing' | 'done' } | null
  if (!body?.id || !body.status) return NextResponse.json({ error: 'id en status zijn verplicht' }, { status: 400 })

  const { data, error } = await supabase
    .from('dashboard_todos')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .select('id,status')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Todo niet gevonden' }, { status: 404 })

  return NextResponse.json(data)
}
