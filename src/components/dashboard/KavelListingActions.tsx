'use client'

import { Button } from '@/components/ui/button'
import type { ListingStatus } from '@/lib/kavels/types'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

interface KavelListingActionsProps {
  id: string
  status: ListingStatus
}

export function KavelListingActions({ id, status }: KavelListingActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const runAction = (body: Record<string, unknown>, successMessage: string) => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/kavels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        const payload = (await response.json().catch(() => ({}))) as { error?: string; publishedUrls?: string[] }
        if (!response.ok) throw new Error(payload.error ?? 'Actie mislukt')

        if (Array.isArray(payload.publishedUrls) && payload.publishedUrls.length > 0) {
          setMessage(`Gepubliceerd op ${payload.publishedUrls.join(' en ')}`)
        } else {
          setMessage(successMessage)
        }
        router.refresh()
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Onbekende fout')
      }
    })
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={isPending || status === 'approved' || status === 'published'}
          onClick={() => runAction({ action: 'set_status', id, status: 'approved' }, 'Kavel op approved gezet.')}
        >
          Approve
        </Button>
        <Button size="sm" disabled={isPending || status === 'published'} onClick={() => runAction({ action: 'publish', id }, 'Kavel gepubliceerd.')}>
          Publiceer
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending || status === 'skipped'}
          onClick={() => runAction({ action: 'set_status', id, status: 'skipped' }, 'Kavel overgeslagen.')}
        >
          Skip
        </Button>
      </div>
      {isPending ? <p className="text-right text-xs text-gray-500 dark:text-gray-400">Bezig...</p> : null}
      {message ? <p className="text-right text-xs text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-right text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
