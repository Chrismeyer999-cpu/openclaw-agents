import { deleteNewsItem, normalizeSourceMode, publishNewsArticle, saveNewsArticleBody, updateNewsStatus, writeNewsArticle } from '@/lib/news'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected', 'published'])
const ALLOWED_PATCH_ACTIONS = new Set(['set_status', 'write', 'save_body', 'publish'])

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

  const body = (await request.json().catch(() => null)) as
    | {
        id?: string
        review_status?: string
        source?: string
        action?: string
        article_body?: string
        body?: string
      }
    | null
  if (!body?.id) {
    return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
  }

  try {
    const sourceMode = normalizeSourceMode(body.source ?? null)
    const action = body.action ?? (body.review_status ? 'set_status' : null)
    if (!action || !ALLOWED_PATCH_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Ongeldige of ontbrekende action' }, { status: 400 })
    }

    if (action === 'set_status') {
      if (!body.review_status || !ALLOWED_REVIEW_STATUSES.has(body.review_status)) {
        return NextResponse.json({ error: 'Ongeldige review_status' }, { status: 400 })
      }
      const updated = await updateNewsStatus(body.id, body.review_status, sourceMode)
      if (!updated) return NextResponse.json({ error: 'Nieuwsitem niet gevonden' }, { status: 404 })
      return NextResponse.json(updated)
    }

    if (action === 'write') {
      const written = await writeNewsArticle(body.id, sourceMode)
      if (!written) return NextResponse.json({ error: 'Nieuwsitem niet gevonden' }, { status: 404 })
      return NextResponse.json(written)
    }

    if (action === 'save_body') {
      const articleBody = typeof body.article_body === 'string' ? body.article_body : body.body
      if (typeof articleBody !== 'string') {
        return NextResponse.json({ error: 'article_body is verplicht voor save_body' }, { status: 400 })
      }
      const saved = await saveNewsArticleBody(body.id, sourceMode, articleBody)
      if (!saved) return NextResponse.json({ error: 'Nieuwsitem niet gevonden' }, { status: 404 })
      return NextResponse.json(saved)
    }

    const articleBody = typeof body.article_body === 'string' ? body.article_body : typeof body.body === 'string' ? body.body : null
    const published = await publishNewsArticle(body.id, sourceMode, articleBody)
    if (!published) return NextResponse.json({ error: 'Nieuwsitem niet gevonden' }, { status: 404 })
    return NextResponse.json(published)
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
