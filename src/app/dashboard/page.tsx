import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getOverviewData } from '@/lib/dashboard/getOverviewData'
import { Newspaper, Search, TextSearch } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const overview = await getOverviewData()

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Dashboard Overview</h1>
        <p className="text-sm text-gray-500">Live overzicht van SEO- en LLM-signalen over alle workspaces.</p>
        <Link href="/dashboard/nieuws" className="inline-flex text-sm font-medium text-orange-600 hover:text-orange-700">
          Open centraal Nieuws Center
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Search className="size-4 text-orange-500" />} label="Organic clicks (30d)" value={overview.totalClicks30d.toLocaleString('nl-NL')} />
        <MetricCard icon={<TextSearch className="size-4 text-emerald-600" />} label="LLM mentions (30d)" value={overview.totalMentions30d.toLocaleString('nl-NL')} />
        <MetricCard icon={<Badge variant="outline">{overview.structuredCoverage}%</Badge>} label="Structured coverage" value={`${overview.structuredCoverage}%`} />
        <MetricCard icon={<Newspaper className="size-4 text-red-500" />} label="Pending nieuws" value={overview.pendingNieuws.toLocaleString('nl-NL')} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {overview.workspaceStats.map((workspace) => {
          const schemaCoverage = workspace.pages === 0 ? 0 : Math.round((workspace.pagesWithSchema / workspace.pages) * 100)
          return (
            <Card key={workspace.id}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base">{workspace.domain}</CardTitle>
                <CardDescription>{workspace.displayName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <StatItem label="Pages" value={workspace.pages} />
                  <StatItem label="Schema" value={`${schemaCoverage}%`} />
                  <StatItem label="Clicks 30d" value={workspace.clicks30d} />
                  <StatItem label="LLM 30d" value={workspace.mentions30d} />
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={workspace.pendingNieuws > 0 ? 'destructive' : 'secondary'}>
                    Pending nieuws: {workspace.pendingNieuws}
                  </Badge>
                  <Link href={`/dashboard/${workspace.id}`} className="text-sm font-medium text-orange-600 hover:text-orange-700">
                    Open workspace
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
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
                    <TableCell colSpan={3} className="text-center text-sm text-gray-500">
                      Nog geen GSC-data gevonden.
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
        <Card>
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
                    <TableCell colSpan={3} className="text-center text-sm text-gray-500">
                      Geen pending nieuwsitems.
                    </TableCell>
                  </TableRow>
                ) : (
                  overview.pendingItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-[260px] truncate">{item.title}</TableCell>
                      <TableCell>{item.domain}</TableCell>
                      <TableCell className="text-right text-xs text-gray-500">
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

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="text-xs uppercase tracking-wide">{label}</CardDescription>
        {icon}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  )
}

function StatItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-gray-200 p-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  )
}
