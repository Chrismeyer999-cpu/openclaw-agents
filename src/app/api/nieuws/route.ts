import {
  createNewsArticleFromBrief,
  deleteNewsItem,
  normalizeSourceMode,
  publishNewsArticle,
  saveNewsArticleBody,
  updateNewsStatus,
  writeNewsArticle,
  writeNewsArticleFromBrief
} from '@/lib/news'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected', 'published'])
const ALLOWED_PATCH_ACTIONS = new Set(['set_status', 'write', 'write_from_brief', 'save_body', 'publish'])

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return null
  return user
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | {
        site?: string
        title?: string
        brief?: string
        summary?: string | null
        source_type?: string | null
        source_url?: string | null
        featured_image_url?: string | null
        featured_image_alt?: string | null
        image_url?: string | null
        image_alt?: string | null
        image_note?: string | null
      }
    | null

  if (typeof body?.site !== 'string' || body.site.trim().length === 0) {
    return NextResponse.json({ error: 'site is verplicht' }, { status: 400 })
  }
  if (typeof body?.title !== 'string' || body.title.trim().length === 0) {
    return NextResponse.json({ error: 'title is verplicht' }, { status: 400 })
  }
  if (typeof body?.brief !== 'string' || body.brief.trim().length < 10) {
    return NextResponse.json({ error: 'brief is verplicht en moet minimaal 10 tekens bevatten' }, { status: 400 })
  }

  try {
    const created = await createNewsArticleFromBrief({
      site: body.site,
      title: body.title,
      brief: body.brief,
      summary: typeof body.summary === 'string' || body.summary === null ? body.summary : undefined,
      sourceType: typeof body.source_type === 'string' || body.source_type === null ? body.source_type : undefined,
      sourceUrl: typeof body.source_url === 'string' || body.source_url === null ? body.source_url : undefined,
      imageNote: typeof body.image_note === 'string' || body.image_note === null ? body.image_note : undefined,
      featuredImageUrl: resolveOptionalImageField(body.featured_image_url, body.image_url),
      featuredImageAlt: resolveOptionalImageField(body.featured_image_alt, body.image_alt)
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
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
        featured_image_url?: string | null
        featured_image_alt?: string | null
        image_url?: string | null
        image_alt?: string | null
        brief?: string
        image_note?: string | null
        reason?: string | null
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

      // Schrijf feedback-signaal bij approve/reject voor agent geheugen
      if (body.review_status === 'approved' || body.review_status === 'rejected') {
        try {
          await writeFeedbackSignal(body.id, body.review_status, body.reason ?? null)
        } catch {
          // Feedback-schrijven is non-blocking: logt maar breekt de response niet
          console.warn('[nieuws] feedback write failed for', body.id)
        }
      }

      return NextResponse.json(updated)
    }

    if (action === 'write') {
      const written = await writeNewsArticle(body.id, sourceMode)
      if (!written) return NextResponse.json({ error: 'Nieuwsitem niet gevonden' }, { status: 404 })
      return NextResponse.json(written)
    }

    if (action === 'write_from_brief') {
      if (typeof body.brief !== 'string' || body.brief.trim().length < 10) {
        return NextResponse.json({ error: 'brief is verplicht en moet minimaal 10 tekens bevatten' }, { status: 400 })
      }
      const featuredImageUrl = resolveOptionalImageField(body.featured_image_url, body.image_url)
      const featuredImageAlt = resolveOptionalImageField(body.featured_image_alt, body.image_alt)
      const imageNote = typeof body.image_note === 'string' ? body.image_note : body.image_note === null ? null : null
      const written = await writeNewsArticleFromBrief(body.id, sourceMode, body.brief, imageNote, featuredImageUrl, featuredImageAlt)
      if (!written) return NextResponse.json({ error: 'Nieuwsitem niet gevonden' }, { status: 404 })
      return NextResponse.json(written)
    }

    if (action === 'save_body') {
      const articleBody = typeof body.article_body === 'string' ? body.article_body : body.body
      if (typeof articleBody !== 'string') {
        return NextResponse.json({ error: 'article_body is verplicht voor save_body' }, { status: 400 })
      }
      const featuredImageUrl = resolveOptionalImageField(body.featured_image_url, body.image_url)
      const featuredImageAlt = resolveOptionalImageField(body.featured_image_alt, body.image_alt)
      const saved = await saveNewsArticleBody(body.id, sourceMode, articleBody, featuredImageUrl, featuredImageAlt)
      if (!saved) return NextResponse.json({ error: 'Nieuwsitem niet gevonden' }, { status: 404 })
      return NextResponse.json(saved)
    }

    const articleBody = typeof body.article_body === 'string' ? body.article_body : typeof body.body === 'string' ? body.body : null
    const featuredImageUrl = resolveOptionalImageField(body.featured_image_url, body.image_url)
    const featuredImageAlt = resolveOptionalImageField(body.featured_image_alt, body.image_alt)
    const published = await publishNewsArticle(body.id, sourceMode, articleBody, featuredImageUrl, featuredImageAlt)
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

function resolveOptionalImageField(primary: unknown, secondary: unknown) {
  if (typeof primary === 'string' || primary === null) return primary
  if (typeof secondary === 'string' || secondary === null) return secondary
  return undefined
}

/**
 * Schrijft een feedback-signaal naar `nieuws_feedback` tabel bij approve/reject.
 * Agents lezen deze tabel bij elke run om hun relevantiegates bij te stellen.
 */
async function writeFeedbackSignal(
  nieuwsId: string,
  action: 'approved' | 'rejected',
  reason: string | null
): Promise<void> {
  try {
    const supabase = await createClient()

    // Haal item-details op voor het feedback record
    const { data: item } = await supabase
      .from('nieuws')
      .select('site, source_url, source_name, title, tags')
      .eq('id', nieuwsId)
      .maybeSingle()

    if (!item) return

    await supabase.from('nieuws_feedback').insert({
      nieuws_id: nieuwsId,
      site: item.site ?? 'onbekend',
      source_name: item.source_name ?? null,
      source_url: item.source_url ?? null,
      title_snippet: typeof item.title === 'string' ? item.title.slice(0, 80) : null,
      tags: Array.isArray(item.tags) ? item.tags : [],
      action,
      reason
    })

    // Update ook agent_memory voor snelle patroon-lookup
    const patternKey = `${item.source_name ?? 'unknown'}::${(Array.isArray(item.tags) ? item.tags : []).join(',')}`
    const { data: existing } = await supabase
      .from('agent_memory')
      .select('id, value, observation_count')
      .eq('agent', 'nieuwsmonitor')
      .eq('category', action === 'approved' ? 'approved_pattern' : 'rejected_pattern')
      .eq('site', item.site ?? '')
      .eq('key', patternKey)
      .maybeSingle()

    if (existing) {
      // Verhoog observatie-teller en herbereken confidence
      const newCount = (existing.observation_count ?? 1) + 1
      await supabase
        .from('agent_memory')
        .update({
          observation_count: newCount,
          confidence: Math.min(0.99, 0.5 + newCount * 0.05),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('agent_memory').insert({
        agent: 'nieuwsmonitor',
        category: action === 'approved' ? 'approved_pattern' : 'rejected_pattern',
        site: item.site ?? null,
        key: patternKey,
        value: {
          source_name: item.source_name,
          tags: item.tags,
          title_snippet: typeof item.title === 'string' ? item.title.slice(0, 80) : null,
          action
        },
        confidence: 0.5,
        observation_count: 1
      })
    }
  } catch (err) {
    console.error('[nieuws] writeFeedbackSignal error:', err)
    throw err
  }
}
