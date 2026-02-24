'use client'

import { Button } from '@/components/ui/button'
import type { KavelAlertStatus } from '@/lib/kavels/types'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

interface KavelAlertStatusActionsProps {
  id: string
  status: KavelAlertStatus
}

export function KavelAlertStatusActions({ id, status }: KavelAlertStatusActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const setStatus = (nextStatus: KavelAlertStatus) => {
    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/kavel-alert', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: nextStatus })
        })
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        if (!response.ok) throw new Error(payload.error ?? 'Statusupdate mislukt')
        router.refresh()
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Onbekende fout')
      }
    })
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" disabled={isPending || status === 'actief'} onClick={() => setStatus('actief')}>
          Actief
        </Button>
        <Button size="sm" variant="outline" disabled={isPending || status === 'pauze'} onClick={() => setStatus('pauze')}>
          Pauze
        </Button>
        <Button size="sm" variant="destructive" disabled={isPending || status === 'uitgeschreven'} onClick={() => setStatus('uitgeschreven')}>
          Uitschrijven
        </Button>
      </div>
      {error ? <p className="text-right text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

