import { KavelAlertStatusActions } from '@/components/dashboard/KavelAlertStatusActions'
import { KavelAlertSubscriberForm } from '@/components/dashboard/KavelAlertSubscriberForm'
import { KavelListingActions } from '@/components/dashboard/KavelListingActions'
import { KavelManualAddForm } from '@/components/dashboard/KavelManualAddForm'
import { KavelSyncActions } from '@/components/dashboard/KavelSyncActions'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listKavelAlertSubscribers, listKavelListings, listKavelSyncJobs } from '@/lib/kavels'
import type { ListingSourceType, ListingStatus } from '@/lib/kavels/types'
import Link from 'next/link'

const LISTING_STATUSES: Array<ListingStatus | 'all'> = ['all', 'pending', 'approved', 'published', 'skipped', 'error']
const LISTING_SOURCES: Array<ListingSourceType | 'all'> = ['all', 'gmail_funda', 'openclaw', 'manual']

interface DashboardKavelsPageProps {
  searchParams: Promise<{ status?: string; source?: string; q?: string }>
}

export default async function DashboardKavelsPage({ searchParams }: DashboardKavelsPageProps) {
  const params = await searchParams
  const statusFilter = LISTING_STATUSES.includes((params.status ?? 'all') as ListingStatus | 'all') ? (params.status as ListingStatus | 'all') : 'all'
  const sourceFilter = LISTING_SOURCES.includes((params.source ?? 'all') as ListingSourceType | 'all')
    ? (params.source as ListingSourceType | 'all')
    : 'all'
  const queryFilter = (params.q ?? '').trim()

  const [listings, syncJobs, subscribers] = await Promise.all([
    listKavelListings({ status: statusFilter, source: sourceFilter, q: queryFilter, limit: 250 }),
    listKavelSyncJobs(20),
    listKavelAlertSubscribers(300)
  ])

  const pendingCount = listings.filter((item) => item.ingestStatus === 'pending').length
  const approvedCount = listings.filter((item) => item.ingestStatus === 'approved').length
  const publishedCount = listings.filter((item) => item.ingestStatus === 'published').length
  const activeSubscribers = subscribers.filter((item) => item.status === 'actief').length

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Kavels Center</h1>
        <p className="text-sm text-gray-500">
          Centrale pipeline voor Gmail/Funda en OpenClaw ingest, publicatie in Supabase en automatische distributie naar de Next.js sites.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Pending: {pendingCount}</Badge>
        <Badge variant="outline">Approved: {approvedCount}</Badge>
        <Badge variant="outline">Published: {publishedCount}</Badge>
        <Badge variant="outline">KavelAlert actief: {activeSubscribers}</Badge>
      </div>

      <KavelSyncActions />
      <KavelManualAddForm />

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900">Listings</p>
          <p className="text-xs text-gray-500">Publiceren zet de kavel in de `kavels` tabel met site-specifieke copy voor `zwijsen.net` en `kavelarchitect.nl`.</p>
        </div>

        <form className="grid gap-3 md:grid-cols-4">
          <label className="text-xs font-medium text-gray-600">
            Status
            <select name="status" defaultValue={statusFilter} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm">
              {LISTING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">
            Bron
            <select name="source" defaultValue={sourceFilter} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm">
              {LISTING_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600 md:col-span-2">
            Zoek
            <div className="mt-1 flex gap-2">
              <input
                name="q"
                defaultValue={queryFilter}
                placeholder="adres, plaats, url..."
                className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
              />
              <button type="submit" className="inline-flex h-9 items-center rounded-md border border-gray-300 px-3 text-sm">
                Filter
              </button>
            </div>
          </label>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kavel</TableHead>
              <TableHead>Locatie</TableHead>
              <TableHead>Bron</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aangemaakt</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-gray-500">
                  Geen kavels gevonden met deze filters.
                </TableCell>
              </TableRow>
            ) : (
              listings.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <Link href={`/dashboard/kavels/${listing.id}`} className="text-sm font-medium text-orange-700 hover:text-orange-800">
                        {listing.adres ?? listing.kavelId}
                      </Link>
                      <p className="text-xs text-gray-500">{listing.kavelId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-gray-800">{[listing.postcode, listing.plaats].filter(Boolean).join(' ') || '-'}</p>
                    <p className="text-xs text-gray-500">
                      {listing.prijs ? `EUR ${new Intl.NumberFormat('nl-NL').format(listing.prijs)}` : 'Prijs onbekend'}
                      {' - '}
                      {listing.oppervlakte ? `${new Intl.NumberFormat('nl-NL').format(listing.oppervlakte)} m2` : 'Oppervlakte onbekend'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{listing.sourceType}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={listingStatusVariant(listing.ingestStatus)}>{listing.ingestStatus}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-gray-500">{new Date(listing.createdAt).toLocaleDateString('nl-NL')}</TableCell>
                  <TableCell className="text-right">
                    <KavelListingActions id={listing.id} status={listing.ingestStatus} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900">Sync jobs</p>
          <p className="text-xs text-gray-500">Queue-overzicht voor Gmail/Funda en OpenClaw sync.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bron</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Opmerking</TableHead>
              <TableHead className="text-right">Aangemaakt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {syncJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                  Nog geen sync jobs.
                </TableCell>
              </TableRow>
            ) : (
              syncJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{job.sourceType}</TableCell>
                  <TableCell>
                    <Badge variant={syncStatusVariant(job.status)}>{job.status}</Badge>
                  </TableCell>
                  <TableCell>{job.triggerType}</TableCell>
                  <TableCell className="max-w-[300px] truncate">{job.note ?? '-'}</TableCell>
                  <TableCell className="text-right text-xs text-gray-500">{new Date(job.createdAt).toLocaleString('nl-NL')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <KavelAlertSubscriberForm />

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900">KavelAlert inschrijvingen</p>
          <p className="text-xs text-gray-500">Beheer van ingeschreven leads voor alerts en (optioneel) early access kavelrapport.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Voorkeuren</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscribers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-gray-500">
                  Nog geen inschrijvingen.
                </TableCell>
              </TableRow>
            ) : (
              subscribers.map((subscriber) => (
                <TableRow key={subscriber.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900">{subscriber.naam ?? subscriber.email}</p>
                      <p className="text-xs text-gray-500">{subscriber.email}</p>
                      {subscriber.telefoonnummer ? <p className="text-xs text-gray-500">{subscriber.telefoonnummer}</p> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-gray-700">
                      Provincies: {subscriber.provincies.length > 0 ? subscriber.provincies.join(', ') : 'geen'}
                    </p>
                    <p className="text-xs text-gray-700">
                      Budget: {subscriber.minPrijs ? new Intl.NumberFormat('nl-NL').format(subscriber.minPrijs) : '-'} tot{' '}
                      {subscriber.maxPrijs ? new Intl.NumberFormat('nl-NL').format(subscriber.maxPrijs) : '-'}
                    </p>
                    <p className="text-xs text-gray-700">
                      Min m2: {subscriber.minOppervlakte ?? '-'} | Early access: {subscriber.earlyAccessRapport ? 'ja' : 'nee'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={subscriberStatusVariant(subscriber.status)}>{subscriber.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <KavelAlertStatusActions id={subscriber.id} status={subscriber.status} />
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

function listingStatusVariant(status: ListingStatus) {
  if (status === 'published') return 'secondary' as const
  if (status === 'approved') return 'outline' as const
  if (status === 'error') return 'destructive' as const
  if (status === 'skipped') return 'outline' as const
  return 'default' as const
}

function syncStatusVariant(status: 'queued' | 'running' | 'success' | 'error') {
  if (status === 'success') return 'secondary' as const
  if (status === 'error') return 'destructive' as const
  if (status === 'running') return 'outline' as const
  return 'default' as const
}

function subscriberStatusVariant(status: 'actief' | 'pauze' | 'uitgeschreven') {
  if (status === 'actief') return 'secondary' as const
  if (status === 'pauze') return 'outline' as const
  return 'destructive' as const
}
