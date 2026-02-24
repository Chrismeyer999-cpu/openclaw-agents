import { NewsDeleteButton } from '@/components/dashboard/NewsDeleteButton'
import { NewsQuickCreateForm } from '@/components/dashboard/NewsQuickCreateForm'
import { NewsStatusBadge } from '@/components/dashboard/NewsStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getWorkspaceDomains, listNewsItems, pendingCountByDomain } from '@/lib/news'
import { NEWS_SITES } from '@/lib/news/siteUtils'
import Link from 'next/link'

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'published'
const REVIEW_STATUSES: ReviewStatus[] = ['pending', 'approved', 'rejected', 'published']

interface DashboardNieuwsPageProps {
  searchParams: Promise<{ workspace?: string; status?: string; source?: string; q?: string }>
}

export default async function DashboardNieuwsPage({ searchParams }: DashboardNieuwsPageProps) {
  const params = await searchParams
  const workspaceFilter = params.workspace ?? 'all'
  const statusFilter = params.status ?? 'all'
  const sourceFilter = params.source ?? 'all'
  const queryFilter = (params.q ?? '').trim()

  const workspaceRows = await getWorkspaceDomains()
  const workspaceDomains = workspaceRows.map((workspace) => workspace.domain)
  const createDomainOptions = Array.from(new Set(workspaceDomains)).sort()
  const domainOptions = Array.from(new Set([...workspaceDomains, ...NEWS_SITES])).sort()

  const { mode, items } = await listNewsItems({
    workspaceDomain: workspaceFilter,
    status: statusFilter,
    source: sourceFilter,
    q: queryFilter,
    limit: 200
  })

  const pendingByDomain = pendingCountByDomain(items)
  const sourceOptions = Array.from(new Set(items.map((item) => item.sourceType))).sort()

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Nieuws Center</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Gecombineerd nieuwsoverzicht voor kavelarchitect.nl, zwijsen.net en brikxai.nl.</p>
        <Badge variant="outline">Databron: {mode === 'agent' ? 'Agent Supabase' : 'SEO Supabase'}</Badge>
      </header>

      <div className="flex flex-wrap gap-2">
        {domainOptions.map((domain) => (
          <Badge key={domain} variant="outline">
            {domain}: {pendingByDomain.get(domain) ?? 0} pending
          </Badge>
        ))}
      </div>

      <NewsQuickCreateForm
        domainOptions={createDomainOptions}
        initialDomain={workspaceFilter !== 'all' ? workspaceFilter : createDomainOptions[0]}
      />

      <form className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:grid-cols-5">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Site
          <select name="workspace" defaultValue={workspaceFilter} className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
            <option value="all">Alle sites</option>
            {domainOptions.map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Status
          <select name="status" defaultValue={statusFilter} className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
            <option value="all">Alle statussen</option>
            {REVIEW_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Bron
          <select name="source" defaultValue={sourceFilter} className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
            <option value="all">Alle bronnen</option>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300 md:col-span-2">
          Zoek titel
          <div className="mt-1 flex gap-2">
            <Input name="q" defaultValue={queryFilter} placeholder="Zoek in titel..." />
            <Button type="submit" variant="outline">
              Filter
            </Button>
          </div>
        </label>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site</TableHead>
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
                <TableCell colSpan={6} className="text-center text-sm text-gray-500 dark:text-gray-400">
                  Geen nieuwsitems gevonden met deze filters.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={`${item.origin}-${item.id}`}>
                  <TableCell>{item.site}</TableCell>
                  <TableCell className="max-w-[340px] truncate font-medium">{item.title}</TableCell>
                  <TableCell>{item.sourceType}</TableCell>
                  <TableCell>
                    <NewsStatusBadge status={item.reviewStatus} />
                  </TableCell>
                  <TableCell className="text-right text-xs text-gray-500 dark:text-gray-400">{new Date(item.createdAt).toLocaleDateString('nl-NL')}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link href={`/dashboard/nieuws/${item.id}?src=${item.origin}`} className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-200">
                        Bekijk
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
    </section>
  )
}
