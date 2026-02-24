'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'published'

interface NewsReviewActionsProps {
  id: string
  currentStatus: ReviewStatus
  source: 'seo' | 'agent'
  site: string
  initialBody: string | null
  initialFeaturedImageUrl: string | null
  initialFeaturedImageAlt: string | null
}

const STATUSES: { value: ReviewStatus; label: string; variant: 'outline' | 'destructive' | 'secondary' }[] = [
  { value: 'approved', label: 'Gereed voor publicatie', variant: 'secondary' },
  { value: 'rejected', label: 'Afkeuren', variant: 'destructive' },
  { value: 'pending', label: 'Terug naar pending', variant: 'outline' }
]

type PatchResponse = {
  error?: string
  body?: string
  review_status?: ReviewStatus
  published_url?: string
  featured_image_url?: string | null
  featured_image_alt?: string | null
  generation_mode?: 'ai' | 'template'
}

type ImageUploadResponse = {
  error?: string
  url?: string
  alt?: string
}

export function NewsReviewActions({
  id,
  currentStatus,
  source,
  site,
  initialBody,
  initialFeaturedImageUrl,
  initialFeaturedImageAlt
}: NewsReviewActionsProps) {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [status, setStatus] = useState<ReviewStatus>(currentStatus)
  const [articleBody, setArticleBody] = useState(initialBody ?? '')
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialFeaturedImageUrl ?? '')
  const [featuredImageAlt, setFeaturedImageAlt] = useState(initialFeaturedImageAlt ?? '')
  const [brief, setBrief] = useState('')
  const [imageNote, setImageNote] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const hasArticle = articleBody.trim().length > 0
  const normalizedSite = site
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
  const canPublishOnKnownSite = ['zwijsen.net', 'brikxai.nl', 'kavelarchitect.nl'].includes(normalizedSite)
  const canGenerateFromBrief = brief.trim().length >= 10
  const previewUrl = featuredImageUrl.trim()
  const publishButtonLabel = status === 'published' ? 'Al gepubliceerd' : `Publiceer op ${site}`
  const previewAlt = useMemo(() => {
    const value = featuredImageAlt.trim()
    if (value) return value
    return 'Nieuwsafbeelding preview'
  }, [featuredImageAlt])

  const runPatchAction = (payload: Record<string, unknown>, successMessage: string, onSuccess?: (response: PatchResponse) => void) => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/nieuws', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, source, ...payload })
        })
        const responsePayload = (await response.json().catch(() => ({}))) as PatchResponse

        if (!response.ok) {
          throw new Error(responsePayload.error ?? 'Kon nieuwsitem niet bijwerken')
        }

        setMessage(successMessage)
        if (responsePayload.body) setArticleBody(responsePayload.body)
        if (responsePayload.featured_image_url !== undefined) setFeaturedImageUrl(responsePayload.featured_image_url ?? '')
        if (responsePayload.featured_image_alt !== undefined) setFeaturedImageAlt(responsePayload.featured_image_alt ?? '')
        if (responsePayload.review_status) setStatus(responsePayload.review_status)
        onSuccess?.(responsePayload)
        router.refresh()
      } catch (requestError) {
        const nextMessage = requestError instanceof Error ? requestError.message : 'Onbekende fout'
        setError(nextMessage)
      }
    })
  }

  const writeArticle = () => {
    runPatchAction({ action: 'write' }, 'Artikeltekst is gegenereerd.')
  }

  const writeFromBrief = () => {
    runPatchAction(
      {
        action: 'write_from_brief',
        brief,
        image_note: imageNote || null,
        featured_image_url: featuredImageUrl,
        featured_image_alt: featuredImageAlt
      },
      'Artikel op basis van je briefing is geschreven.',
      (response) => {
        if (response.generation_mode === 'template') {
          setMessage('Artikel geschreven met template-fallback (geen OpenAI key of AI-call mislukt).')
        }
      }
    )
  }

  const saveArticle = () => {
    runPatchAction(
      {
        action: 'save_body',
        article_body: articleBody,
        featured_image_url: featuredImageUrl,
        featured_image_alt: featuredImageAlt
      },
      'Artikeltekst en afbeelding zijn opgeslagen.'
    )
  }

  const publishArticle = () => {
    runPatchAction(
      {
        action: 'publish',
        article_body: articleBody,
        featured_image_url: featuredImageUrl,
        featured_image_alt: featuredImageAlt
      },
      'Artikel is gepubliceerd.',
      (response) => {
        setStatus('published')
        if (response.published_url) {
          setMessage(`Artikel gepubliceerd op ${response.published_url}`)
        }
      }
    )
  }

  const updateStatus = (reviewStatus: ReviewStatus) => {
    runPatchAction({ action: 'set_status', review_status: reviewStatus }, 'Status bijgewerkt.', () => {
      setStatus(reviewStatus)
    })
  }

  const uploadImage = async () => {
    if (!selectedFile) {
      setError('Kies eerst een afbeelding om te uploaden.')
      return
    }

    setError(null)
    setMessage(null)
    setIsUploadingImage(true)
    try {
      const formData = new FormData()
      formData.set('file', selectedFile)
      formData.set('site', site)

      const response = await fetch('/api/nieuws/image', { method: 'POST', body: formData })
      const payload = (await response.json().catch(() => ({}))) as ImageUploadResponse
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? 'Uploaden van afbeelding mislukt')
      }

      setFeaturedImageUrl(payload.url)
      if (!featuredImageAlt.trim()) setFeaturedImageAlt(payload.alt ?? '')
      setSelectedFile(null)
      setMessage('Afbeelding geupload en geselecteerd.')
    } catch (uploadError) {
      const nextMessage = uploadError instanceof Error ? uploadError.message : 'Onbekende uploadfout'
      setError(nextMessage)
    } finally {
      setIsUploadingImage(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border border-gray-200 p-3 dark:border-gray-800 dark:bg-gray-900/50">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Jouw input voor artikel</p>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
          Korte briefing (2-5 zinnen)
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            placeholder="Beschrijf wat je in het artikel wilt benadrukken..."
            className="mt-1 min-h-[90px] w-full rounded-md border border-gray-300 bg-white p-2 text-sm leading-6 text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </label>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
          Context van de afbeelding (optioneel)
          <input
            value={imageNote}
            onChange={(event) => setImageNote(event.target.value)}
            placeholder="Wat laat de afbeelding zien?"
            className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </label>
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
            Upload afbeelding
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white dark:file:border-gray-700 dark:file:bg-gray-900 file:px-3 file:py-1 file:text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={uploadImage} disabled={isUploadingImage || isPending || !selectedFile}>
              {isUploadingImage ? 'Uploaden...' : 'Afbeelding uploaden'}
            </Button>
            <Button size="sm" onClick={writeFromBrief} disabled={isPending || !canGenerateFromBrief}>
              Schrijf artikel op basis van briefing
            </Button>
            <Button size="sm" variant="outline" onClick={writeArticle} disabled={isPending}>
              Schrijf standaard artikel
            </Button>
          </div>
          {!canGenerateFromBrief ? <p className="text-xs text-gray-500 dark:text-gray-400">Vul minimaal 10 tekens briefing in om te genereren.</p> : null}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Artikeltekst</p>
        {!hasArticle ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">Nog geen artikeltekst. Gebruik hierboven de briefing-knop of standaard schrijf-knop.</p>
        ) : (
          <>
            <textarea
              value={articleBody}
              onChange={(event) => setArticleBody(event.target.value)}
              className="min-h-[260px] w-full rounded-md border border-gray-300 bg-white p-3 text-sm leading-6 text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
            <div className="space-y-2 rounded-md border border-gray-200 p-3 dark:border-gray-800 dark:bg-gray-900/50">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Afbeelding</p>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                Afbeelding URL
                <input
                  value={featuredImageUrl}
                  onChange={(event) => setFeaturedImageUrl(event.target.value)}
                  placeholder="https://... of /images/actueel/..."
                  className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                Alt tekst
                <input
                  value={featuredImageAlt}
                  onChange={(event) => setFeaturedImageAlt(event.target.value)}
                  placeholder="Beschrijving van de afbeelding"
                  className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </label>
              {previewUrl ? (
                <div className="overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt={previewAlt} className="h-44 w-full object-cover" />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">Nog geen afbeelding ingesteld. Bij publiceren wordt de standaard nieuwsafbeelding gebruikt.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={saveArticle} disabled={isPending}>
                Tekst + afbeelding opslaan
              </Button>
              <Button size="sm" variant="outline" onClick={publishArticle} disabled={isPending || !canPublishOnKnownSite || status === 'published'}>
                {publishButtonLabel}
              </Button>
            </div>
          </>
        )}
        {!canPublishOnKnownSite ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">Publiceren voor deze site is nog niet gekoppeld.</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Reviewstatus</p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((review) => (
            <Button key={review.value} size="sm" variant={review.variant} onClick={() => updateStatus(review.value)} disabled={isPending || status === review.value}>
              {review.label}
            </Button>
          ))}
        </div>
      </div>

      {isPending ? <p className="text-xs text-gray-500 dark:text-gray-400">Actie wordt uitgevoerd...</p> : null}
      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

