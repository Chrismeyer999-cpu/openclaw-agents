'use client'

import { Button } from '@/components/ui/button'
import { useState, useTransition } from 'react'

export function GoogleWorkspaceGa4TestButton({ workspaceId }: { workspaceId: string }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string>('')

  const run = () => {
    startTransition(async () => {
      setResult('GA4 test draait...')
      const res = await fetch('/api/google/test-ga4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      })
      const data = await res.json().catch(() => ({}))
      setResult(JSON.stringify(data, null, 2))
    })
  }

  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="outline" onClick={run} disabled={isPending}>
        {isPending ? 'Testen...' : 'Test GA4 property'}
      </Button>
      {result ? <pre className="max-h-56 overflow-auto rounded bg-gray-50 p-2 text-[11px] dark:bg-gray-950">{result}</pre> : null}
    </div>
  )
}
