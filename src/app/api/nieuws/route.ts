import { deleteNewsItem, normalizeSourceMode, updateNewsStatus } from '@/lib/news'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected', 'published'])

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return null
  return user
}

export async function PATCH(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { id?: string; review_status?: string; source?: string } | null
  if (!body?.id || !body.review_status) {
    return NextResponse.json({ error: 'id en review_status zijn verplicht' }, { status: 400 })
  }
  if (!ALLOWED_REVIEW_STATUSES.has(body.review_status)) {
    return NextResponse.json({ error: 'Ongeldige review_status' }, { status: 400 })
  }

  try {
    const sourceMode = normalizeSourceMode(body.source ?? null)
    const updated = await updateNewsStatus(body.id, body.review_status, sourceMode)
    if (!updated) return NextResponse.json({ error: 'Nieuwsitem niet gevonden' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { id?: string; source?: string } | null
  if (!body?.id) {
    return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
  }

  try {
    const sourceMode = normalizeSourceMode(body.source ?? null)
    const deleted = await deleteNewsItem(body.id, sourceMode)
    if (!deleted) return NextResponse.json({ error: 'Nieuwsitem niet gevonden' }, { status: 404 })
    return NextResponse.json({ ok: true, id: body.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
