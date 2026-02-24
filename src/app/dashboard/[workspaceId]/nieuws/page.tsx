import { NewsDeleteButton } from '@/components/dashboard/NewsDeleteButton'
import { NewsQuickCreateForm } from '@/components/dashboard/NewsQuickCreateForm'
import { NewsStatusBadge } from '@/components/dashboard/NewsStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listNewsItems } from '@/lib/news'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function WorkspaceNieuwsPage({
  params
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const supabase = await createClient()
  const { data: workspace, error: workspaceError } = await supabase.from('workspaces').select('domain').eq('id', workspaceId).maybeSingle()
  if (workspaceError || !workspace) {
    throw new Error(`Kon workspace niet laden: ${workspaceError?.message ?? 'onbekend'}`)
  }

  const { mode, items } = await listNewsItems({ workspaceDomain: workspace.domain, limit: 100 })

  return (
    <div className="space-y-3">
      <Badge variant="outline">Databron: {mode === 'agent' ? 'Agent Supabase' : 'SEO Supabase'}</Badge>
      <NewsQuickCreateForm domainOptions={[workspace.domain]} initialDomain={workspace.domain} />
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titel</TableHead>
              <TableHead>Bron</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aangemaakt</TableHead>
              <TableHead className="text-right">Actie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-gray-500 dark:text-gray-400">
                  Nog geen nieuwsitems in deze workspace.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={`${item.origin}-${item.id}`}>
                  <TableCell className="max-w-[320px] truncate font-medium">{item.title}</TableCell>
                  <TableCell>{item.sourceType}</TableCell>
                  <TableCell>
                    <NewsStatusBadge status={item.reviewStatus} />
                  </TableCell>
                  <TableCell className="text-right text-xs text-gray-500 dark:text-gray-400">{new Date(item.createdAt).toLocaleDateString('nl-NL')}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link href={`/dashboard/nieuws/${item.id}?src=${item.origin}`} className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-200">
                        Open
                      </Link>
                      <NewsDeleteButton id={item.id} source={item.origin} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
