import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getPerformanceInsights } from '@/lib/dashboard/getPerformanceInsights'

export default async function PerformancePage() {
  const data = await getPerformanceInsights()

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Performance Insights</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Site-breed overzicht: wat goed presteert en wat aandacht nodig heeft (laatste 60 dagen).</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {data.byDomain.map((d) => (
          <Card key={d.domain} className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{d.domain}</CardTitle>
              <CardDescription>{d.pages} gemonitorde pagina's</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <Metric label="Clicks" value={d.clicks.toLocaleString('nl-NL')} />
              <Metric label="Impressions" value={d.impressions.toLocaleString('nl-NL')} />
              <Metric label="Sessions" value={d.sessions.toLocaleString('nl-NL')} />
              <Metric label="Gem. CTR" value={`${(d.avgCtr * 100).toFixed(1)}%`} />
            </CardContent>
          </Card>
        ))}
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
                {data.pages.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500">Nog geen performance data.</TableCell></TableRow>
                ) : (
                  data.pages.map((p) => (
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
            {data.pages.slice(0, 30).map((p) => (
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
