import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getGolfOverview } from '@/lib/dashboard/getGolfOverview'

const STAGES = ['idea', 'script', 'shotlist', 'render', 'edit', 'scheduled', 'posted'] as const

export default async function GolfDashboardPage() {
  const overview = await getGolfOverview()

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Golf Mission Control</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Emily (Rules & Etiquette) + Laura (Mental Game): trends, series, productie en performance op één plek.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric title="Trends" value={overview.trendCount} hint="Daily scout" />
        <Metric title="Backlog" value={overview.backlogCount} hint="Ready to script" />
        <Metric title="In productie" value={overview.inProductionCount} hint="Script → edit" />
        <Metric title="Posted" value={overview.postedCount} hint="Live op IG" />
        <Metric title="Actieve series" value={overview.activeSeries} hint="Weekly planner" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline (visueel)</CardTitle>
            <CardDescription>Houd productie simpel: batchen, vaste templates, lage kosten.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-7">
              {STAGES.map((stage) => (
                <div key={stage} className="rounded-md border border-gray-200 p-2 text-center text-xs dark:border-gray-800">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{stage}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cron Jobs</CardTitle>
            <CardDescription>Automatiseer research en series planning</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Daily Trend Scout" value="08:15" />
            <Row label="Weekly Series Planner" value="ma 08:30" />
            <Row label="Render Budget Guard" value="dagelijks" />
            <Badge variant="outline">Koppel via OpenClaw cron</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Emily account (regels/etiquette)</CardTitle>
            <CardDescription>Leuke, herkenbare situaties + duidelijke uitleg.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Format: Hook → Regel → Situatie → CTA</p>
            <p>Doel: engagement + fan groei.</p>
            <p>Monetisatie later: affiliates / memberships.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Laura account (mental game)</CardTitle>
            <CardDescription>Serie-format met diepgang en terugkerende rubrieken.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Format: Trigger → Mindset principe → Oefening → CTA</p>
            <p>Doel: authority + coaching propositie.</p>
            <p>Monetisatie later: cursus / coaching funnel.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function Metric({ title, value, hint }: { title: string; value: number; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wide">{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-gray-200 px-2 py-1 dark:border-gray-800">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
