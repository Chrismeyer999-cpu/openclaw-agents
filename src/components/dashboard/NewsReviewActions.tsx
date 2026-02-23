'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'published'

interface NewsReviewActionsProps {
  id: string
  currentStatus: ReviewStatus
  source: 'seo' | 'agent'
}

const STATUSES: { value: ReviewStatus; label: string; variant: 'outline' | 'destructive' | 'secondary' }[] = [
  { value: 'approved', label: 'Approve', variant: 'secondary' },
  { value: 'rejected', label: 'Reject', variant: 'destructive' },
  { value: 'published', label: 'Publish', variant: 'outline' },
  { value: 'pending', label: 'Terug naar pending', variant: 'outline' }
]

export function NewsReviewActions({ id, currentStatus, source }: NewsReviewActionsProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const updateStatus = (reviewStatus: ReviewStatus) => {
    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/nieuws', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, review_status: reviewStatus, source })
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(payload.error ?? 'Kon status niet bijwerken')
        }

        router.refresh()
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'Onbekende fout'
        setError(message)
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((status) => (
          <Button
            key={status.value}
            size="sm"
            variant={status.variant}
            onClick={() => updateStatus(status.value)}
            disabled={isPending || currentStatus === status.value}
          >
            {status.label}
          </Button>
        ))}
      </div>
      {isPending ? <p className="text-xs text-gray-500">Status wordt bijgewerkt...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
