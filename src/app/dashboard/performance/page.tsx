import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getPerformanceInsights } from '@/lib/dashboard/getPerformanceInsights'
import Link from 'next/link'
import { TopPagesBarChart, TrendLineChart } from '@/components/dashboard/PerformanceCharts'

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const params = await searchParams
  const selectedSite = params.site ?? 'all'
  const data = await getPerformanceInsights()
  const domains = data.byDomain.map((d) => d.domain)
  const filteredDomains = selectedSite === 'all' ? data.byDomain : data.byDomain.filter((d) => d.domain === selectedSite)
  const filteredPages = selectedSite === 'all' ? data.pages : data.pages.filter((p) => p.domain === selectedSite)

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Performance Insights</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Site-breed overzicht: wat goed presteert en wat aandacht nodig heeft (laatste 60 dagen).</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <TabLink label="Alle sites" active={selectedSite === 'all'} href="/dashboard/performance" />
        {domains.map((d) => (
          <TabLink key={d} label={d} active={selectedSite === d} href={`/dashboard/performance?site=${encodeURIComponent(d)}`} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {filteredDomains.map((d) => (
          <Card key={d.domain} className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{d.domain}</CardTitle>
              <CardDescription>{d.pages} gemonitorde pagina's</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Clicks" value={d.clicks.toLocaleString('nl-NL')} />
                <Metric label="Impressions" value={d.impressions.toLocaleString('nl-NL')} />
                <Metric label="Sessions" value={d.sessions.toLocaleString('nl-NL')} />
                <Metric label="Gem. CTR" value={`${(d.avgCtr * 100).toFixed(1)}%`} />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant={d.deltaClicksPct >= 0 ? 'secondary' : 'destructive'}>
                  Clicks {d.deltaClicksPct >= 0 ? '+' : ''}{d.deltaClicksPct.toFixed(1)}%
                </Badge>
                <Badge variant={d.deltaSessionsPct >= 0 ? 'secondary' : 'destructive'}>
                  Sessions {d.deltaSessionsPct >= 0 ? '+' : ''}{d.deltaSessionsPct.toFixed(1)}%
                </Badge>
              </div>
              <MiniTrend
                points={data.trendByDomain.find((t) => t.domain === d.domain)?.points ?? []}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendLineChart
          title={selectedSite === 'all' ? 'Trend alle sites (clicks vs sessions)' : `Trend ${selectedSite}`}
          points={
            selectedSite === 'all'
              ? mergeTrend(data.trendByDomain)
              : data.trendByDomain.find((t) => t.domain === selectedSite)?.points ?? []
          }
        />
        <TopPagesBarChart
          title={selectedSite === 'all' ? 'Top pagina’s (combined traffic)' : `Top pagina’s ${selectedSite}`}
          pages={filteredPages.map((p) => ({ title: p.title, clicks: p.clicks, sessions: p.sessions }))}
        />
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Pagina performance</CardTitle>
          <CardDescription>Top pagina’s op gecombineerde traffic (GSC + GA4).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pagina</TableHead>
                  <TableHead>Domein</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Impr.</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Pos.</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPages.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500">Nog geen performance data.</TableCell></TableRow>
                ) : (
                  filteredPages.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-[280px] truncate">{p.title}</TableCell>
                      <TableCell>{p.domain}</TableCell>
                      <TableCell className="text-right">{p.clicks}</TableCell>
                      <TableCell className="text-right">{p.impressions}</TableCell>
                      <TableCell className="text-right">{(p.ctr * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{p.avgPosition ? p.avgPosition.toFixed(1) : '-'}</TableCell>
                      <TableCell className="text-right">{p.sessions}</TableCell>
                      <TableCell>{statusBadge(p.impressions, p.ctr, p.sessions)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 md:hidden">
            {filteredPages.slice(0, 30).map((p) => (
              <div key={p.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
                <p className="text-xs text-gray-500">{p.domain}</p>
                <div className="mt-1 grid grid-cols-2 gap-1 text-xs">
                  <span>Clicks: {p.clicks}</span>
                  <span>Sessions: {p.sessions}</span>
                  <span>CTR: {(p.ctr * 100).toFixed(1)}%</span>
                  <span>Pos: {p.avgPosition ? p.avgPosition.toFixed(1) : '-'}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/60 p-2 dark:border-gray-800 dark:bg-gray-900/50">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function statusBadge(impressions: number, ctr: number, sessions: number) {
  if (impressions > 200 && ctr < 0.02) return <Badge variant="outline">Quick win</Badge>
  if (sessions > 50 && ctr > 0.03) return <Badge variant="secondary">Winner</Badge>
  if (impressions < 20 && sessions < 10) return <Badge variant="outline">Low traffic</Badge>
  return <Badge variant="outline">Monitor</Badge>
}

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-medium ${active ? 'bg-orange-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200'}`}
    >
      {label}
    </Link>
  )
}

function mergeTrend(trends: Array<{ domain: string; points: Array<{ date: string; clicks: number; sessions: number }> }>) {
  const map = new Map<string, { clicks: number; sessions: number }>()
  trends.forEach((t) => {
    t.points.forEach((p) => {
      const cur = map.get(p.date) ?? { clicks: 0, sessions: 0 }
      cur.clicks += p.clicks
      cur.sessions += p.sessions
      map.set(p.date, cur)
    })
  })
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, v]) => ({ date, clicks: v.clicks, sessions: v.sessions }))
}

function MiniTrend({ points }: { points: Array<{ date: string; clicks: number; sessions: number }> }) {
  if (!points.length) return <p className="text-[11px] text-gray-500">Nog geen trenddata.</p>

  const max = Math.max(1, ...points.map((p) => p.clicks + p.sessions))

  return (
    <div>
      <p className="mb-1 text-[11px] text-gray-500">Trend laatste 14 meetpunten</p>
      <div className="flex h-12 items-end gap-1">
        {points.map((p) => {
          const val = p.clicks + p.sessions
          const h = Math.max(8, Math.round((val / max) * 44))
          return (
            <div key={p.date} className="group relative flex-1 rounded-sm bg-orange-200/70 dark:bg-orange-500/40" style={{ height: `${h}px` }}>
              <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                {p.clicks}c / {p.sessions}s
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
