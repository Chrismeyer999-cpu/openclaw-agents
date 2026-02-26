'use client'

import { Button } from '@/components/ui/button'
import { useState, useTransition } from 'react'

export function GoogleWorkspaceTestButton({ workspaceId }: { workspaceId: string }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string>('')

  const run = () => {
    startTransition(async () => {
      setResult('Test draait...')
      const res = await fetch('/api/google/test-gsc', {
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
        {isPending ? 'Testen...' : 'Test GSC property'}
      </Button>
      {result ? <pre className="max-h-56 overflow-auto rounded bg-gray-50 p-2 text-[11px] dark:bg-gray-950">{result}</pre> : null}
    </div>
  )
}
