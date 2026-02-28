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
    deltaClicksPct: number
    deltaSessionsPct: number
  }>
  pages: PageMetric[]
  trendByDomain: Array<{
    domain: string
    points: Array<{ date: string; clicks: number; sessions: number }>
  }>
}

export async function getPerformanceInsights(): Promise<PerformanceInsights> {
  try {
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

    const mid = new Date()
    mid.setDate(mid.getDate() - 30)
    const midDate = mid.toISOString().slice(0, 10)

    const clicksByDomainNow = new Map<string, number>()
    const clicksByDomainPrev = new Map<string, number>()
    const pageDomainById = new Map(pageRows.map((p) => [p.id, workspaceMap.get(p.workspace_id) ?? 'unknown']))
    gscRows.forEach((r: any) => {
      const domain = pageDomainById.get(r.pillar_page_id) ?? 'unknown'
      const target = r.snapshot_date >= midDate ? clicksByDomainNow : clicksByDomainPrev
      target.set(domain, (target.get(domain) ?? 0) + Number(r.clicks ?? 0))
    })

    const sessionsByDomainNow = new Map<string, number>()
    const sessionsByDomainPrev = new Map<string, number>()
    const domainByWorkspace = new Map((workspaces ?? []).map((w) => [w.id, w.domain]))
    gaRows.forEach((r: any) => {
      const domain = domainByWorkspace.get(r.workspace_id) ?? 'unknown'
      const target = r.snapshot_date >= midDate ? sessionsByDomainNow : sessionsByDomainPrev
      target.set(domain, (target.get(domain) ?? 0) + Number(r.sessions ?? 0))
    })

    const byDomain = [...byDomainMap.entries()].map(([domain, v]) => {
      const cNow = clicksByDomainNow.get(domain) ?? 0
      const cPrev = clicksByDomainPrev.get(domain) ?? 0
      const sNow = sessionsByDomainNow.get(domain) ?? 0
      const sPrev = sessionsByDomainPrev.get(domain) ?? 0

      const deltaClicksPct = cPrev > 0 ? ((cNow - cPrev) / cPrev) * 100 : cNow > 0 ? 100 : 0
      const deltaSessionsPct = sPrev > 0 ? ((sNow - sPrev) / sPrev) * 100 : sNow > 0 ? 100 : 0

      return {
        domain,
        clicks: v.clicks,
        impressions: v.impressions,
        sessions: v.sessions,
        avgCtr: v.ctrN ? v.ctrSum / v.ctrN : 0,
        avgPosition: v.posN ? v.posSum / v.posN : 0,
        pages: v.pages,
        deltaClicksPct,
        deltaSessionsPct
      }
    })

    const gscDaily = new Map<string, Map<string, number>>()
    gscRows.forEach((r: any) => {
      const domain = pageDomainById.get(r.pillar_page_id) ?? 'unknown'
      const date = r.snapshot_date
      if (!gscDaily.has(domain)) gscDaily.set(domain, new Map())
      const d = gscDaily.get(domain)!
      d.set(date, (d.get(date) ?? 0) + Number(r.clicks ?? 0))
    })

    const gaDaily = new Map<string, Map<string, number>>()
    gaRows.forEach((r: any) => {
      const domain = domainByWorkspace.get(r.workspace_id) ?? 'unknown'
      const date = r.snapshot_date
      if (!gaDaily.has(domain)) gaDaily.set(domain, new Map())
      const d = gaDaily.get(domain)!
      d.set(date, (d.get(date) ?? 0) + Number(r.sessions ?? 0))
    })

    const trendByDomain = byDomain.map((d) => {
      const clickMap = gscDaily.get(d.domain) ?? new Map<string, number>()
      const sessMap = gaDaily.get(d.domain) ?? new Map<string, number>()
      const dates = Array.from(new Set([...clickMap.keys()])).sort().slice(-14)
      return {
        domain: d.domain,
        points: dates.map((date) => ({ date, clicks: clickMap.get(date) ?? 0, sessions: sessMap.get(date) ?? 0 }))
      }
    })

    const pagesSorted = pagesMetrics.sort((a, b) => b.clicks + b.sessions - (a.clicks + a.sessions)).slice(0, 80)

    return { byDomain, pages: pagesSorted, trendByDomain }
  } catch {
    return { byDomain: [], pages: [], trendByDomain: [] }
  }
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
