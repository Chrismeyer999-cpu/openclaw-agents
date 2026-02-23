import { NewsReviewActions } from '@/components/dashboard/NewsReviewActions'
import { NewsStatusBadge } from '@/components/dashboard/NewsStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getNewsItemById, normalizeSourceMode } from '@/lib/news'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface DashboardNieuwsDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ src?: string }>
}

export default async function DashboardNieuwsDetailPage({ params, searchParams }: DashboardNieuwsDetailPageProps) {
  const { id } = await params
  const sourceMode = normalizeSourceMode((await searchParams).src ?? null)
  const item = await getNewsItemById(id, sourceMode)
  if (!item) notFound()

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <Link href="/dashboard/nieuws" className="text-sm font-medium text-orange-600 hover:text-orange-700">
        Terug naar Nieuws Center
      </Link>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">{item.title}</CardTitle>
          <CardDescription className="flex flex-wrap gap-2">
            <Badge variant="outline">{item.site}</Badge>
            <Badge variant="outline">{item.sourceType}</Badge>
            <Badge variant="outline">{item.origin}</Badge>
            <NewsStatusBadge status={item.reviewStatus} />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {item.summary ? <p className="text-sm leading-6 text-gray-700">{item.summary}</p> : null}
          {item.body ? <article className="whitespace-pre-wrap text-sm leading-6 text-gray-800">{item.body}</article> : null}
          {item.sourceUrl ? (
            <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-orange-600 hover:text-orange-700">
              Open bron
            </a>
          ) : null}
          <p className="text-xs text-gray-500">Aangemaakt: {new Date(item.createdAt).toLocaleString('nl-NL')}</p>
          <NewsReviewActions id={item.id} currentStatus={item.reviewStatus} source={item.origin} />
        </CardContent>
      </Card>
    </section>
  )
}
