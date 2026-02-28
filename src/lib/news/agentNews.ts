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
    .filter((item) => isDomainRelevant(item))
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
  const site = inferSiteFromText([asString(row.site), asString(row.topic), title, summary, sourceUrl, sourceType])

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

const POSITIVE_TERMS: Array<{ term: string; weight: number }> = [
  { term: 'bestemmingsplan', weight: 4 },
  { term: 'omgevingswet', weight: 4 },
  { term: 'omgevingsplan', weight: 4 },
  { term: 'omgevingsvergunning', weight: 4 },
  { term: 'bouwbesluit', weight: 3 },
  { term: 'bbl', weight: 3 },
  { term: 'wkb', weight: 3 },
  { term: 'kavel', weight: 3 },
  { term: 'woningbouw', weight: 3 },
  { term: 'vergunningsvrij', weight: 3 },
  { term: 'subsidie', weight: 2 },
  { term: 'architect', weight: 2 },
  { term: 'architectuur', weight: 2 },
  { term: 'nieuwbouw', weight: 2 },
  { term: 'verbouw', weight: 2 },
  { term: 'bouwkosten', weight: 2 },
  { term: 'aannemer', weight: 1 },
  { term: 'ruimtelijke ordening', weight: 2 },
  { term: 'duurzaam bouwen', weight: 2 },
  { term: 'isolatie', weight: 1 },
  { term: 'warmtepomp', weight: 1 },
  { term: 'vve', weight: 1 },
  { term: 'villa', weight: 2 },
  { term: 'interieur', weight: 2 },
  { term: 'generative design', weight: 3 },
  { term: 'computational design', weight: 3 },
  { term: 'bim', weight: 2 },
  { term: 'revit', weight: 2 },
  { term: '3d print', weight: 2 },
  { term: 'staalbouw', weight: 1 },
  { term: 'houtbouw', weight: 1 },
  { term: 'prefab', weight: 1 }
]

const NEGATIVE_TERMS: Array<{ term: string; weight: number }> = [
  { term: 'basisonderwijs', weight: 4 },
  { term: 'curriculum', weight: 3 },
  { term: 'leraren', weight: 3 },
  { term: 'zorg', weight: 2 },
  { term: 'sport', weight: 3 },
  { term: 'voetbal', weight: 3 },
  { term: 'entertainment', weight: 3 },
  { term: 'radiology', weight: 3 },
  { term: 'drug discovery', weight: 3 }
]

function normalizeDomain(value: string | null | undefined) {
  if (!value) return ''
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim()
}

const HARD_BLOCK_TERMS = ['chatgpt', 'gpt-5', 'openai', 'gemini', 'nvidia ai day', 'cybersecurity']
const TRUSTED_SOURCE_HINTS = ['nos.nl', 'bnr.nl', 'cobouw.nl', 'bouwwereld.nl', 'rijksoverheid.nl', 'rvo.nl', 'architectenweb.nl']

function isDomainRelevant(item: UnifiedNewsItem) {
  const text = [item.title, item.summary, item.body, item.sourceUrl, item.sourceType].filter(Boolean).join(' ').toLowerCase()
  const sourceUrl = (item.sourceUrl ?? '').toLowerCase()

  const positiveScore = POSITIVE_TERMS.reduce((score, token) => (text.includes(token.term) ? score + token.weight : score), 0)
  const negativeScore = NEGATIVE_TERMS.reduce((score, token) => (text.includes(token.term) ? score + token.weight : score), 0)
  const hasHardBlock = HARD_BLOCK_TERMS.some((term) => text.includes(term))
  const isTrustedSource = TRUSTED_SOURCE_HINTS.some((hint) => sourceUrl.includes(hint))

  if (hasHardBlock && positiveScore < 3) return false

  const relevanceScore = positiveScore - negativeScore
  if (isTrustedSource) return relevanceScore >= 1
  return relevanceScore >= 2
}
