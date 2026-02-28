import { inferSiteFromText } from '@/lib/news/siteUtils'
import {
  deleteAgentNewsRecord,
  type AgentNewsContentUpdate,
  getAgentNewsRecordById,
  listAgentNewsRecords,
  type AgentNewsRecord,
  updateAgentNewsRecordBody,
  updateAgentNewsRecordContent,
  updateAgentNewsRecordStatus
} from '@/lib/news/agentNewsDb'
import type { NewsFilters, UnifiedNewsItem } from '@/lib/news/types'

export async function listAgentNews(filters: NewsFilters): Promise<UnifiedNewsItem[] | null> {
  const result = await listAgentNewsRecords(filters.limit ?? 200, filters.status ?? undefined)
  if (!result) return null

  let items = result.rows
    .map(mapAgentRow)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  if (filters.status && filters.status !== 'all') items = items.filter((item) => item.reviewStatus === filters.status)
  if (filters.workspaceDomain && filters.workspaceDomain !== 'all') {
    const target = normalizeDomain(filters.workspaceDomain)
    items = items.filter((item) => normalizeDomain(item.site) === target)
  }
  if (filters.source && filters.source !== 'all') items = items.filter((item) => item.sourceType.toLowerCase() === filters.source?.toLowerCase())
  if (filters.q) items = items.filter((item) => item.title.toLowerCase().includes(filters.q!.toLowerCase()))

  return items
}

export async function getAgentNewsById(id: string) {
  const result = await getAgentNewsRecordById(id)
  if (!result) return null
  result.row._source_table = result.table
  return mapAgentRow(result.row)
}

export async function updateAgentNewsStatus(id: string, reviewStatus: string) {
  return updateAgentNewsRecordStatus(id, reviewStatus)
}

export async function updateAgentNewsBody(id: string, body: string) {
  return updateAgentNewsRecordBody(id, body)
}

export async function updateAgentNewsContent(id: string, update: AgentNewsContentUpdate) {
  return updateAgentNewsRecordContent(id, update)
}

export async function deleteAgentNewsById(id: string) {
  return deleteAgentNewsRecord(id)
}

function mapAgentRow(row: AgentNewsRecord): UnifiedNewsItem {
  const title = asString(row.title) ?? asString(row.headline) ?? 'Ongetiteld'
  const summary = asString(row.summary) ?? asString(row.description) ?? null
  const body = asString(row.body) ?? asString(row.content) ?? asString(row.body_md) ?? null
  const featuredImageUrl = asString(row.featured_image_url) ?? asString(row.image_url) ?? asString(row.featured_image) ?? asString(row.image) ?? null
  const featuredImageAlt = asString(row.featured_image_alt) ?? asString(row.image_alt) ?? null
  const sourceUrl = asString(row.source_url) ?? asString(row.url) ?? null
  const sourceType = asString(row.source_name) ?? asString(row.source) ?? asString(row.source_type) ?? 'agent'
  const reviewStatus = normalizeReviewStatus(asString(row.review_status) ?? asString(row.status) ?? 'pending')
  const createdAt = asString(row.created_at) ?? asString(row.published_at) ?? asString(row.published) ?? new Date().toISOString()
  const publishedAt = asString(row.published_at) ?? asString(row.published) ?? null
  const sourceTable = asString(row._source_table)
  let site = 'brikxai.nl'
  if (sourceTable === 'zwijsen_nieuws') site = 'zwijsen.net'
  else if (sourceTable === 'brikx_nieuws') site = 'brikxai.nl'
  else if (sourceTable === 'nieuws' || sourceTable === 'nieuws_items') site = 'kavelarchitect.nl'
  else site = inferSiteFromText([sourceTable, asString(row.site), asString(row.topic), title, summary, sourceUrl, sourceType])

  return {
    id: asString(row.id) ?? title,
    title,
    summary,
    body,
    featuredImageUrl,
    featuredImageAlt,
    sourceUrl,
    sourceType,
    reviewStatus,
    createdAt,
    publishedAt,
    site,
    origin: 'agent'
  }
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function normalizeReviewStatus(value: string) {
  if (value === 'approved' || value === 'rejected' || value === 'published') return value
  return 'pending'
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
