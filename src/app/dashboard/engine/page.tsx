import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function EnginePage() {
  const supabase = await createClient()

  const [{ data: kws }, { data: comps }] = await Promise.all([
    supabase.from('keyword_topics').select('id,status,workspace_id').order('created_at', { ascending: false }).limit(200),
    supabase.from('competitor_watchlist').select('id,workspace_id,active')
  ])

  const totalKeywords = (kws ?? []).length
  const queued = (kws ?? []).filter((k) => k.status === 'queued' || k.status === 'new').length
  const inProgress = (kws ?? []).filter((k) => k.status === 'in_progress').length
  const activeCompetitors = (comps ?? []).filter((c) => c.active).length

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">AI-SEO Engine</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Roadmap van Arvow build-document vertaald naar modules: keyword feed, knowledge base, lifecycle, technical agents, LLM visibility.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Keyword topics" value={String(totalKeywords)} />
        <Metric title="Queue" value={String(queued)} />
        <Metric title="In progress" value={String(inProgress)} />
        <Metric title="Active competitors" value={String(activeCompetitors)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Keyword Feed Engine v1</CardTitle>
          <CardDescription>Start met seed/trend topics per site; later koppelen met last30days + competitor crawler.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Run endpoint: <code>/api/engine/keyword-sync</code></p>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Fase 1</Badge>
            <Badge variant="secondary">partial</Badge>
          </div>
          <form action="/api/engine/keyword-sync" method="post">
            <Button type="submit" size="sm">Run Keyword Sync</Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wide">{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      </CardContent>
    </Card>
  )
}
