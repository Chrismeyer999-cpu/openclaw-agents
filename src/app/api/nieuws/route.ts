import { normalizeSourceMode, updateNewsStatus } from '@/lib/news'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected', 'published'])

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
