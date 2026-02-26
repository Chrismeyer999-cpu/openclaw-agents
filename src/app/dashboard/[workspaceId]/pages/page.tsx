import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'

export default async function WorkspacePagesPage({
  params
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceDate = since.toISOString().slice(0, 10)

  const { data: pagesRaw, error: pagesError } = await supabase
    .from('pillar_pages')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('title')

  if (pagesError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
        Kon pagina-data niet laden: {pagesError.message}
      </div>
    )
  }

  const pages = (pagesRaw ?? []).map((p: any) => ({
    id: String(p.id),
    title: String(p.title ?? p.url ?? 'Onbekende pagina'),
    url: String(p.url ?? ''),
    has_schema: Boolean(p.has_schema ?? p.schema_detected ?? false)
  }))

  const pageIds = pages.map((page) => page.id)
  let snapshots: { pillar_page_id: string; clicks: number; snapshot_date: string }[] = []
  if (pageIds.length > 0) {
    const { data, error } = await supabase
      .from('gsc_snapshots')
      .select('pillar_page_id, clicks, snapshot_date')
      .in('pillar_page_id', pageIds)
      .gte('snapshot_date', sinceDate)

    if (!error) {
      snapshots = data ?? []
    }
  }

  const clicksByPage = new Map<string, number>()
  snapshots.forEach((snapshot) => {
    clicksByPage.set(snapshot.pillar_page_id, (clicksByPage.get(snapshot.pillar_page_id) ?? 0) + snapshot.clicks)
  })

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Titel</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Schema</TableHead>
            <TableHead className="text-right">Clicks 30d</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-gray-500 dark:text-gray-400">
                Nog geen pillar pages in deze workspace.
              </TableCell>
            </TableRow>
          ) : (
            pages.map((page) => (
              <TableRow key={page.id}>
                <TableCell className="font-medium">{page.title}</TableCell>
                <TableCell className="max-w-[340px] truncate text-xs text-gray-500 dark:text-gray-400">{page.url}</TableCell>
                <TableCell>
                  <Badge variant={page.has_schema ? 'secondary' : 'outline'}>{page.has_schema ? 'Ja' : 'Nee'}</Badge>
                </TableCell>
                <TableCell className="text-right">{(clicksByPage.get(page.id) ?? 0).toLocaleString('nl-NL')}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
