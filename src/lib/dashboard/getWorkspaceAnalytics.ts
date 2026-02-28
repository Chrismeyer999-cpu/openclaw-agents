import { createClient } from '@/lib/supabase/server'

export interface TrafficPoint {
    date: string
    clicks: number
    impressions: number
    sessions: number
}

export interface TopPage {
    id: string
    title: string
    url: string
    clicks: number
    impressions: number
    ctr: number
    avgPosition: number
    sessions: number
    has_schema: boolean
    target_keywords: string[]
    page_type: string
}

export interface RankingOpportunity {
    title: string
    url: string
    avgPosition: number
    impressions: number
    clicks: number
    ctr: number
    // position 4-20 with decent impressions = low-hanging fruit
    opportunityScore: number
}

export interface WorkspaceAnalytics {
    domain: string
    // 30-day aggregates
    totalClicks: number
    totalImpressions: number
    totalSessions: number
    avgCtr: number
    avgPosition: number
    // Period-on-period deltas
    deltaClicksPct: number
    deltaImpressionsPct: number
    deltaSessionsPct: number
    // Daily trend for chart (last 30 days)
    trend: TrafficPoint[]
    // Top performing pages
    topPages: TopPage[]
    // Pages that can rank better (pos 4-20 with impressions)
    opportunities: RankingOpportunity[]
    // Missing schema pages
    missingSchemaPages: { title: string; url: string }[]
    // Low CTR high-impression pages (could improve title/meta)
    lowCtrPages: { title: string; url: string; ctr: number; impressions: number; avgPosition: number }[]
}

export async function getWorkspaceAnalytics(workspaceId: string): Promise<WorkspaceAnalytics | null> {
    try {
        const supabase = await createClient()

        const now = new Date()
        const since30 = new Date(now); since30.setDate(now.getDate() - 30)
        const since60 = new Date(now); since60.setDate(now.getDate() - 60)
        const sinceDate30 = since30.toISOString().slice(0, 10)
        const sinceDate60 = since60.toISOString().slice(0, 10)

        // Load workspace
        const { data: workspace } = await supabase
            .from('workspaces')
            .select('id, domain')
            .eq('id', workspaceId)
            .maybeSingle()

        if (!workspace) return null

        // Load all pages for this workspace
        const { data: pagesRaw } = await supabase
            .from('pillar_pages')
            .select('id, title, url, has_schema, target_keywords, page_type')
            .eq('workspace_id', workspaceId)

        const pages = pagesRaw ?? []
        const pageIds = pages.map((p) => p.id)

        if (pageIds.length === 0) {
            return {
                domain: workspace.domain,
                totalClicks: 0,
                totalImpressions: 0,
                totalSessions: 0,
                avgCtr: 0,
                avgPosition: 0,
                deltaClicksPct: 0,
                deltaImpressionsPct: 0,
                deltaSessionsPct: 0,
                trend: [],
                topPages: [],
                opportunities: [],
                missingSchemaPages: [],
                lowCtrPages: []
            }
        }

        // Fetch GSC snapshots safely in chunks to avoid URL limit and max-rows limits
        const gscData: any[] = []
        const chunkSize = 15 // ensures URL size < 4KB and max returned rows < 1000
        const promises = []
        for (let i = 0; i < pageIds.length; i += chunkSize) {
            const chunk = pageIds.slice(i, i + chunkSize)
            promises.push(
                supabase
                    .from('gsc_snapshots')
                    .select('pillar_page_id, clicks, impressions, ctr, avg_position, snapshot_date')
                    .in('pillar_page_id', chunk)
                    .gte('snapshot_date', sinceDate60)
            )
        }
        for (let i = 0; i < promises.length; i += 5) {
            const results = await Promise.all(promises.slice(i, i + 5))
            results.forEach(({ data }) => {
                if (data) gscData.push(...data)
            })
        }
        gscData.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))

        // Fetch GA4 sessions safely handling max-rows using pagination loop
        const gaData: any[] = []
        let offset = 0
        const limitSize = 1000
        while (true) {
            const { data: gaChunk } = await supabase
                .from('ga4_page_snapshots')
                .select('page_url, sessions, snapshot_date')
                .eq('workspace_id', workspaceId)
                .gte('snapshot_date', sinceDate60)
                .range(offset, offset + limitSize - 1)

            if (!gaChunk || gaChunk.length === 0) break
            gaData.push(...gaChunk)
            if (gaChunk.length < limitSize) break
            offset += limitSize
        }
        gaData.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))

        // Build page index
        const pageMap = new Map(pages.map((p) => [p.id, p]))

        // Split into current 30d vs previous 30d
        const gsc30 = gscData.filter((r) => r.snapshot_date >= sinceDate30)
        const gscPrev = gscData.filter((r) => r.snapshot_date < sinceDate30)
        const ga30 = gaData.filter((r) => r.snapshot_date >= sinceDate30)
        const gaPrev = gaData.filter((r) => r.snapshot_date < sinceDate30)

        // Aggregate 30d totals
        const totalClicks = gsc30.reduce((s, r) => s + Number(r.clicks ?? 0), 0)
        const totalImpressions = gsc30.reduce((s, r) => s + Number(r.impressions ?? 0), 0)
        const totalSessions = ga30.reduce((s, r) => s + Number(r.sessions ?? 0), 0)
        const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
        const avgPos = gsc30.filter(r => Number(r.avg_position ?? 0) > 0)
        const avgPosition = avgPos.length > 0 ? avgPos.reduce((s, r) => s + Number(r.avg_position), 0) / avgPos.length : 0

        // Previous period totals for delta
        const prevClicks = gscPrev.reduce((s, r) => s + Number(r.clicks ?? 0), 0)
        const prevImpressions = gscPrev.reduce((s, r) => s + Number(r.impressions ?? 0), 0)
        const prevSessions = gaPrev.reduce((s, r) => s + Number(r.sessions ?? 0), 0)

        const deltaClicksPct = prevClicks > 0 ? ((totalClicks - prevClicks) / prevClicks) * 100 : totalClicks > 0 ? 100 : 0
        const deltaImpressionsPct = prevImpressions > 0 ? ((totalImpressions - prevImpressions) / prevImpressions) * 100 : 0
        const deltaSessionsPct = prevSessions > 0 ? ((totalSessions - prevSessions) / prevSessions) * 100 : totalSessions > 0 ? 100 : 0

        // Daily trend (last 30d) - aggregate by date
        const clicksByDate = new Map<string, number>()
        const impressionsByDate = new Map<string, number>()
        gsc30.forEach((r) => {
            const d = r.snapshot_date
            clicksByDate.set(d, (clicksByDate.get(d) ?? 0) + Number(r.clicks ?? 0))
            impressionsByDate.set(d, (impressionsByDate.get(d) ?? 0) + Number(r.impressions ?? 0))
        })
        const sessionsByDate = new Map<string, number>()
        ga30.forEach((r) => {
            const d = r.snapshot_date
            sessionsByDate.set(d, (sessionsByDate.get(d) ?? 0) + Number(r.sessions ?? 0))
        })

        // Generate dates up to the most recent GSC data point (GSC lags 2-3 days, GA4 is faster. Capping at GSC prevents 0-drops for clicks/impr.)
        let maxDateStr = sinceDate30
        gsc30.forEach(r => { if (r.snapshot_date > maxDateStr) maxDateStr = r.snapshot_date })

        const allDates: string[] = []
        let current = new Date(since30)
        while (current.toISOString().slice(0, 10) <= maxDateStr) {
            allDates.push(current.toISOString().slice(0, 10))
            current.setDate(current.getDate() + 1)
        }

        const trend: TrafficPoint[] = allDates.map((date) => ({
            date,
            clicks: clicksByDate.get(date) ?? 0,
            impressions: impressionsByDate.get(date) ?? 0,
            sessions: sessionsByDate.get(date) ?? 0
        }))

        // Per-page metrics in 30d
        const pageMetrics = new Map<string, { clicks: number; impressions: number; ctrSum: number; ctrN: number; posSum: number; posN: number }>()
        gsc30.forEach((r) => {
            const cur = pageMetrics.get(r.pillar_page_id) ?? { clicks: 0, impressions: 0, ctrSum: 0, ctrN: 0, posSum: 0, posN: 0 }
            cur.clicks += Number(r.clicks ?? 0)
            cur.impressions += Number(r.impressions ?? 0)
            cur.ctrSum += Number(r.ctr ?? 0)
            cur.ctrN += 1
            if (Number(r.avg_position) > 0) {
                cur.posSum += Number(r.avg_position)
                cur.posN += 1
            }
            pageMetrics.set(r.pillar_page_id, cur)
        })

        // GA sessions per URL
        const gaSessionsByUrl = new Map<string, number>()
        ga30.forEach((r) => {
            const url = normalizeUrl(r.page_url)
            gaSessionsByUrl.set(url, (gaSessionsByUrl.get(url) ?? 0) + Number(r.sessions ?? 0))
        })

        // Build top pages
        const topPages: TopPage[] = pages
            .map((p) => {
                const m = pageMetrics.get(p.id)
                const sessions = gaSessionsByUrl.get(normalizeUrl(p.url)) ?? 0
                return {
                    id: p.id,
                    title: p.title,
                    url: p.url,
                    clicks: m?.clicks ?? 0,
                    impressions: m?.impressions ?? 0,
                    ctr: m && m.ctrN > 0 ? m.ctrSum / m.ctrN : 0,
                    avgPosition: m && m.posN > 0 ? m.posSum / m.posN : 0,
                    sessions,
                    has_schema: p.has_schema,
                    target_keywords: p.target_keywords ?? [],
                    page_type: p.page_type
                }
            })
            .filter((p) => p.clicks > 0 || p.impressions > 0 || p.sessions > 0)
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 20)

        // Ranking opportunities: pos 4-20, impressions > 50
        const opportunities: RankingOpportunity[] = pages
            .map((p) => {
                const m = pageMetrics.get(p.id)
                if (!m) return null
                const avgPos = m.posN > 0 ? m.posSum / m.posN : 0
                if (avgPos < 3.5 || avgPos > 25 || m.impressions < 30) return null
                // Score: high impressions + position 4-10 = biggest opportunity
                const opportunityScore = (m.impressions / Math.max(1, avgPos)) * (avgPos <= 10 ? 2 : 1)
                return {
                    title: p.title,
                    url: p.url,
                    avgPosition: avgPos,
                    impressions: m.impressions,
                    clicks: m.clicks,
                    ctr: m.ctrN > 0 ? m.ctrSum / m.ctrN : 0,
                    opportunityScore
                }
            })
            .filter(Boolean)
            .sort((a, b) => b!.opportunityScore - a!.opportunityScore)
            .slice(0, 8) as RankingOpportunity[]

        // Missing schema pages (has_schema = false)
        const missingSchemaPages = pages
            .filter((p) => !p.has_schema)
            .slice(0, 6)
            .map((p) => ({ title: p.title, url: p.url }))

        // Low CTR but high impressions (could improve title/meta description)
        const lowCtrPages = pages
            .map((p) => {
                const m = pageMetrics.get(p.id)
                if (!m || m.impressions < 50) return null
                const ctr = m.ctrN > 0 ? m.ctrSum / m.ctrN : 0
                const avgPos = m.posN > 0 ? m.posSum / m.posN : 0
                if (ctr > 0.03) return null // above 3% CTR is fine
                return { title: p.title, url: p.url, ctr, impressions: m.impressions, avgPosition: avgPos }
            })
            .filter(Boolean)
            .sort((a, b) => b!.impressions - a!.impressions)
            .slice(0, 6) as { title: string; url: string; ctr: number; impressions: number; avgPosition: number }[]

        return {
            domain: workspace.domain,
            totalClicks,
            totalImpressions,
            totalSessions,
            avgCtr,
            avgPosition,
            deltaClicksPct,
            deltaImpressionsPct,
            deltaSessionsPct,
            trend,
            topPages,
            opportunities,
            missingSchemaPages,
            lowCtrPages
        }
    } catch (e) {
        console.error('getWorkspaceAnalytics error', e)
        return null
    }
}

function normalizeUrl(input: string | null | undefined): string {
    if (!input) return '/'
    try {
        return new URL(input).pathname.toLowerCase().replace(/\/$/, '') || '/'
    } catch {
        return (input ?? '/').toLowerCase().replace(/\/$/, '') || '/'
    }
}
