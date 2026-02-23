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
  source_url: string | null
  source_type: string
  review_status: 'pending' | 'approved' | 'rejected' | 'published'
  created_at: string
  published_at: string | null
}

export async function listSeoNews(filters: NewsFilters): Promise<UnifiedNewsItem[]> {
  const supabase = await createClient()
  const { data: workspaces } = await supabase.from('workspaces').select('id, domain')
  const domainById = new Map((workspaces ?? []).map((row) => [row.id, row.domain]))
  const workspaceId = findWorkspaceIdByDomain(workspaces ?? [], filters.workspaceDomain ?? null)

  let query = supabase
    .from('nieuws')
    .select('id, workspace_id, title, summary, body_md, source_url, source_type, review_status, created_at, published_at')
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 200)

  if (workspaceId) query = query.eq('workspace_id', workspaceId)
  if (filters.status && filters.status !== 'all') query = query.eq('review_status', filters.status)
  if (filters.source && filters.source !== 'all') query = query.eq('source_type', filters.source)
  if (filters.q) query = query.ilike('title', `%${filters.q}%`)

  const { data, error } = await query
  if (error) throw new Error(`Kon nieuwsitems niet laden: ${error.message}`)

  return (data ?? []).map((row) => mapSeoRow(row as SeoNewsRow, domainById.get(row.workspace_id) ?? 'onbekend'))
}

export async function getSeoNewsById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('nieuws')
    .select('id, workspace_id, title, summary, body_md, source_url, source_type, review_status, created_at, published_at')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  const { data: workspace } = await supabase.from('workspaces').select('domain').eq('id', data.workspace_id).maybeSingle()
  return mapSeoRow(data as SeoNewsRow, workspace?.domain ?? 'onbekend')
}

function findWorkspaceIdByDomain(workspaces: WorkspaceRow[], domain: string | null) {
  if (!domain || domain === 'all') return null
  return workspaces.find((workspace) => workspace.domain === domain)?.id ?? null
}

function mapSeoRow(row: SeoNewsRow, site: string): UnifiedNewsItem {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    body: row.body_md,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    reviewStatus: row.review_status,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    site,
    origin: 'seo'
  }
}
