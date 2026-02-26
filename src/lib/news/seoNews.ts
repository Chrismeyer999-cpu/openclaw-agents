import { createClient } from '@/lib/supabase/server'
import type { NewsFilters, UnifiedNewsItem } from '@/lib/news/types'

interface WorkspaceRow {
  id: string
  domain: string
}

interface SeoNewsRow {
  id: string
  workspace_id: string
  title: string
  summary: string | null
  body_md: string | null
  featured_image_url?: string | null
  featured_image_alt?: string | null
  source_url: string | null
  source_type: string
  review_status: 'pending' | 'approved' | 'rejected' | 'published'
  created_at: string
  published_at: string | null
}

const SEO_BASE_SELECT = 'id, workspace_id, title, summary, body_md, source_url, source_type, review_status, created_at, published_at'
const SEO_IMAGE_SELECT = `${SEO_BASE_SELECT}, featured_image_url, featured_image_alt`

export async function listSeoNews(filters: NewsFilters): Promise<UnifiedNewsItem[]> {
  const supabase = await createClient()
  const { data: workspaces } = await supabase.from('workspaces').select('id, domain')
  const domainById = new Map((workspaces ?? []).map((row) => [row.id, row.domain]))
  const workspaceId = findWorkspaceIdByDomain(workspaces ?? [], filters.workspaceDomain ?? null)

  const firstTry = await runSeoListQuery({ supabase, selectColumns: SEO_IMAGE_SELECT, workspaceId, filters })
  const fallbackTry = firstTry.error && isMissingFeaturedImageColumnError(firstTry.error)
  const finalResult = fallbackTry
    ? await runSeoListQuery({ supabase, selectColumns: SEO_BASE_SELECT, workspaceId, filters })
    : firstTry
  if (finalResult.error) throw new Error(`Kon nieuwsitems niet laden: ${finalResult.error.message}`)

  const rows = (finalResult.data ?? []) as unknown[]
  return rows.map((row) => {
    const seoRow = row as SeoNewsRow
    return mapSeoRow(seoRow, domainById.get(seoRow.workspace_id) ?? 'onbekend')
  })
}

export async function getSeoNewsById(id: string) {
  const supabase = await createClient()
  const firstTry = await supabase.from('nieuws').select(SEO_IMAGE_SELECT).eq('id', id).maybeSingle()
  const fallbackTry = firstTry.error && isMissingFeaturedImageColumnError(firstTry.error)
  const finalResult = fallbackTry ? await supabase.from('nieuws').select(SEO_BASE_SELECT).eq('id', id).maybeSingle() : firstTry

  if (finalResult.error || !finalResult.data) return null
  const seoRow = finalResult.data as unknown as SeoNewsRow
  const { data: workspace } = await supabase.from('workspaces').select('domain').eq('id', seoRow.workspace_id).maybeSingle()
  return mapSeoRow(seoRow, workspace?.domain ?? 'onbekend')
}

function findWorkspaceIdByDomain(workspaces: WorkspaceRow[], domain: string | null) {
  if (!domain || domain === 'all') return null
  const target = normalizeDomain(domain)
  return workspaces.find((workspace) => normalizeDomain(workspace.domain) === target)?.id ?? null
}

function normalizeDomain(value: string | null | undefined) {
  if (!value) return ''
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim()
}

function mapSeoRow(row: SeoNewsRow, site: string): UnifiedNewsItem {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    body: row.body_md,
    featuredImageUrl: row.featured_image_url ?? null,
    featuredImageAlt: row.featured_image_alt ?? null,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    reviewStatus: row.review_status,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    site,
    origin: 'seo'
  }
}

async function runSeoListQuery({
  supabase,
  selectColumns,
  workspaceId,
  filters
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  selectColumns: string
  workspaceId: string | null
  filters: NewsFilters
}) {
  let query = supabase.from('nieuws').select(selectColumns).order('created_at', { ascending: false }).limit(filters.limit ?? 200)
  if (workspaceId) query = query.eq('workspace_id', workspaceId)
  if (filters.status && filters.status !== 'all') query = query.eq('review_status', filters.status)
  if (filters.source && filters.source !== 'all') query = query.eq('source_type', filters.source)
  if (filters.q) query = query.ilike('title', `%${filters.q}%`)
  return query
}

function isMissingFeaturedImageColumnError(error: { message?: string; code?: string }) {
  const message = (error.message ?? '').toLowerCase()
  return error.code === '42703' || message.includes('featured_image_url') || message.includes('featured_image_alt')
}
