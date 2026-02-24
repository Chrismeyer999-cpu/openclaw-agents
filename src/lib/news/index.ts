import { generateArticleFromBrief } from '@/lib/news/articleFromBrief'
import { createDraftArticleBody } from '@/lib/news/draftArticle'
import { deleteAgentNewsById, getAgentNewsById, listAgentNews, updateAgentNewsBody, updateAgentNewsContent, updateAgentNewsStatus } from '@/lib/news/agentNews'
import { publishToBrikxNieuws } from '@/lib/news/brikxPublisher'
import { publishToKavelarchitectNieuws } from '@/lib/news/kavelarchitectPublisher'
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
  return updateNewsContent(id, { body }, source)
}

interface NewsContentUpdate {
  body?: string
  featuredImageUrl?: string | null
  featuredImageAlt?: string | null
}

export async function updateNewsContent(id: string, update: NewsContentUpdate, source: NewsSourceMode | null) {
  if (source === 'agent') {
    if (Object.keys(update).length === 1 && typeof update.body === 'string') {
      return updateAgentNewsBody(id, update.body)
    }
    return updateAgentNewsContent(id, update)
  }

  const supabase = await createClient()
  const payload = buildSeoNewsUpdatePayload(update)
  if (Object.keys(payload).length === 0) return { id }

  const firstTry = await supabase.from('nieuws').update(payload).eq('id', id).select('id').maybeSingle()
  if (!firstTry.error) return firstTry.data

  if (isMissingFeaturedImageColumnError(firstTry.error)) {
    const fallbackPayload = { ...payload }
    delete fallbackPayload.featured_image_url
    delete fallbackPayload.featured_image_alt

    if (Object.keys(fallbackPayload).length === 0) return { id }
    const secondTry = await supabase.from('nieuws').update(fallbackPayload).eq('id', id).select('id').maybeSingle()
    if (secondTry.error) throw new Error(`Artikel opslaan mislukt: ${secondTry.error.message}`)
    return secondTry.data
  }

  throw new Error(`Artikel opslaan mislukt: ${firstTry.error.message}`)
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
  return {
    id,
    body: draftBody,
    featured_image_url: item.featuredImageUrl,
    featured_image_alt: item.featuredImageAlt,
    review_status: item.reviewStatus
  }
}

export async function writeNewsArticleFromBrief(
  id: string,
  source: NewsSourceMode | null,
  brief: string,
  imageNote: string | null,
  featuredImageUrl?: string | null,
  featuredImageAlt?: string | null
) {
  const item = await getNewsItemById(id, source)
  if (!item) return null

  const resolvedSource = source ?? item.origin
  const nextFeaturedImageUrl = featuredImageUrl === undefined ? item.featuredImageUrl : normalizeOptionalText(featuredImageUrl)
  const nextFeaturedImageAlt = featuredImageAlt === undefined ? item.featuredImageAlt : normalizeOptionalText(featuredImageAlt)

  const generated = await generateArticleFromBrief({
    title: item.title,
    summary: item.summary,
    sourceUrl: item.sourceUrl,
    site: item.site,
    brief,
    imageUrl: nextFeaturedImageUrl,
    imageAlt: nextFeaturedImageAlt,
    imageNote: normalizeOptionalText(imageNote)
  })

  await updateNewsContent(
    id,
    {
      body: generated.body,
      featuredImageUrl: nextFeaturedImageUrl,
      featuredImageAlt: nextFeaturedImageAlt
    },
    resolvedSource
  )

  return {
    id,
    body: generated.body,
    featured_image_url: nextFeaturedImageUrl,
    featured_image_alt: nextFeaturedImageAlt,
    review_status: item.reviewStatus,
    generation_mode: generated.mode
  }
}

export async function saveNewsArticleBody(id: string, source: NewsSourceMode | null, body: string, featuredImageUrl?: string | null, featuredImageAlt?: string | null) {
  const item = await getNewsItemById(id, source)
  if (!item) return null

  const resolvedSource = source ?? item.origin
  const nextFeaturedImageUrl = featuredImageUrl === undefined ? item.featuredImageUrl : featuredImageUrl
  const nextFeaturedImageAlt = featuredImageAlt === undefined ? item.featuredImageAlt : featuredImageAlt

  await updateNewsContent(
    id,
    {
      body,
      featuredImageUrl: nextFeaturedImageUrl,
      featuredImageAlt: nextFeaturedImageAlt
    },
    resolvedSource
  )
  return {
    id,
    body,
    featured_image_url: nextFeaturedImageUrl,
    featured_image_alt: nextFeaturedImageAlt,
    review_status: item.reviewStatus
  }
}

export async function publishNewsArticle(
  id: string,
  source: NewsSourceMode | null,
  bodyOverride: string | null,
  featuredImageUrlOverride?: string | null,
  featuredImageAltOverride?: string | null
) {
  const item = await getNewsItemById(id, source)
  if (!item) return null

  const resolvedSource = source ?? item.origin
  const nextBody = (bodyOverride ?? item.body ?? '').trim()
  const nextFeaturedImageUrl = featuredImageUrlOverride === undefined ? item.featuredImageUrl : normalizeOptionalText(featuredImageUrlOverride)
  const nextFeaturedImageAlt =
    featuredImageAltOverride === undefined ? item.featuredImageAlt : normalizeOptionalText(featuredImageAltOverride)
  if (!nextBody) {
    throw new Error('Artikeltekst ontbreekt. Schrijf eerst het artikel en bewerk het indien nodig.')
  }

  const needsContentUpdate =
    (bodyOverride !== null && bodyOverride !== item.body) ||
    featuredImageUrlOverride !== undefined ||
    featuredImageAltOverride !== undefined
  if (needsContentUpdate) {
    await updateNewsContent(
      id,
      {
        body: nextBody,
        featuredImageUrl: nextFeaturedImageUrl,
        featuredImageAlt: nextFeaturedImageAlt
      },
      resolvedSource
    )
  }

  const publicationInput = {
    id: item.id,
    title: item.title,
    summary: item.summary,
    body: nextBody,
    featuredImageUrl: nextFeaturedImageUrl,
    featuredImageAlt: nextFeaturedImageAlt,
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl
  }

  const normalizedSite = normalizeSiteDomain(item.site)
  let publication
  if (normalizedSite === 'zwijsen.net') {
    publication = await publishToZwijsenNieuws(publicationInput)
  } else if (normalizedSite === 'brikxai.nl') {
    publication = await publishToBrikxNieuws(publicationInput)
  } else if (normalizedSite === 'kavelarchitect.nl') {
    publication = await publishToKavelarchitectNieuws(publicationInput)
  } else {
    throw new Error(`Publiceren naar ${item.site} is nog niet gekoppeld.`)
  }

  await updateNewsStatus(id, 'published', resolvedSource)
  return {
    id,
    body: nextBody,
    featured_image_url: nextFeaturedImageUrl,
    featured_image_alt: nextFeaturedImageAlt,
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

function buildSeoNewsUpdatePayload(update: NewsContentUpdate) {
  const payload: Record<string, string | null> = {}
  if (typeof update.body === 'string') payload.body_md = update.body
  if (update.featuredImageUrl !== undefined) payload.featured_image_url = normalizeOptionalText(update.featuredImageUrl)
  if (update.featuredImageAlt !== undefined) payload.featured_image_alt = normalizeOptionalText(update.featuredImageAlt)
  return payload
}

function isMissingFeaturedImageColumnError(error: { message?: string; code?: string }) {
  const message = (error.message ?? '').toLowerCase()
  return error.code === '42703' || message.includes('featured_image_url') || message.includes('featured_image_alt')
}

function normalizeOptionalText(value: string | null | undefined) {
  if (value === undefined) return null
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeSiteDomain(site: string) {
  return site
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}
