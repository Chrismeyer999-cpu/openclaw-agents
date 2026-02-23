import { createDraftArticleBody } from '@/lib/news/draftArticle'
import { deleteAgentNewsById, getAgentNewsById, listAgentNews, updateAgentNewsBody, updateAgentNewsStatus } from '@/lib/news/agentNews'
import { listSeoNews, getSeoNewsById } from '@/lib/news/seoNews'
import type { NewsFilters, NewsSourceMode, UnifiedNewsItem } from '@/lib/news/types'
import { publishToZwijsenNieuws } from '@/lib/news/zwijsenPublisher'
import { createClient } from '@/lib/supabase/server'

export async function listNewsItems(filters: NewsFilters) {
  const agentItems = await listAgentNews(filters)
  if (agentItems) return { mode: 'agent' as const, items: agentItems }
  return { mode: 'seo' as const, items: await listSeoNews(filters) }
}

export async function getNewsItemById(id: string, preferredMode: NewsSourceMode | null) {
  if (preferredMode === 'agent') {
    const agentItem = await getAgentNewsById(id)
    if (agentItem) return agentItem
    return getSeoNewsById(id)
  }
  if (preferredMode === 'seo') return getSeoNewsById(id)

  const agentItem = await getAgentNewsById(id)
  if (agentItem) return agentItem
  return getSeoNewsById(id)
}

export async function updateNewsStatus(id: string, reviewStatus: string, source: NewsSourceMode | null) {
  if (source === 'agent') return updateAgentNewsStatus(id, reviewStatus)

  const supabase = await createClient()
  const payload =
    reviewStatus === 'published'
      ? { review_status: reviewStatus, published_at: new Date().toISOString() }
      : { review_status: reviewStatus }

  const { data, error } = await supabase.from('nieuws').update(payload).eq('id', id).select('id').maybeSingle()
  if (error) throw new Error(`Update mislukt: ${error.message}`)
  return data
}

export async function updateNewsBody(id: string, body: string, source: NewsSourceMode | null) {
  if (source === 'agent') return updateAgentNewsBody(id, body)

  const supabase = await createClient()
  const { data, error } = await supabase.from('nieuws').update({ body_md: body }).eq('id', id).select('id').maybeSingle()
  if (error) throw new Error(`Artikeltekst opslaan mislukt: ${error.message}`)
  return data
}

export async function writeNewsArticle(id: string, source: NewsSourceMode | null) {
  const item = await getNewsItemById(id, source)
  if (!item) return null

  const draftBody =
    item.body?.trim() ||
    createDraftArticleBody({
      title: item.title,
      summary: item.summary,
      sourceUrl: item.sourceUrl,
      site: item.site
    })

  const resolvedSource = source ?? item.origin
  await updateNewsBody(id, draftBody, resolvedSource)
  return { id, body: draftBody, review_status: item.reviewStatus }
}

export async function saveNewsArticleBody(id: string, source: NewsSourceMode | null, body: string) {
  const item = await getNewsItemById(id, source)
  if (!item) return null

  const resolvedSource = source ?? item.origin
  await updateNewsBody(id, body, resolvedSource)
  return { id, body, review_status: item.reviewStatus }
}

export async function publishNewsArticle(id: string, source: NewsSourceMode | null, bodyOverride: string | null) {
  const item = await getNewsItemById(id, source)
  if (!item) return null

  const resolvedSource = source ?? item.origin
  const nextBody = (bodyOverride ?? item.body ?? '').trim()
  if (!nextBody) {
    throw new Error('Artikeltekst ontbreekt. Schrijf eerst het artikel en bewerk het indien nodig.')
  }

  if (bodyOverride && bodyOverride !== item.body) {
    await updateNewsBody(id, bodyOverride, resolvedSource)
  }

  if (item.site !== 'zwijsen.net') {
    throw new Error(`Publiceren naar ${item.site} is nog niet gekoppeld. Start is nu alleen zwijsen.net.`)
  }

  const publication = await publishToZwijsenNieuws({
    id: item.id,
    title: item.title,
    summary: item.summary,
    body: nextBody,
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl
  })

  await updateNewsStatus(id, 'published', resolvedSource)
  return {
    id,
    body: nextBody,
    review_status: 'published' as const,
    published_url: publication.url,
    published_file: publication.filePath
  }
}

export async function deleteNewsItem(id: string, source: NewsSourceMode | null) {
  if (source === 'agent') return deleteAgentNewsById(id)

  const supabase = await createClient()
  const { data, error } = await supabase.from('nieuws').delete().eq('id', id).select('id').maybeSingle()
  if (error) throw new Error(`Verwijderen mislukt: ${error.message}`)
  return data
}

export async function getWorkspaceDomains() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('workspaces').select('id, domain').order('domain')
  if (error) throw new Error(`Kon workspaces niet laden: ${error.message}`)
  return data ?? []
}

export function normalizeSourceMode(value: string | null): NewsSourceMode | null {
  if (value === 'agent' || value === 'seo') return value
  return null
}

export function pendingCountByDomain(items: UnifiedNewsItem[]) {
  const counters = new Map<string, number>()
  items.forEach((item) => {
    if (item.reviewStatus !== 'pending') return
    counters.set(item.site, (counters.get(item.site) ?? 0) + 1)
  })
  return counters
}
