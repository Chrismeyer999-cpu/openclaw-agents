import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { GoogleWorkspaceTestButton } from '@/components/dashboard/GoogleWorkspaceTestButton'

export default async function GoogleConnectionsPage({
  searchParams
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id,domain,gsc_property,gsc_refresh_token')
    .order('domain')

  const rows = workspaces ?? []

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Google Connections</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Koppel Search Console per site/workspace en beheer de sync readiness.</p>
      </header>

      {params.connected ? <Badge variant="secondary">GSC koppeling opgeslagen.</Badge> : null}
      {params.error ? <Badge variant="destructive">Fout: {params.error}</Badge> : null}

      <div className="grid gap-4">
        {rows.map((w) => {
          const connected = Boolean(w.gsc_property && w.gsc_refresh_token)
          return (
            <Card key={w.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{w.domain}</CardTitle>
                  <CardDescription>GSC property: {w.gsc_property ?? 'niet ingesteld'}</CardDescription>
                </div>
                <Badge variant={connected ? 'secondary' : 'outline'}>{connected ? 'connected' : 'not connected'}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Refresh token {connected ? 'aanwezig' : 'ontbreekt'}</p>
                  <Button asChild size="sm">
                    <Link href={`/api/google/connect?workspaceId=${w.id}`}>{connected ? 'Reconnect GSC' : 'Connect GSC'}</Link>
                  </Button>
                </div>
                {connected ? <GoogleWorkspaceTestButton workspaceId={w.id} /> : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
