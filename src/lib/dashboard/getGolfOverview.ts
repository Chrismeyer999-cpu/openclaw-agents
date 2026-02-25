import { createClient } from '@/lib/supabase/server'

export interface GolfOverview {
  trendCount: number
  backlogCount: number
  inProductionCount: number
  postedCount: number
  activeSeries: number
}

export async function getGolfOverview(): Promise<GolfOverview> {
  const supabase = await createClient()

  const [trendsRes, itemsRes, seriesRes] = await Promise.all([
    supabase.from('golf_topics_trending').select('id,status', { count: 'exact' }),
    supabase.from('golf_content_items').select('id,stage', { count: 'exact' }),
    supabase.from('golf_series').select('id,status', { count: 'exact' })
  ])

  if (trendsRes.error || itemsRes.error || seriesRes.error) {
    return { trendCount: 0, backlogCount: 0, inProductionCount: 0, postedCount: 0, activeSeries: 0 }
  }

  const trendRows = trendsRes.data ?? []
  const contentRows = itemsRes.data ?? []
  const seriesRows = seriesRes.data ?? []

  return {
    trendCount: trendRows.length,
    backlogCount: trendRows.filter((t) => t.status === 'backlog' || t.status === 'planned').length,
    inProductionCount: contentRows.filter((c) => ['script', 'shotlist', 'render', 'edit', 'scheduled'].includes(c.stage)).length,
    postedCount: contentRows.filter((c) => c.stage === 'posted').length,
    activeSeries: seriesRows.filter((s) => s.status === 'active').length
  }
}
