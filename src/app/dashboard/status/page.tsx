import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getDeliveryStatus, type DeliveryStatusItem } from '@/lib/dashboard/getDeliveryStatus'

const SITES: Array<DeliveryStatusItem['site']> = ['platform', 'zwijsen.net', 'brikxai.nl', 'kavelarchitect.nl']

function statusBadge(status: DeliveryStatusItem['status']) {
  if (status === 'working') return <Badge variant="secondary">working</Badge>
  if (status === 'partial') return <Badge variant="outline">partial</Badge>
  if (status === 'planned') return <Badge variant="outline">planned</Badge>
  return <Badge variant="destructive">blocked</Badge>
}

export default async function DashboardStatusPage() {
  const items = await getDeliveryStatus()

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Roadmap & Status</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Centrale plek om per site bij te houden: wat werkt, wat nog niet werkt, en wat de volgende stap is.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SITES.map((site) => {
          const rows = items.filter((i) => i.site === site)
          const working = rows.filter((r) => r.status === 'working').length
          const partial = rows.filter((r) => r.status === 'partial').length
          const blocked = rows.filter((r) => r.status === 'blocked').length

          return (
            <Card key={site}>
              <CardHeader>
                <CardTitle className="text-base">{site}</CardTitle>
                <CardDescription>
                  {working} working · {partial} partial · {blocked} blocked
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-gray-600 dark:text-gray-400">{rows.length} onderwerpen</CardContent>
            </Card>
          )
        })}
      </div>

      <div className="space-y-4">
        {SITES.map((site) => {
          const rows = items.filter((i) => i.site === site)
          return (
            <Card key={site}>
              <CardHeader>
                <CardTitle className="text-lg">{site}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {rows.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nog geen items.</p>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{row.domain_area}</p>
                        {statusBadge(row.status)}
                      </div>
                      {row.works_now ? <p className="text-sm"><strong>Werkt nu:</strong> {row.works_now}</p> : null}
                      {row.not_working_yet ? <p className="text-sm"><strong>Nog niet:</strong> {row.not_working_yet}</p> : null}
                      {row.next_step ? <p className="text-sm"><strong>Volgende stap:</strong> {row.next_step}</p> : null}
                      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Laatste update: {new Date(row.updated_at).toLocaleString('nl-NL')}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
