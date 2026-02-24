import { KavelDetailEditor } from '@/components/dashboard/KavelDetailEditor'
import { Badge } from '@/components/ui/badge'
import { getKavelListingById } from '@/lib/kavels'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface KavelDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function KavelDetailPage({ params }: KavelDetailPageProps) {
  const { id } = await params
  const listing = await getKavelListingById(id)
  if (!listing) notFound()

  return (
    <section className="mx-auto max-w-6xl space-y-4">
      <Link href="/dashboard/kavels" className="text-sm font-medium text-orange-600 hover:text-orange-700">
        Terug naar Kavels Center
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{listing.adres ?? listing.kavelId}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{listing.kavelId}</Badge>
          <Badge variant="outline">{listing.sourceType}</Badge>
          <Badge variant={listing.ingestStatus === 'published' ? 'secondary' : listing.ingestStatus === 'error' ? 'destructive' : 'outline'}>
            {listing.ingestStatus}
          </Badge>
          <Badge variant="outline">Aangemaakt: {new Date(listing.createdAt).toLocaleString('nl-NL')}</Badge>
        </div>
      </header>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <KavelDetailEditor listing={listing} />
      </div>
    </section>
  )
}

