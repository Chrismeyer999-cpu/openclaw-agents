'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'published'

interface NewsReviewActionsProps {
  id: string
  currentStatus: ReviewStatus
  source: 'seo' | 'agent'
  site: string
  initialBody: string | null
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
}

export function NewsReviewActions({ id, currentStatus, source, site, initialBody }: NewsReviewActionsProps) {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [status, setStatus] = useState<ReviewStatus>(currentStatus)
  const [articleBody, setArticleBody] = useState(initialBody ?? '')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const hasArticle = articleBody.trim().length > 0
  const canPublishOnZwijsen = site === 'zwijsen.net'

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

  const saveArticle = () => {
    runPatchAction({ action: 'save_body', article_body: articleBody }, 'Artikeltekst is opgeslagen.')
  }

  const publishArticle = () => {
    runPatchAction({ action: 'publish', article_body: articleBody }, 'Artikel is gepubliceerd.', (response) => {
      setStatus('published')
      if (response.published_url) {
        setMessage(`Artikel gepubliceerd op ${response.published_url}`)
      }
    })
  }

  const updateStatus = (reviewStatus: ReviewStatus) => {
    runPatchAction({ action: 'set_status', review_status: reviewStatus }, 'Status bijgewerkt.', () => {
      setStatus(reviewStatus)
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900">Artikeltekst</p>
        {!hasArticle ? (
          <Button size="sm" onClick={writeArticle} disabled={isPending}>
            Schrijf artikel
          </Button>
        ) : (
          <>
            <textarea
              value={articleBody}
              onChange={(event) => setArticleBody(event.target.value)}
              className="min-h-[260px] w-full rounded-md border border-gray-300 p-3 text-sm leading-6 text-gray-800"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={saveArticle} disabled={isPending}>
                Tekst opslaan
              </Button>
              <Button size="sm" variant="outline" onClick={publishArticle} disabled={isPending || !canPublishOnZwijsen || status === 'published'}>
                {status === 'published' ? 'Al gepubliceerd' : 'Publiceer op zwijsen.net'}
              </Button>
            </div>
          </>
        )}
        {!canPublishOnZwijsen ? (
          <p className="text-xs text-gray-500">Publiceren is op dit moment alleen gekoppeld voor zwijsen.net.</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900">Reviewstatus</p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((review) => (
            <Button key={review.value} size="sm" variant={review.variant} onClick={() => updateStatus(review.value)} disabled={isPending || status === review.value}>
              {review.label}
            </Button>
          ))}
        </div>
      </div>

      {isPending ? <p className="text-xs text-gray-500">Actie wordt uitgevoerd...</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
