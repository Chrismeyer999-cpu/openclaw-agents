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

  const { data: pages, error: pagesError } = await supabase
    .from('pillar_pages')
    .select('id, title, url, has_schema')
    .eq('workspace_id', workspaceId)
    .order('title')

  if (pagesError) {
    throw new Error(`Kon pages niet laden: ${pagesError.message}`)
  }

  const pageIds = (pages ?? []).map((page) => page.id)
  let snapshots: { pillar_page_id: string; clicks: number; snapshot_date: string }[] = []
  if (pageIds.length > 0) {
    const { data, error } = await supabase
      .from('gsc_snapshots')
      .select('pillar_page_id, clicks, snapshot_date')
      .in('pillar_page_id', pageIds)
      .gte('snapshot_date', sinceDate)

    if (error) {
      throw new Error(`Kon GSC snapshots niet laden: ${error.message}`)
    }
    snapshots = data ?? []
  }

  const clicksByPage = new Map<string, number>()
  snapshots.forEach((snapshot) => {
    clicksByPage.set(snapshot.pillar_page_id, (clicksByPage.get(snapshot.pillar_page_id) ?? 0) + snapshot.clicks)
  })

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
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
          {(pages ?? []).length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-gray-500">
                Nog geen pillar pages in deze workspace.
              </TableCell>
            </TableRow>
          ) : (
            (pages ?? []).map((page) => (
              <TableRow key={page.id}>
                <TableCell className="font-medium">{page.title}</TableCell>
                <TableCell className="max-w-[340px] truncate text-xs text-gray-500">{page.url}</TableCell>
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
