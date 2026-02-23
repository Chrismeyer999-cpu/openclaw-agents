import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export interface WorkspaceStats {
  id: string
  domain: string
  displayName: string
  pages: number
  pagesWithSchema: number
  clicks30d: number
  mentions30d: number
  pendingNieuws: number
}

export async function getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats> {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceDate = since.toISOString().slice(0, 10)

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, domain')
    .eq('id', workspaceId)
    .maybeSingle()

  if (workspaceError) throw new Error(workspaceError.message)
  if (!workspace) notFound()

  const [pagesRes, snapshotsRes, clustersRes, mentionsRes, nieuwsRes] = await Promise.all([
    supabase.from('pillar_pages').select('id, has_schema').eq('workspace_id', workspaceId),
    supabase
      .from('gsc_snapshots')
      .select('clicks, snapshot_date, pillar_pages!inner(workspace_id)')
      .eq('pillar_pages.workspace_id', workspaceId)
      .gte('snapshot_date', sinceDate),
    supabase.from('intent_clusters').select('id').eq('workspace_id', workspaceId),
    supabase.from('llm_mentions').select('id, intent_cluster_id, mentioned, checked_at'),
    supabase.from('nieuws').select('id, review_status').eq('workspace_id', workspaceId)
  ])

  if (pagesRes.error || snapshotsRes.error || clustersRes.error || mentionsRes.error || nieuwsRes.error) {
    throw new Error('Kon workspace statistieken niet laden.')
  }

  const clusterIds = new Set((clustersRes.data ?? []).map((cluster) => cluster.id))
  const mentions30d = (mentionsRes.data ?? []).filter(
    (item) => item.mentioned && clusterIds.has(item.intent_cluster_id) && item.checked_at >= since.toISOString()
  ).length

  const pages = pagesRes.data ?? []
  const pendingNieuws = (nieuwsRes.data ?? []).filter((item) => item.review_status === 'pending').length

  return {
    id: workspace.id,
    domain: workspace.domain,
    displayName: workspace.domain,
    pages: pages.length,
    pagesWithSchema: pages.filter((page) => page.has_schema).length,
    clicks30d: (snapshotsRes.data ?? []).reduce((sum, snapshot) => sum + snapshot.clicks, 0),
    mentions30d,
    pendingNieuws
  }
}
