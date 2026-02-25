'use client'

import { Button } from '@/components/ui/button'
import { useState, useTransition } from 'react'

export function GoogleSyncCard() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string>('')

  const runSync = () => {
    startTransition(async () => {
      setResult('Sync gestart...')
      try {
        const res = await fetch('/api/google/sync', { method: 'POST' })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; results?: Array<{ workspace: string; gscRows: number; ga4Rows: number; errors: string[] }> }
        if (!res.ok) {
          setResult(`Fout: ${data.error ?? 'onbekend'}`)
          return
        }
        const lines = (data.results ?? []).map((r) => `${r.workspace}: GSC ${r.gscRows}, GA4 ${r.ga4Rows}${r.errors?.length ? `, errors: ${r.errors.join(' | ')}` : ''}`)
        setResult(lines.length ? lines.join('\n') : 'Sync klaar.')
      } catch (e) {
        setResult(`Fout: ${e instanceof Error ? e.message : 'onbekend'}`)
      }
    })
  }

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Google Sync</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">Run handmatig GSC + GA4 sync voor alle workspaces.</p>
      <Button size="sm" onClick={runSync} disabled={isPending}>
        {isPending ? 'Bezig...' : 'Run Google Sync'}
      </Button>
      {result ? <pre className="whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-700 dark:bg-gray-950 dark:text-gray-300">{result}</pre> : null}
    </div>
  )
}
