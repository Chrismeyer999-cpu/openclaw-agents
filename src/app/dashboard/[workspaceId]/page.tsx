import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getWorkspaceStats } from '@/lib/dashboard/getWorkspaceStats'

export default async function WorkspaceOverviewPage({
  params
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const stats = await getWorkspaceStats(workspaceId)
  const schemaCoverage = stats.pages === 0 ? 0 : Math.round((stats.pagesWithSchema / stats.pages) * 100)

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <InfoCard title="Pillar pages" description="Aantal pagina's in workspace" value={stats.pages.toLocaleString('nl-NL')} />
      <InfoCard title="Schema coverage" description="Pages met schema" value={`${schemaCoverage}%`} />
      <InfoCard title="Organic clicks (30d)" description="Som GSC clicks laatste 30 dagen" value={stats.clicks30d.toLocaleString('nl-NL')} />
      <InfoCard title="LLM mentions (30d)" description="Mentions met `mentioned=true`" value={stats.mentions30d.toLocaleString('nl-NL')} />
      <Card className="md:col-span-2 xl:col-span-4">
        <CardHeader>
          <CardTitle>Nieuws review status</CardTitle>
          <CardDescription>Openstaande review-items voor {stats.domain}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.pendingNieuws.toLocaleString('nl-NL')} pending items</p>
        </CardContent>
      </Card>
    </div>
  )
}

function InfoCard({ title, description, value }: { title: string; description: string; value: string }) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      </CardContent>
    </Card>
  )
}
