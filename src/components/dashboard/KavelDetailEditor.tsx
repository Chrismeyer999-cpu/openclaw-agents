'use client'

import { Button } from '@/components/ui/button'
import type { KavelListing, ListingStatus } from '@/lib/kavels/types'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

interface KavelDetailEditorProps {
  listing: KavelListing
}

type ApiError = { error?: string }
type PublishResponse = { publishedUrls?: string[]; error?: string }

export function KavelDetailEditor({ listing }: KavelDetailEditorProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [adres, setAdres] = useState(listing.adres ?? '')
  const [postcode, setPostcode] = useState(listing.postcode ?? '')
  const [plaats, setPlaats] = useState(listing.plaats ?? '')
  const [provincie, setProvincie] = useState(listing.provincie ?? '')
  const [prijs, setPrijs] = useState(listing.prijs?.toString() ?? '')
  const [oppervlakte, setOppervlakte] = useState(listing.oppervlakte?.toString() ?? '')
  const [sourceUrl, setSourceUrl] = useState(listing.sourceUrl ?? '')
  const [imageUrl, setImageUrl] = useState(listing.imageUrl ?? '')
  const [mapUrl, setMapUrl] = useState(listing.mapUrl ?? '')
  const [seoSummaryKa, setSeoSummaryKa] = useState(listing.seoSummaryKa ?? '')
  const [seoArticleHtmlKa, setSeoArticleHtmlKa] = useState(listing.seoArticleHtmlKa ?? '')
  const [seoSummaryZw, setSeoSummaryZw] = useState(listing.seoSummaryZw ?? '')
  const [seoArticleHtmlZw, setSeoArticleHtmlZw] = useState(listing.seoArticleHtmlZw ?? '')
  const [publishedSites, setPublishedSites] = useState((listing.publishedSites ?? []).join(', '))
  const [specsText, setSpecsText] = useState(() => JSON.stringify(listing.specs ?? {}, null, 2))
  const router = useRouter()

  const imagePreview = useMemo(() => imageUrl.trim(), [imageUrl])
  const mapPreview = useMemo(() => mapUrl.trim(), [mapUrl])

  const applyListing = (next: KavelListing) => {
    setAdres(next.adres ?? '')
    setPostcode(next.postcode ?? '')
    setPlaats(next.plaats ?? '')
    setProvincie(next.provincie ?? '')
    setPrijs(next.prijs?.toString() ?? '')
    setOppervlakte(next.oppervlakte?.toString() ?? '')
    setSourceUrl(next.sourceUrl ?? '')
    setImageUrl(next.imageUrl ?? '')
    setMapUrl(next.mapUrl ?? '')
    setSeoSummaryKa(next.seoSummaryKa ?? '')
    setSeoArticleHtmlKa(next.seoArticleHtmlKa ?? '')
    setSeoSummaryZw(next.seoSummaryZw ?? '')
    setSeoArticleHtmlZw(next.seoArticleHtmlZw ?? '')
    setPublishedSites((next.publishedSites ?? []).join(', '))
    setSpecsText(JSON.stringify(next.specs ?? {}, null, 2))
  }

  const save = () => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        let parsedSpecs: Record<string, unknown> = {}
        try {
          parsedSpecs = specsText.trim() ? (JSON.parse(specsText) as Record<string, unknown>) : {}
        } catch {
          throw new Error('Specs JSON is ongeldig.')
        }

        const response = await fetch(`/api/kavels/${listing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adres,
            postcode,
            plaats,
            provincie,
            prijs: prijs || null,
            oppervlakte: oppervlakte || null,
            source_url: sourceUrl || null,
            image_url: imageUrl || null,
            map_url: mapUrl || null,
            seo_summary_ka: seoSummaryKa || null,
            seo_article_html_ka: seoArticleHtmlKa || null,
            seo_summary_zw: seoSummaryZw || null,
            seo_article_html_zw: seoArticleHtmlZw || null,
            published_sites: publishedSites
              .split(',')
              .map((value) => value.trim())
              .filter((value) => value.length > 0),
            specs: parsedSpecs
          })
        })

        const payload = (await response.json().catch(() => ({}))) as KavelListing & ApiError
        if (!response.ok) throw new Error(payload.error ?? 'Opslaan mislukt')

        applyListing(payload)
        setMessage('Kavelgegevens opgeslagen.')
        router.refresh()
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Onbekende fout')
      }
    })
  }

  const runAction = (action: 'regenerate' | 'publish' | 'set_status', status?: ListingStatus) => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch(`/api/kavels/${listing.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...(status ? { status } : {}) })
        })
        const payload = (await response.json().catch(() => ({}))) as (KavelListing & PublishResponse) | ApiError
        if (!response.ok) throw new Error(payload.error ?? 'Actie mislukt')

        if (action === 'publish' && Array.isArray((payload as PublishResponse).publishedUrls)) {
          const urls = (payload as PublishResponse).publishedUrls ?? []
          setMessage(urls.length > 0 ? `Gepubliceerd op ${urls.join(' en ')}` : 'Kavel gepubliceerd.')
        } else {
          const nextListing = payload as KavelListing
          applyListing(nextListing)
          setMessage(action === 'regenerate' ? 'SEO-teksten opnieuw gegenereerd.' : 'Status bijgewerkt.')
        }
        router.refresh()
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Onbekende fout')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">
          Adres
          <input value={adres} onChange={(event) => setAdres(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Postcode
          <input value={postcode} onChange={(event) => setPostcode(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Plaats
          <input value={plaats} onChange={(event) => setPlaats(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Provincie
          <input value={provincie} onChange={(event) => setProvincie(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Vraagprijs (EUR)
          <input value={prijs} onChange={(event) => setPrijs(event.target.value)} inputMode="decimal" className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Oppervlakte (m2)
          <input
            value={oppervlakte}
            onChange={(event) => setOppervlakte(event.target.value)}
            inputMode="decimal"
            className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">
          Bron URL
          <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Published sites (comma separated)
          <input
            value={publishedSites}
            onChange={(event) => setPublishedSites(event.target.value)}
            placeholder="zwijsen.net, kavelarchitect.nl"
            className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Image URL
          <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Map URL
          <input value={mapUrl} onChange={(event) => setMapUrl(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PreviewCard title="Afbeelding" url={imagePreview} />
        <PreviewCard title="Kaart" url={mapPreview} />
      </div>

      <label className="block text-xs font-medium text-gray-600">
        Specs JSON
        <textarea value={specsText} onChange={(event) => setSpecsText(event.target.value)} className="mt-1 min-h-[160px] w-full rounded-md border border-gray-300 p-2 text-xs font-mono" />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">
          SEO summary KavelArchitect
          <textarea value={seoSummaryKa} onChange={(event) => setSeoSummaryKa(event.target.value)} className="mt-1 min-h-[90px] w-full rounded-md border border-gray-300 p-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          SEO summary Zwijsen
          <textarea value={seoSummaryZw} onChange={(event) => setSeoSummaryZw(event.target.value)} className="mt-1 min-h-[90px] w-full rounded-md border border-gray-300 p-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          SEO article KavelArchitect (HTML)
          <textarea value={seoArticleHtmlKa} onChange={(event) => setSeoArticleHtmlKa(event.target.value)} className="mt-1 min-h-[220px] w-full rounded-md border border-gray-300 p-2 text-xs font-mono" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          SEO article Zwijsen (HTML)
          <textarea value={seoArticleHtmlZw} onChange={(event) => setSeoArticleHtmlZw(event.target.value)} className="mt-1 min-h-[220px] w-full rounded-md border border-gray-300 p-2 text-xs font-mono" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={isPending}>
          Opslaan
        </Button>
        <Button variant="outline" onClick={() => runAction('regenerate')} disabled={isPending}>
          Regenerate teksten
        </Button>
        <Button variant="outline" onClick={() => runAction('set_status', 'approved')} disabled={isPending}>
          Approve
        </Button>
        <Button onClick={() => runAction('publish')} disabled={isPending}>
          Publiceer
        </Button>
        <Button variant="destructive" onClick={() => runAction('set_status', 'skipped')} disabled={isPending}>
          Skip
        </Button>
      </div>

      {isPending ? <p className="text-xs text-gray-500">Bezig...</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

function PreviewCard({ title, url }: { title: string; url: string }) {
  const showImage = isLikelyImage(url)

  return (
    <div className="space-y-2 rounded-md border border-gray-200 p-3">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {!url ? <p className="text-xs text-gray-500">Geen URL ingesteld.</p> : null}
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-orange-600 hover:text-orange-700">
          Open in nieuw tabblad
        </a>
      ) : null}
      {url && showImage ? (
        <a href={url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={title} className="h-48 w-full rounded-md border border-gray-200 object-cover" />
        </a>
      ) : null}
    </div>
  )
}

function isLikelyImage(url: string) {
  const normalized = url.trim().toLowerCase()
  return normalized.endsWith('.jpg') || normalized.endsWith('.jpeg') || normalized.endsWith('.png') || normalized.endsWith('.webp') || normalized.endsWith('.gif')
}

