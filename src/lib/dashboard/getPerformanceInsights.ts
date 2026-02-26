import { createClient } from '@/lib/supabase/server'

interface PageMetric {
  id: string
  workspace_id: string
  domain: string
  title: string
  url: string
  clicks: number
  impressions: number
  ctr: number
  avgPosition: number
  sessions: number
  engagementRate: number
}

export interface PerformanceInsights {
  byDomain: Array<{
    domain: string
    clicks: number
    impressions: number
    sessions: number
    avgCtr: number
    avgPosition: number
    pages: number
  }>
  pages: PageMetric[]
}

export async function getPerformanceInsights(): Promise<PerformanceInsights> {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - 60)
  const sinceDate = since.toISOString().slice(0, 10)

  const [{ data: workspaces }, { data: pages }] = await Promise.all([
    supabase.from('workspaces').select('id,domain'),
    supabase.from('pillar_pages').select('id,workspace_id,title,url')
  ])

  const workspaceMap = new Map((workspaces ?? []).map((w) => [w.id, w.domain]))
  const pageRows = pages ?? []
  const pageIds = pageRows.map((p) => p.id)

  let gscRows: Array<{ pillar_page_id: string; clicks: number; impressions: number; ctr: number; avg_position: number }> = []
  if (pageIds.length) {
    const { data } = await supabase
      .from('gsc_snapshots')
      .select('pillar_page_id,clicks,impressions,ctr,avg_position,snapshot_date')
      .in('pillar_page_id', pageIds)
      .gte('snapshot_date', sinceDate)
    gscRows = data ?? []
  }

  let gaRows: Array<{ workspace_id: string; page_url: string; sessions: number; engagement_rate: number }> = []
  if ((workspaces ?? []).length) {
    const workspaceIds = (workspaces ?? []).map((w) => w.id)
    const { data } = await supabase
      .from('ga4_page_snapshots')
      .select('workspace_id,page_url,sessions,engagement_rate,snapshot_date')
      .in('workspace_id', workspaceIds)
      .gte('snapshot_date', sinceDate)
    gaRows = data ?? []
  }

  const gscByPage = new Map<string, { clicks: number; impressions: number; ctrSum: number; ctrN: number; posSum: number; posN: number }>()
  gscRows.forEach((r) => {
    const cur = gscByPage.get(r.pillar_page_id) ?? { clicks: 0, impressions: 0, ctrSum: 0, ctrN: 0, posSum: 0, posN: 0 }
    cur.clicks += Number(r.clicks ?? 0)
    cur.impressions += Number(r.impressions ?? 0)
    cur.ctrSum += Number(r.ctr ?? 0)
    cur.ctrN += 1
    cur.posSum += Number(r.avg_position ?? 0)
    cur.posN += 1
    gscByPage.set(r.pillar_page_id, cur)
  })

  const gaByUrl = new Map<string, { sessions: number; erSum: number; erN: number }>()
  gaRows.forEach((r) => {
    const key = `${r.workspace_id}|${normalizePathFromUrl(r.page_url)}`
    const cur = gaByUrl.get(key) ?? { sessions: 0, erSum: 0, erN: 0 }
    cur.sessions += Number(r.sessions ?? 0)
    cur.erSum += Number(r.engagement_rate ?? 0)
    cur.erN += 1
    gaByUrl.set(key, cur)
  })

  const pagesMetrics: PageMetric[] = pageRows.map((p) => {
    const g = gscByPage.get(p.id)
    const ga = gaByUrl.get(`${p.workspace_id}|${normalizePathFromUrl(p.url)}`)

    return {
      id: p.id,
      workspace_id: p.workspace_id,
      domain: workspaceMap.get(p.workspace_id) ?? 'unknown',
      title: p.title,
      url: p.url,
      clicks: g?.clicks ?? 0,
      impressions: g?.impressions ?? 0,
      ctr: g && g.ctrN ? g.ctrSum / g.ctrN : 0,
      avgPosition: g && g.posN ? g.posSum / g.posN : 0,
      sessions: ga?.sessions ?? 0,
      engagementRate: ga && ga.erN ? ga.erSum / ga.erN : 0
    }
  })

  const byDomainMap = new Map<string, { clicks: number; impressions: number; sessions: number; ctrSum: number; ctrN: number; posSum: number; posN: number; pages: number }>()
  pagesMetrics.forEach((p) => {
    const cur = byDomainMap.get(p.domain) ?? { clicks: 0, impressions: 0, sessions: 0, ctrSum: 0, ctrN: 0, posSum: 0, posN: 0, pages: 0 }
    cur.clicks += p.clicks
    cur.impressions += p.impressions
    cur.sessions += p.sessions
    cur.ctrSum += p.ctr
    cur.ctrN += 1
    cur.posSum += p.avgPosition
    cur.posN += p.avgPosition > 0 ? 1 : 0
    cur.pages += 1
    byDomainMap.set(p.domain, cur)
  })

  const byDomain = [...byDomainMap.entries()].map(([domain, v]) => ({
    domain,
    clicks: v.clicks,
    impressions: v.impressions,
    sessions: v.sessions,
    avgCtr: v.ctrN ? v.ctrSum / v.ctrN : 0,
    avgPosition: v.posN ? v.posSum / v.posN : 0,
    pages: v.pages
  }))

  const pagesSorted = pagesMetrics.sort((a, b) => b.clicks + b.sessions - (a.clicks + a.sessions)).slice(0, 80)

  return { byDomain, pages: pagesSorted }
}

function normalizePathFromUrl(input: string | null | undefined) {
  if (!input) return '/'
  try {
    const u = new URL(input)
    return normalizePath(u.pathname)
  } catch {
    return normalizePath(input)
  }
}

function normalizePath(path: string | null | undefined) {
  if (!path) return '/'
  const p = path.trim()
  if (!p) return '/'
  const withSlash = p.startsWith('/') ? p : `/${p}`
  const noTrailing = withSlash.replace(/\/$/, '')
  return (noTrailing || '/').toLowerCase()
}
