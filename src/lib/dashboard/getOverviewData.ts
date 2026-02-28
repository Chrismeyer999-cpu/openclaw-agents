import { listNewsItems } from '@/lib/news'
import { createClient } from '@/lib/supabase/server'
import type { OverviewData, WorkspaceRow, WorkspaceStat } from '@/lib/dashboard/types'

export async function getOverviewData(): Promise<OverviewData> {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceDate = since.toISOString().slice(0, 10)

  const [workspacesRes, pagesRes, snapshotsRes, clustersRes, mentionsRes, nieuwsRes] = await Promise.all([
    supabase.from('workspaces').select('id, domain').order('domain'),
    supabase.from('pillar_pages').select('id, workspace_id, title, url, has_schema'),
    supabase.from('gsc_snapshots').select('pillar_page_id, clicks, impressions, snapshot_date').gte('snapshot_date', sinceDate),
    supabase.from('intent_clusters').select('id, workspace_id'),
    supabase.from('llm_mentions').select('id, intent_cluster_id, mentioned, checked_at'),
    listNewsItems({ status: 'pending', limit: 200 })
  ])

  if (workspacesRes.error || pagesRes.error || snapshotsRes.error || clustersRes.error || mentionsRes.error) {
    throw new Error('Kon overview data niet laden uit Supabase.')
  }

  const workspaces = ((workspacesRes.data ?? []).map((workspace) => ({
    ...workspace,
    displayName: workspace.domain
  })) ?? []) as WorkspaceRow[]
  const stats = new Map<string, WorkspaceStat>(
    workspaces.map((workspace) => [workspace.id, { ...workspace, pages: 0, pagesWithSchema: 0, clicks30d: 0, impressions30d: 0, mentions30d: 0, pendingNieuws: 0 }])
  )

  const workspaceByDomain = new Map(workspaces.map(w => [w.domain, w.id]))

  const pageWorkspace = new Map<string, { workspaceId: string; title: string; url: string }>()
    ; (pagesRes.data ?? []).forEach((page) => {
      const entry = stats.get(page.workspace_id)
      if (!entry) return
      entry.pages += 1
      if (page.has_schema) entry.pagesWithSchema += 1
      pageWorkspace.set(page.id, { workspaceId: page.workspace_id, title: page.title, url: page.url })
    })

  const pageClicks = new Map<string, number>()
    ; (snapshotsRes.data ?? []).forEach((snapshot) => {
      const meta = pageWorkspace.get(snapshot.pillar_page_id)
      if (!meta) return
      const workspaceEntry = stats.get(meta.workspaceId)
      if (!workspaceEntry) return
      workspaceEntry.clicks30d += snapshot.clicks
      workspaceEntry.impressions30d += snapshot.impressions ?? 0
      pageClicks.set(snapshot.pillar_page_id, (pageClicks.get(snapshot.pillar_page_id) ?? 0) + snapshot.clicks)
    })

  const clusterWorkspace = new Map((clustersRes.data ?? []).map((cluster) => [cluster.id, cluster.workspace_id]))
    ; (mentionsRes.data ?? []).forEach((mention) => {
      if (!mention.mentioned || mention.checked_at < since.toISOString()) return
      const workspaceId = clusterWorkspace.get(mention.intent_cluster_id)
      if (!workspaceId) return
      const workspaceEntry = stats.get(workspaceId)
      if (!workspaceEntry) return
      workspaceEntry.mentions30d += 1
    })

    ; (nieuwsRes.items ?? []).forEach((item) => {
      const workspaceId = workspaceByDomain.get(item.site)
      if (!workspaceId) return
      const workspaceEntry = stats.get(workspaceId)
      if (!workspaceEntry) return
      workspaceEntry.pendingNieuws += 1
    })

  const workspaceStats = Array.from(stats.values())
  const totalPages = workspaceStats.reduce((sum, item) => sum + item.pages, 0)
  const totalSchema = workspaceStats.reduce((sum, item) => sum + item.pagesWithSchema, 0)
  const topPages = Array.from(pageClicks.entries())
    .map(([pageId, clicks30d]) => ({ pageId, clicks30d }))
    .sort((a, b) => b.clicks30d - a.clicks30d)
    .slice(0, 5)
    .map(({ pageId, clicks30d }) => {
      const page = pageWorkspace.get(pageId)
      return { id: pageId, title: page?.title ?? '-', url: page?.url ?? '-', domain: stats.get(page?.workspaceId ?? '')?.domain ?? '-', clicks30d }
    })

  const pendingItems = (nieuwsRes.items ?? [])
    .filter((item) => item.reviewStatus === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map((item) => ({ id: item.id, title: item.title, domain: item.site, created_at: item.createdAt }))

  return {
    totalClicks30d: workspaceStats.reduce((sum, item) => sum + item.clicks30d, 0),
    totalImpressions30d: workspaceStats.reduce((sum, item) => sum + item.impressions30d, 0),
    totalMentions30d: workspaceStats.reduce((sum, item) => sum + item.mentions30d, 0),
    structuredCoverage: totalPages === 0 ? 0 : Math.round((totalSchema / totalPages) * 100),
    pendingNieuws: workspaceStats.reduce((sum, item) => sum + item.pendingNieuws, 0),
    workspaceStats,
    topPages,
    pendingItems
  }
}
