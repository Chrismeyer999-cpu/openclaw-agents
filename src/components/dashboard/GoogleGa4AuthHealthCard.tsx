'use client'

import { Button } from '@/components/ui/button'
import { useState, useTransition } from 'react'

export function GoogleGa4AuthHealthCard() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string>('')

  const run = () => {
    startTransition(async () => {
      setResult('Health check draait...')
      const res = await fetch('/api/google/ga4-auth-health')
      const data = await res.json().catch(() => ({}))
      setResult(JSON.stringify(data, null, 2))
    })
  }

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">GA4 Auth Health</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">Controleer key parsing + token issuance zonder handmatige curl.</p>
      <Button size="sm" variant="outline" onClick={run} disabled={isPending}>
        {isPending ? 'Controleren...' : 'Run GA4 Auth Health Check'}
      </Button>
      {result ? <pre className="max-h-56 overflow-auto rounded bg-gray-50 p-2 text-[11px] dark:bg-gray-950">{result}</pre> : null}
    </div>
  )
}
