'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export function KavelSyncActions() {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const queueSync = (sourceType: 'gmail_funda' | 'openclaw') => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/kavels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'queue_sync', source_type: sourceType })
        })
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string
          id?: string
          dispatch?: 'queued' | 'triggered' | 'failed'
          dispatch_message?: string
        }
        if (!response.ok) throw new Error(payload.error ?? 'Sync-job kon niet worden ingepland')

        if (payload.dispatch_message) {
          setMessage(payload.dispatch_message)
        } else {
          setMessage(sourceType === 'gmail_funda' ? 'Gmail/Funda sync-job ingepland.' : 'OpenClaw sync-job ingepland.')
        }
        router.refresh()
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Onbekende fout')
      }
    })
  }

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900">Bronnen syncen</p>
      <p className="text-xs text-gray-500">Plan hier handmatig sync-jobs in. De worker kan deze jobs daarna oppakken.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => queueSync('gmail_funda')} disabled={isPending}>
          Check Funda via Gmail
        </Button>
        <Button size="sm" variant="outline" onClick={() => queueSync('openclaw')} disabled={isPending}>
          Import vanuit OpenClaw
        </Button>
      </div>
      {isPending ? <p className="text-xs text-gray-500">Actie wordt uitgevoerd...</p> : null}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
