'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useEffect, useState, useTransition } from 'react'

type Job = {
  id: string
  address: string
  status: 'queued' | 'running' | 'done' | 'failed'
  error_text: string | null
  created_at: string
  updated_at: string
}

export function DsoJobRunner() {
  const [address, setAddress] = useState('')
  const [items, setItems] = useState<Job[]>([])
  const [isPending, startTransition] = useTransition()

  const load = async () => {
    const res = await fetch('/api/dso/jobs')
    const data = await res.json().catch(() => ({}))
    setItems((data.items ?? []) as Job[])
  }

  useEffect(() => {
    load()
  }, [])

  const enqueue = () => {
    if (!address.trim()) return
    startTransition(async () => {
      await fetch('/api/dso/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      })
      setAddress('')
      await load()
    })
  }

  const runNext = () => {
    startTransition(async () => {
      await fetch('/api/dso/jobs/run', { method: 'POST' })
      await load()
    })
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-2 md:flex-row">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adres voor DSO-agent job" />
        <Button onClick={enqueue} disabled={isPending || !address.trim()}>{isPending ? 'Bezig...' : 'In queue'}</Button>
        <Button variant="outline" onClick={runNext} disabled={isPending}>Run next job</Button>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Nog geen DSO jobs.</p>
        ) : (
          items.map((j) => (
            <div key={j.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{j.address}</p>
                <span className="text-xs">{j.status}</span>
              </div>
              {j.error_text ? <p className="mt-1 text-xs text-red-600">{j.error_text}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
