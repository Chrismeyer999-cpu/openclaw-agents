import { getAgentNewsById, listAgentNews, updateAgentNewsStatus } from '@/lib/news/agentNews'
import { listSeoNews, getSeoNewsById } from '@/lib/news/seoNews'
import type { NewsFilters, NewsSourceMode, UnifiedNewsItem } from '@/lib/news/types'
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
