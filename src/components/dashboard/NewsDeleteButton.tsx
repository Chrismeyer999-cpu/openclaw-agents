'use client'

import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

interface NewsDeleteButtonProps {
  id: string
  source: 'seo' | 'agent'
}

export function NewsDeleteButton({ id, source }: NewsDeleteButtonProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const remove = () => {
    const ok = window.confirm('Weet je zeker dat je dit nieuwsitem wilt verwijderen?')
    if (!ok) return

    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/nieuws', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, source })
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(payload.error ?? 'Kon item niet verwijderen')
        }

        router.refresh()
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'Onbekende fout'
        setError(message)
      }
    })
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button size="sm" variant="ghost" onClick={remove} disabled={isPending} className="text-red-600 hover:text-red-700">
        <Trash2 className="mr-1 size-4" /> Verwijder
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
