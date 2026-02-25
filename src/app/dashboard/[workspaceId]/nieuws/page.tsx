import { NewsDeleteButton } from '@/components/dashboard/NewsDeleteButton'
import { NewsQuickCreateForm } from '@/components/dashboard/NewsQuickCreateForm'
import { NewsStatusBadge } from '@/components/dashboard/NewsStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listNewsItems } from '@/lib/news'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function relevanceScore(item: { site: string; title: string; summary: string | null; body: string | null; sourceType: string }) {
  const text = [item.title, item.summary ?? '', item.body ?? '', item.sourceType].join(' ').toLowerCase()

  const domainTerms: Record<string, string[]> = {
    'kavelarchitect.nl': ['kavel', 'kaveluitgifte', 'bouwkavel', 'gebiedsontwikkeling', 'bestemmingsplan', 'omgevingsplan'],
    'brikxai.nl': ['omgevingswet', 'wkb', 'vergunning', 'bouwbesluit', 'bouwkosten', 'verduurzaming', 'renovatie'],
    'zwijsen.net': ['architect', 'architectuur', 'villa', 'ontwerp', 'interieur', 'ai', 'bim', 'generative', 'computational']
  }

  const genericPositive = ['woning', 'nieuwbouw', 'verbouw', 'bouwsector', 'construction']
  const negativeTerms = ['sport', 'entertainment', 'wedstrijd', 'voetbal', 'celebrity']

  const targetTerms = domainTerms[item.site] ?? []
  const targetHits = targetTerms.filter((t) => text.includes(t)).length
  const genericHits = genericPositive.filter((t) => text.includes(t)).length
  const negativeHits = negativeTerms.filter((t) => text.includes(t)).length

  const base = 0.52
  const raw = base + targetHits * 0.09 + genericHits * 0.04 - negativeHits * 0.12
  return Math.max(0.05, Math.min(0.99, raw))
}

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
              <TableHead>Relevantie</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aangemaakt</TableHead>
              <TableHead className="text-right">Actie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-gray-500 dark:text-gray-400">
                  Nog geen nieuwsitems in deze workspace.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const score = relevanceScore(item)
                return (
                <TableRow key={`${item.origin}-${item.id}`}>
                  <TableCell className="max-w-[420px]">
                    <p className="truncate font-medium">{item.title}</p>
                    {item.summary ? <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{item.summary}</p> : null}
                  </TableCell>
                  <TableCell>{item.sourceType}</TableCell>
                  <TableCell>
                    <div className="font-mono text-xs">{score.toFixed(2)} ({Math.round(score * 100)}%)</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">{score >= 0.75 ? 'sterke match' : score >= 0.6 ? 'twijfelgeval' : 'lage match'}</div>
                  </TableCell>
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
              )})
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
