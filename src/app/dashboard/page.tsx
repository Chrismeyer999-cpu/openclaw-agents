import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getOverviewData } from '@/lib/dashboard/getOverviewData'
import { getCostOverview } from '@/lib/dashboard/getCostOverview'
import { getGoogleStatus } from '@/lib/dashboard/getGoogleStatus'
import { getTodos } from '@/lib/dashboard/getTodos'
import { TodoListCard } from '@/components/dashboard/TodoListCard'
import { GoogleSyncCard } from '@/components/dashboard/GoogleSyncCard'
import { KpiStrip, SoftPill, StatusPills } from '@/components/dashboard/KpiStrip'
import Link from 'next/link'

export default async function DashboardPage() {
  const [overview, cost, google, todos] = await Promise.all([getOverviewData(), getCostOverview(), getGoogleStatus(), getTodos(8)])

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-gradient-to-r from-white to-orange-50/60 p-5 shadow-sm dark:border-gray-800 dark:from-gray-900 dark:to-gray-900">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Dashboard Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Live overzicht van SEO, LLM, kosten en operationele voortgang over alle workspaces.</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/dashboard/nieuws" className="inline-flex rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700">Nieuws Center</Link>
          <Link href="/dashboard/google" className="inline-flex rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">Google Connections</Link>
          <Link href="/dashboard/status" className="inline-flex rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">Roadmap & Status</Link>
        </div>
      </header>

      <KpiStrip
        items={[
          { label: 'Organic clicks (30d)', value: overview.totalClicks30d.toLocaleString('nl-NL'), hint: 'Search Console', tone: 'default' },
          { label: 'LLM mentions (30d)', value: overview.totalMentions30d.toLocaleString('nl-NL'), hint: 'AI visibility', tone: 'success' },
          { label: 'Structured coverage', value: `${overview.structuredCoverage}%`, hint: 'Schema health', tone: 'default' },
          { label: 'Pending nieuws', value: overview.pendingNieuws.toLocaleString('nl-NL'), hint: 'Review queue', tone: overview.pendingNieuws > 0 ? 'warning' : 'default' },
          { label: 'Agent spend (month)', value: cost ? `$${cost.monthUsd.toFixed(2)}` : 'n/a', hint: `${cost?.overBudgetAgents ?? 0} over budget`, tone: (cost?.overBudgetAgents ?? 0) > 0 ? 'danger' : 'default' }
        ]}
      />

      <StatusPills>
        <SoftPill>Google Search Console: {google ? `${google.gscConnected}/${google.gscTotal} workspaces gekoppeld` : 'onbekend'}</SoftPill>
        <Badge variant={google?.ga4Ready ? 'secondary' : 'destructive'}>GA4 sync: {google?.ga4Ready ? 'ready' : 'niet geconfigureerd'}</Badge>
        <Badge variant={cost?.overBudgetAgents ? 'destructive' : 'secondary'}>Agent budget alerts: {cost?.overBudgetAgents ?? 0}</Badge>
      </StatusPills>

      <div className="grid gap-4 lg:grid-cols-2">
        <TodoListCard items={todos} />
        <GoogleSyncCard />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {overview.workspaceStats.map((workspace) => {
          const schemaCoverage = workspace.pages === 0 ? 0 : Math.round((workspace.pagesWithSchema / workspace.pages) * 100)
          return (
            <Card key={workspace.id} className="overflow-hidden border-gray-200/90 shadow-sm dark:border-gray-800">
              <CardHeader className="space-y-1 bg-gradient-to-r from-white to-gray-50 dark:from-gray-900 dark:to-gray-900">
                <CardTitle className="text-base">{workspace.domain}</CardTitle>
                <CardDescription>{workspace.displayName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <StatItem label="Pages" value={workspace.pages} />
                  <StatItem label="Schema" value={`${schemaCoverage}%`} />
                  <StatItem label="Clicks 30d" value={workspace.clicks30d} />
                  <StatItem label="LLM 30d" value={workspace.mentions30d} />
                </div>
                <div className="flex items-center justify-between rounded-md border border-gray-200 p-2 dark:border-gray-800">
                  <Badge variant={workspace.pendingNieuws > 0 ? 'destructive' : 'secondary'}>
                    Pending nieuws: {workspace.pendingNieuws}
                  </Badge>
                  <Link href={`/dashboard/${workspace.id}`} className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-200">
                    Open workspace →
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Top pages op clicks (30d)</CardTitle>
            <CardDescription>Gescorteerd op GSC-clicks over de laatste 30 dagen.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pagina</TableHead>
                  <TableHead>Domein</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.topPages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nog geen GSC-data gevonden. Koppel Google Connections en run een sync.
                    </TableCell>
                  </TableRow>
                ) : (
                  overview.topPages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className="max-w-[260px] truncate">{page.title}</TableCell>
                      <TableCell>{page.domain}</TableCell>
                      <TableCell className="text-right font-medium">{page.clicks30d.toLocaleString('nl-NL')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Pending nieuws</CardTitle>
            <CardDescription>Laatste items met review-status `pending`.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titel</TableHead>
                  <TableHead>Domein</TableHead>
                  <TableHead className="text-right">Datum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.pendingItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      Geen pending nieuwsitems. Netjes — queue is leeg.
                    </TableCell>
                  </TableRow>
                ) : (
                  overview.pendingItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-[260px] truncate">{item.title}</TableCell>
                      <TableCell>{item.domain}</TableCell>
                      <TableCell className="text-right text-xs text-gray-500 dark:text-gray-400">
                        {new Date(item.created_at).toLocaleDateString('nl-NL')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function StatItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-2 dark:border-gray-800 dark:bg-gray-900/60">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  )
}
