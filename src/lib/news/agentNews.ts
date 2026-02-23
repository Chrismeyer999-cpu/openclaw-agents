import { inferSiteFromText } from '@/lib/news/siteUtils'
import { getAgentNewsRecordById, listAgentNewsRecords, type AgentNewsRecord, updateAgentNewsRecordStatus } from '@/lib/news/agentNewsDb'
import type { NewsFilters, UnifiedNewsItem } from '@/lib/news/types'

export async function listAgentNews(filters: NewsFilters): Promise<UnifiedNewsItem[] | null> {
  const result = await listAgentNewsRecords(filters.limit ?? 200)
  if (!result) return null

  let items = result.rows.map(mapAgentRow).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  if (filters.status && filters.status !== 'all') items = items.filter((item) => item.reviewStatus === filters.status)
  if (filters.workspaceDomain && filters.workspaceDomain !== 'all') items = items.filter((item) => item.site === filters.workspaceDomain)
  if (filters.source && filters.source !== 'all') items = items.filter((item) => item.sourceType.toLowerCase() === filters.source?.toLowerCase())
  if (filters.q) items = items.filter((item) => item.title.toLowerCase().includes(filters.q!.toLowerCase()))

  return items
}

export async function getAgentNewsById(id: string) {
  const result = await getAgentNewsRecordById(id)
  if (!result) return null
  return mapAgentRow(result.row)
}

export async function updateAgentNewsStatus(id: string, reviewStatus: string) {
  return updateAgentNewsRecordStatus(id, reviewStatus)
}

function mapAgentRow(row: AgentNewsRecord): UnifiedNewsItem {
  const title = asString(row.title) ?? asString(row.headline) ?? 'Ongetiteld'
  const summary = asString(row.summary) ?? asString(row.description) ?? null
  const body = asString(row.body) ?? asString(row.content) ?? asString(row.body_md) ?? null
  const sourceUrl = asString(row.source_url) ?? asString(row.url) ?? null
  const sourceType = asString(row.source_name) ?? asString(row.source) ?? asString(row.source_type) ?? 'agent'
  const reviewStatus = normalizeReviewStatus(asString(row.review_status) ?? asString(row.status) ?? 'pending')
  const createdAt = asString(row.created_at) ?? asString(row.published_at) ?? asString(row.published) ?? new Date().toISOString()
  const publishedAt = asString(row.published_at) ?? asString(row.published) ?? null
  const site = inferSiteFromText([asString(row.site), asString(row.topic), title, summary, sourceUrl, sourceType])

  return { id: asString(row.id) ?? title, title, summary, body, sourceUrl, sourceType, reviewStatus, createdAt, publishedAt, site, origin: 'agent' }
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function normalizeReviewStatus(value: string) {
  if (value === 'approved' || value === 'rejected' || value === 'published') return value
  return 'pending'
}
